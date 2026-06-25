// ============================================================
// INDEX.JS — Checklist com modal de confirmação
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

// ---------- Estado ----------
let placasMap          = {};
let secoes             = [];
let itens              = [];
let respostas          = {};
let observacoes        = {};
let placaAtual         = '';
let modeloAtual        = '';
let checklistSubmetido = null;

// ---------- Elementos ----------
const inputPlaca  = document.getElementById('input-placa');
const inputMot    = document.getElementById('input-motorista');
const erroPlaca   = document.getElementById('erro-placa');
const erroMot     = document.getElementById('erro-motorista');
const listaItens  = document.getElementById('lista-itens');

// ---------- Utilitário: mostrar/ocultar seção ----------
function mostrarSecao(id) {
  ['secao-info','secao-form','secao-resultado'].forEach(s => {
    document.getElementById(s)?.classList.toggle('hidden', s !== id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Utilitário: abrir/fechar modal confirmação ----------
function abrirModalConfirmacao() {
  document.getElementById('modal-confirmacao')?.classList.remove('hidden');
}
function fecharModalConfirmacao() {
  document.getElementById('modal-confirmacao')?.classList.add('hidden');
  // Garante que edit placa fica fechado ao reabrir
  document.getElementById('confirm-veiculo-edit')?.classList.add('hidden');
  const inp = document.getElementById('confirm-input-placa');
  if (inp) inp.value = '';
  const err = document.getElementById('confirm-erro-placa');
  if (err) err.style.display = 'none';
}

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

async function carregarPlacas() {
  try {
    const snap = await getDocs(
      query(collection(db, 'placas'), where('ativo', '==', true))
    );
    placasMap = {};
    snap.docs.forEach(d => {
      const d2 = d.data();
      placasMap[d2.placa.toUpperCase()] = {
        placa:  d2.placa.toUpperCase(),
        modelo: d2.modelo || ''
      };
    });
  } catch (e) {
    console.error('Erro placas:', e);
    toast('Erro ao carregar placas.', 'error');
  }
}

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

// ============================================================
// SEÇÃO 1 → SEÇÃO 2: Iniciar checklist
// ============================================================
document.getElementById('btn-iniciar')?.addEventListener('click', () => {
  const placa     = normalizarPlaca(inputPlaca.value);
  const motorista = inputMot.value.trim();
  let ok = true;

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
    erroPlaca.textContent   = 'Informe a placa do veículo.';
    erroPlaca.style.display = 'block';
    ok = false;
  } else if (!validarPlaca(placa)) {
    inputPlaca.classList.add('error');
    erroPlaca.textContent   = 'Formato inválido. Use ABC1234 ou ABC1D23.';
    erroPlaca.style.display = 'block';
    ok = false;
  } else if (!placasMap[placa]) {
    inputPlaca.classList.add('error');
    erroPlaca.textContent   = 'Placa não cadastrada no sistema.';
    erroPlaca.style.display = 'block';
    ok = false;
  }
  if (!ok) return;

  if (itens.length === 0) {
    toast('Nenhum item encontrado. Verifique se o banco foi populado.', 'error');
    return;
  }

  placaAtual  = placa;
  modeloAtual = placasMap[placa]?.modelo || '';

  // Zera respostas ao iniciar novo checklist
  respostas   = {};
  observacoes = {};

  atualizarPlacaBadge();
  renderizarFormChecklist();
  mostrarSecao('secao-form');
});

function atualizarPlacaBadge() {
  const badge = document.getElementById('placa-badge');
  if (badge) {
    badge.textContent = modeloAtual
      ? `${placaAtual} · ${modeloAtual}`
      : placaAtual;
  }
}

// ============================================================
// RENDERIZAR CHECKLIST (preserva respostas existentes)
// ============================================================
function renderizarFormChecklist() {
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
// BOTÃO "REVISAR E CONFIRMAR" → abre modal só se tudo preenchido
// ============================================================
document.getElementById('btn-ir-confirmacao')?.addEventListener('click', () => {
  const naoResp = itens.filter(i => !respostas[i.id]);

  if (naoResp.length > 0) {
    // Destaca o primeiro item pendente e bloqueia
    const el = document.getElementById(`item-wrap-${naoResp[0].id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.style.setProperty('outline', '2px solid var(--cor-reprovado)');
    setTimeout(() => el?.style.removeProperty('outline'), 2500);
    toast(
      naoResp.length === 1
        ? 'Ainda falta 1 item para responder.'
        : `Ainda faltam ${naoResp.length} itens para responder.`,
      'error'
    );
    return; // ← NÃO abre o modal
  }

  preencherModalConfirmacao();
  abrirModalConfirmacao();
});

function preencherModalConfirmacao() {
  document.getElementById('confirm-placa-text').textContent  = placaAtual;
  document.getElementById('confirm-modelo-text').textContent = modeloAtual || '—';
  document.getElementById('confirm-motorista').textContent   = inputMot.value.trim();

  const conformes    = Object.values(respostas).filter(r => r === 'c').length;
  const naoConformes = Object.values(respostas).filter(r => r === 'nc').length;
  const na           = Object.values(respostas).filter(r => r === 'na').length;

  document.getElementById('confirm-conformes').textContent    = conformes;
  document.getElementById('confirm-naoconformes').textContent = naoConformes;
  document.getElementById('confirm-na').textContent           = na;
}

// ============================================================
// MODAL: controles de fechar e voltar
// ============================================================
document.getElementById('btn-fechar-confirmacao')?.addEventListener('click', fecharModalConfirmacao);
document.getElementById('btn-voltar-form')?.addEventListener('click', fecharModalConfirmacao);

// Fechar ao clicar fora
document.getElementById('modal-confirmacao')?.addEventListener('click', e => {
  if (e.target === document.getElementById('modal-confirmacao')) fecharModalConfirmacao();
});

// ============================================================
// TROCA DE PLACA DENTRO DO MODAL
// ============================================================
document.getElementById('btn-alterar-placa')?.addEventListener('click', () => {
  const editEl = document.getElementById('confirm-veiculo-edit');
  editEl?.classList.remove('hidden');
  const inp = document.getElementById('confirm-input-placa');
  if (inp) { inp.value = placaAtual; inp.focus(); inp.select(); }
});

document.getElementById('btn-cancelar-troca-placa')?.addEventListener('click', () => {
  document.getElementById('confirm-veiculo-edit')?.classList.add('hidden');
  const err = document.getElementById('confirm-erro-placa');
  if (err) err.style.display = 'none';
  document.getElementById('confirm-input-placa')?.classList.remove('error');
});

document.getElementById('btn-confirmar-troca-placa')?.addEventListener('click', () => {
  const inp      = document.getElementById('confirm-input-placa');
  const erroEl   = document.getElementById('confirm-erro-placa');
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

  // Atualiza estado — respostas e observações ficam intactas
  placaAtual  = novaPlaca;
  modeloAtual = placasMap[novaPlaca]?.modelo || '';

  // Atualiza badge no form
  atualizarPlacaBadge();
  // Atualiza campo inicial
  if (inputPlaca) inputPlaca.value = placaAtual;
  // Fecha edição e atualiza display
  document.getElementById('confirm-veiculo-edit')?.classList.add('hidden');
  preencherModalConfirmacao();
  toast(`Placa alterada para ${placaAtual}`, 'success');
});

// ============================================================
// ENVIAR CHECKLIST
// ============================================================
document.getElementById('btn-confirmar-envio')?.addEventListener('click', async () => {
  const motorista = inputMot.value.trim();
  const { aprovado, percentual, conformes, totalItens } = calcularResultado(respostas, itens);
  const resultado = aprovado ? 'aprovado' : 'reprovado';

  const btn = document.getElementById('btn-confirmar-envio');
  btn.disabled    = true;
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

    fecharModalConfirmacao();
    exibirResultado(checklistSubmetido);
    mostrarSecao('secao-resultado');

  } catch (e) {
    console.error(e);
    toast('Erro ao salvar. Tente novamente.', 'error');
    btn.disabled    = false;
    btn.textContent = '🚀 Confirmar e Enviar';
  }
});

function exibirResultado(data) {
  document.getElementById('resultado-banner').className     = `resultado-banner ${data.resultado}`;
  document.getElementById('resultado-icone').textContent    = data.resultado === 'aprovado' ? '✅' : '❌';
  document.getElementById('resultado-titulo').textContent   = data.resultado === 'aprovado' ? 'APROVADO' : 'REPROVADO';
  document.getElementById('resultado-placa').textContent    = data.placa;
  const mw = document.getElementById('resultado-modelo-wrap');
  if (mw) mw.textContent = data.modelo || '';
  document.getElementById('resultado-motorista').textContent  = data.motorista;
  document.getElementById('resultado-datahora').textContent   = formatarDataHora(data.criadoEm);
  document.getElementById('resultado-percentual').textContent = `${data.percentual}% de conformidade`;
}

// ---------- Novo checklist ----------
document.getElementById('btn-novo')?.addEventListener('click', () => {
  checklistSubmetido = null;
  respostas   = {};
  observacoes = {};
  placaAtual  = '';
  modeloAtual = '';
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
