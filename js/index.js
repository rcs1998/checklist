// ============================================================
// INDEX.JS — Checklist com tela de confirmação e troca de placa
// ============================================================
import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, addDoc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  toast, normalizarPlaca, validarPlaca,
  calcularResultado, formatarDataHora,
  exportarPDF, gerarHTMLPDF
} from "./utils.js";

// ---------- Estado global ----------
let placasMap         = {};   // { "ABC1234": { placa, modelo } }
let secoes            = [];
let itens             = [];
let respostas         = {};
let observacoes       = {};
let placaAtual        = '';
let modeloAtual       = '';
let checklistSubmetido = null;

// ---------- Elementos ----------
const inputPlaca      = document.getElementById('input-placa');
const inputMot        = document.getElementById('input-motorista');
const erroPlaca       = document.getElementById('erro-placa');
const erroMot         = document.getElementById('erro-motorista');
const secaoInfo       = document.getElementById('secao-info');
const secaoForm       = document.getElementById('secao-form');
const secaoConfirm    = document.getElementById('secao-confirmacao');
const secaoResult     = document.getElementById('secao-resultado');
const listaItens      = document.getElementById('lista-itens');
const placaBadge      = document.getElementById('placa-badge');

// ---------- Init ----------
async function init() {
  try {
    await Promise.all([carregarPlacas(), carregarItens()]);
  } catch (e) {
    console.error('Erro ao inicializar:', e);
  }
  onAuthStateChanged(auth, user => {
    document.getElementById('acesso-admin')?.classList.toggle('hidden', !user);
  });
}

// ---------- Carregar placas (inclui modelo) ----------
async function carregarPlacas() {
  try {
    const snap = await getDocs(
      query(collection(db, 'placas'), where('ativo', '==', true))
    );
    placasMap = {};
    snap.docs.forEach(d => {
      const dados = d.data();
      placasMap[dados.placa.toUpperCase()] = {
        placa: dados.placa.toUpperCase(),
        modelo: dados.modelo || ''
      };
    });
  } catch (e) {
    console.error('Erro placas:', e);
    toast('Erro ao carregar placas.', 'error');
  }
}

// ---------- Carregar itens e seções ----------
async function carregarItens() {
  try {
    const [snapSec, snapItens] = await Promise.all([
      getDocs(query(collection(db, 'secoes'), orderBy('ordem'))),
      getDocs(query(collection(db, 'itens'),  orderBy('ordem')))
    ]);
    secoes = snapSec.docs.map(d => ({ id: d.id, ...d.data() }));
    itens  = snapItens.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(i => i.ativo !== false);
    console.log(`Carregados: ${secoes.length} seções, ${itens.length} itens`);
  } catch (e) {
    console.error('Erro itens:', e);
    toast('Erro ao carregar itens do checklist.', 'error');
  }
}

// ---------- Utilitário: mostrar seção ----------
function mostrarSecao(id) {
  ['secao-info','secao-form','secao-confirmacao','secao-resultado'].forEach(s => {
    document.getElementById(s)?.classList.toggle('hidden', s !== id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// SEÇÃO 1 → SEÇÃO 2: Iniciar checklist
// ============================================================
document.getElementById('btn-iniciar')?.addEventListener('click', () => {
  const placa     = normalizarPlaca(inputPlaca.value);
  const motorista = inputMot.value.trim();
  let ok = true;

  // Reset erros
  erroPlaca.style.display = 'none';
  erroMot.style.display   = 'none';
  inputPlaca.classList.remove('error');
  inputMot.classList.remove('error');

  if (!motorista) {
    inputMot.classList.add('error');
    erroMot.style.display = 'block';
    ok = false;
  }
  if (!placa) {
    inputPlaca.classList.add('error');
    erroPlaca.textContent = 'Informe a placa do veículo.';
    erroPlaca.style.display = 'block';
    ok = false;
  } else if (!validarPlaca(placa)) {
    inputPlaca.classList.add('error');
    erroPlaca.textContent = 'Formato inválido. Use ABC1234 ou ABC1D23.';
    erroPlaca.style.display = 'block';
    ok = false;
  } else if (!placasMap[placa]) {
    inputPlaca.classList.add('error');
    erroPlaca.textContent = 'Placa não cadastrada no sistema.';
    erroPlaca.style.display = 'block';
    ok = false;
  }
  if (!ok) return;

  if (itens.length === 0) {
    toast('Nenhum item encontrado. Verifique se o banco foi populado.', 'error');
    return;
  }

  // Define placa e modelo atuais
  placaAtual  = placa;
  modeloAtual = placasMap[placa]?.modelo || '';

  // Atualiza badge
  atualizarPlacaBadge();

  // Renderiza checklist (respostas zeradas apenas na primeira vez)
  renderizarFormChecklist(false);
  mostrarSecao('secao-form');
});

function atualizarPlacaBadge() {
  if (placaBadge) {
    placaBadge.textContent = modeloAtual
      ? `${placaAtual} · ${modeloAtual}`
      : placaAtual;
  }
}

// ============================================================
// RENDERIZAR CHECKLIST
// ============================================================
function renderizarFormChecklist(resetarRespostas = true) {
  if (resetarRespostas) {
    respostas   = {};
    observacoes = {};
  }

  listaItens.innerHTML = '';

  for (const secao of secoes) {
    const itensSecao = itens
      .filter(i => i.secaoId === secao.id)
      .sort((a, b) => a.ordem - b.ordem);
    if (!itensSecao.length) continue;

    const bloco = document.createElement('div');
    bloco.className = 'secao-bloco';
    bloco.innerHTML = `
      <div class="secao-titulo">
        <div class="secao-numero">${secao.ordem}</div>
        ${secao.nome}
      </div>`;
    itensSecao.forEach(item => bloco.appendChild(criarItemEl(item)));
    listaItens.appendChild(bloco);
  }

  const semSecao = itens.filter(i => !secoes.find(s => s.id === i.secaoId));
  if (semSecao.length) {
    const bloco = document.createElement('div');
    bloco.innerHTML = `<div class="secao-titulo"><div class="secao-numero">+</div>Outros</div>`;
    semSecao.forEach(item => bloco.appendChild(criarItemEl(item)));
    listaItens.appendChild(bloco);
  }
}

function criarItemEl(item) {
  const div = document.createElement('div');
  div.className = 'item-checklist';
  div.id = `item-wrap-${item.id}`;

  // Restaurar estado visual se já havia resposta
  const respAtual = respostas[item.id];
  const obsAtual  = observacoes[item.id] || '';

  if (respAtual === 'c')  div.classList.add('is-conforme');
  if (respAtual === 'nc') div.classList.add('is-naoconforme');
  if (respAtual === 'na') div.classList.add('is-naaaplica');

  const naOpt = item.permiteNaoAplica ? `
    <div class="radio-opcao radio-na">
      <input type="radio" name="item-${item.id}" id="na-${item.id}" value="na"${respAtual==='na'?' checked':''}>
      <label for="na-${item.id}">🚫 Não se Aplica</label>
    </div>` : '';

  div.innerHTML = `
    <div class="item-header">
      <span class="item-numero">#${String(item.numero).padStart(2,'0')}</span>
      <span class="item-nome">${item.nome}</span>
    </div>
    <div class="item-parametro">${item.parametro}</div>
    <div class="item-badges">
      ${item.impeditivo
        ? '<span class="badge badge-imp">⛔ Impeditivo</span>'
        : '<span class="badge" style="background:rgba(0,168,122,.1);color:#00A87A">✅ Não Impeditivo</span>'}
      ${item.permiteNaoAplica ? '<span class="badge badge-na">Permite N/A</span>' : ''}
    </div>
    <div class="radio-opcoes" style="margin-top:12px">
      <div class="radio-opcao radio-conforme">
        <input type="radio" name="item-${item.id}" id="c-${item.id}" value="c"${respAtual==='c'?' checked':''}>
        <label for="c-${item.id}">✅ Conforme</label>
      </div>
      <div class="radio-opcao radio-naoconforme">
        <input type="radio" name="item-${item.id}" id="nc-${item.id}" value="nc"${respAtual==='nc'?' checked':''}>
        <label for="nc-${item.id}">❌ Não Conforme</label>
      </div>
      ${naOpt}
    </div>
    <div class="item-obs${respAtual==='nc' ? '' : ' hidden'}" id="obs-wrap-${item.id}">
      <textarea placeholder="Observação (opcional)..." id="obs-${item.id}" maxlength="300">${obsAtual}</textarea>
    </div>`;

  div.querySelectorAll(`input[name="item-${item.id}"]`).forEach(radio => {
    radio.addEventListener('change', () => {
      respostas[item.id] = radio.value;
      div.classList.remove('is-conforme','is-naoconforme','is-naaaplica');
      if (radio.value === 'c')  div.classList.add('is-conforme');
      if (radio.value === 'nc') div.classList.add('is-naoconforme');
      if (radio.value === 'na') div.classList.add('is-naaaplica');
      const obs = document.getElementById(`obs-wrap-${item.id}`);
      radio.value === 'nc' ? obs?.classList.remove('hidden') : obs?.classList.add('hidden');
    });
  });

  div.querySelector(`#obs-${item.id}`)?.addEventListener('input', e => {
    observacoes[item.id] = e.target.value;
  });

  return div;
}

// ============================================================
// SEÇÃO 2 → SEÇÃO 3: Ir para confirmação
// ============================================================
document.getElementById('btn-ir-confirmacao')?.addEventListener('click', () => {
  const naoResp = itens.filter(i => !respostas[i.id]);

  // Destaca primeiro item pendente (mas não bloqueia ida para confirmação)
  if (naoResp.length > 0) {
    const el = document.getElementById(`item-wrap-${naoResp[0].id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.style.setProperty('outline', '2px solid var(--cor-alerta)');
    setTimeout(() => el?.style.removeProperty('outline'), 2500);
  }

  preencherTelaConfirmacao();
  mostrarSecao('secao-confirmacao');
});

function preencherTelaConfirmacao() {
  // Placa e modelo
  document.getElementById('confirm-placa-text').textContent  = placaAtual;
  document.getElementById('confirm-modelo-text').textContent = modeloAtual || '—';
  document.getElementById('confirm-motorista').textContent   = inputMot.value.trim();

  // Contadores
  const conformes     = Object.values(respostas).filter(r => r === 'c').length;
  const naoConformes  = Object.values(respostas).filter(r => r === 'nc').length;
  const pendentes     = itens.filter(i => !respostas[i.id]).length;

  document.getElementById('confirm-conformes').textContent    = conformes;
  document.getElementById('confirm-naoconformes').textContent = naoConformes;
  document.getElementById('confirm-pendentes').textContent    = pendentes;

  const alertaEl = document.getElementById('confirm-alerta-pendentes');
  const btnEnviar = document.getElementById('btn-confirmar-envio');
  if (pendentes > 0) {
    alertaEl?.classList.remove('hidden');
    if (btnEnviar) {
      btnEnviar.disabled = true;
      btnEnviar.textContent = `⚠️ Responda todos os itens (${pendentes} pendentes)`;
    }
  } else {
    alertaEl?.classList.add('hidden');
    if (btnEnviar) {
      btnEnviar.disabled = false;
      btnEnviar.textContent = '🚀 Confirmar e Enviar';
    }
  }

  // Garante que o edit de placa começa fechado
  document.getElementById('confirm-veiculo-display')?.classList.remove('hidden');
  document.getElementById('confirm-veiculo-edit')?.classList.add('hidden');
  const inpConfirm = document.getElementById('confirm-input-placa');
  if (inpConfirm) inpConfirm.value = '';
  const erroConfirm = document.getElementById('confirm-erro-placa');
  if (erroConfirm) erroConfirm.style.display = 'none';
}

// Voltar ao form (dois botões)
['btn-voltar-form','btn-voltar-form2'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    mostrarSecao('secao-form');
  });
});

// ============================================================
// TROCA DE PLACA NA TELA DE CONFIRMAÇÃO
// ============================================================
document.getElementById('btn-alterar-placa')?.addEventListener('click', () => {
  document.getElementById('confirm-veiculo-display')?.classList.add('hidden');
  const editEl = document.getElementById('confirm-veiculo-edit');
  editEl?.classList.remove('hidden');
  // Pré-preenche com a placa atual para facilitar edição
  const inp = document.getElementById('confirm-input-placa');
  if (inp) { inp.value = placaAtual; inp.focus(); inp.select(); }
});

document.getElementById('btn-cancelar-troca-placa')?.addEventListener('click', () => {
  document.getElementById('confirm-veiculo-edit')?.classList.add('hidden');
  document.getElementById('confirm-veiculo-display')?.classList.remove('hidden');
  const erroEl = document.getElementById('confirm-erro-placa');
  if (erroEl) erroEl.style.display = 'none';
  document.getElementById('confirm-input-placa')?.classList.remove('error');
});

document.getElementById('btn-confirmar-troca-placa')?.addEventListener('click', () => {
  const inp     = document.getElementById('confirm-input-placa');
  const erroEl  = document.getElementById('confirm-erro-placa');
  const novaPlaca = normalizarPlaca(inp?.value || '');

  inp?.classList.remove('error');
  if (erroEl) erroEl.style.display = 'none';

  if (!novaPlaca) {
    inp?.classList.add('error');
    if (erroEl) { erroEl.textContent = 'Informe a placa.'; erroEl.style.display = 'block'; }
    return;
  }
  if (!validarPlaca(novaPlaca)) {
    inp?.classList.add('error');
    if (erroEl) { erroEl.textContent = 'Formato inválido. Use ABC1234 ou ABC1D23.'; erroEl.style.display = 'block'; }
    return;
  }
  if (!placasMap[novaPlaca]) {
    inp?.classList.add('error');
    if (erroEl) { erroEl.textContent = 'Placa não cadastrada no sistema.'; erroEl.style.display = 'block'; }
    return;
  }

  // Atualiza estado (MANTÉM respostas e observações)
  placaAtual  = novaPlaca;
  modeloAtual = placasMap[novaPlaca]?.modelo || '';

  // Atualiza badge no form também
  atualizarPlacaBadge();

  // Atualiza o campo de placa inicial (para consistência ao voltar)
  if (inputPlaca) inputPlaca.value = placaAtual;

  // Fecha edição e atualiza display + resumo
  document.getElementById('confirm-veiculo-edit')?.classList.add('hidden');
  document.getElementById('confirm-veiculo-display')?.classList.remove('hidden');
  preencherTelaConfirmacao();
  toast(`Placa alterada para ${placaAtual}`, 'success');
});

// ============================================================
// ENVIAR CHECKLIST
// ============================================================
document.getElementById('btn-confirmar-envio')?.addEventListener('click', async () => {
  const naoResp = itens.filter(i => !respostas[i.id]);
  if (naoResp.length) {
    toast(`Ainda há ${naoResp.length} item(s) não respondido(s). Volte e complete o checklist.`, 'error');
    return;
  }

  const motorista = inputMot.value.trim();
  const { aprovado, percentual, conformes, totalItens } = calcularResultado(respostas, itens);
  const resultado = aprovado ? 'aprovado' : 'reprovado';

  const btn = document.getElementById('btn-confirmar-envio');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const ref = await addDoc(collection(db, 'checklists'), {
      placa:      placaAtual,
      modelo:     modeloAtual,
      motorista,
      resultado,
      percentual,
      conformes,
      totalItens,
      respostas,
      observacoes,
      criadoEm: serverTimestamp()
    });

    checklistSubmetido = {
      id: ref.id,
      placa:    placaAtual,
      modelo:   modeloAtual,
      motorista,
      resultado,
      percentual,
      respostas,
      observacoes,
      criadoEm: new Date()
    };

    exibirResultado(checklistSubmetido);
    mostrarSecao('secao-resultado');

  } catch (e) {
    console.error(e);
    toast('Erro ao salvar. Tente novamente.', 'error');
    btn.disabled = false;
    btn.textContent = '🚀 Confirmar e Enviar';
  }
});

function exibirResultado(data) {
  document.getElementById('resultado-banner').className    = `resultado-banner ${data.resultado}`;
  document.getElementById('resultado-icone').textContent   = data.resultado === 'aprovado' ? '✅' : '❌';
  document.getElementById('resultado-titulo').textContent  = data.resultado === 'aprovado' ? 'APROVADO' : 'REPROVADO';
  document.getElementById('resultado-placa').textContent   = data.placa;
  const modeloWrap = document.getElementById('resultado-modelo-wrap');
  if (modeloWrap) modeloWrap.textContent = data.modelo || '';
  document.getElementById('resultado-motorista').textContent  = data.motorista;
  document.getElementById('resultado-datahora').textContent   = formatarDataHora(data.criadoEm);
  document.getElementById('resultado-percentual').textContent = `${data.percentual}% de conformidade`;
}

// ---------- Novo checklist ----------
document.getElementById('btn-novo')?.addEventListener('click', () => {
  checklistSubmetido = null;
  respostas = {}; observacoes = {};
  placaAtual = ''; modeloAtual = '';
  if (inputPlaca) inputPlaca.value = '';
  if (inputMot)   inputMot.value   = '';
  mostrarSecao('secao-info');
});

// ---------- PDF ----------
document.getElementById('btn-pdf')?.addEventListener('click', () => {
  if (!checklistSubmetido) return;
  exportarPDF(
    gerarHTMLPDF(checklistSubmetido, itens, secoes),
    `checklist-${checklistSubmetido.placa}`
  );
});

init();
