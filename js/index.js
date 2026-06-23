// ============================================================
// INDEX.JS — Página de realização do checklist (sem login)
// ============================================================
import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, doc, getDoc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { toast, normalizarPlaca, validarPlaca, calcularResultado, formatarDataHora, exportarPDF, gerarHTMLPDF } from "./utils.js";

// ---------- Estado ----------
let placasCadastradas = [];
let secoes = [];
let itens = [];
let respostas = {};
let observacoes = {};
let checklistSubmetido = null;

// ---------- Elementos ----------
const formInfo    = document.getElementById('form-info');
const secaoForm   = document.getElementById('secao-form');
const secaoResult = document.getElementById('secao-resultado');
const inputPlaca  = document.getElementById('input-placa');
const inputMot    = document.getElementById('input-motorista');
const erroPlaca   = document.getElementById('erro-placa');
const btnIniciar  = document.getElementById('btn-iniciar');
const btnEnviar   = document.getElementById('btn-enviar');
const btnNovo     = document.getElementById('btn-novo');
const btnPDF      = document.getElementById('btn-pdf');
const acessoAdmin = document.getElementById('acesso-admin');
const listaItens  = document.getElementById('lista-itens');

// ---------- Inicialização ----------
async function init() {
  await carregarPlacas();
  await carregarItens();

  // Verificar se usuário está logado para mostrar link admin
  onAuthStateChanged(auth, (user) => {
    if (user) {
      acessoAdmin?.classList.remove('hidden');
    }
  });
}

async function carregarPlacas() {
  try {
    const snap = await getDocs(query(collection(db, 'placas'), where('ativo', '==', true)));
    placasCadastradas = snap.docs.map(d => d.data().placa.toUpperCase());
  } catch (e) {
    toast('Erro ao carregar placas. Verifique a conexão.', 'error');
  }
}

async function carregarItens() {
  try {
    const [snapSecoes, snapItens] = await Promise.all([
      getDocs(query(collection(db, 'secoes'), orderBy('ordem'))),
      getDocs(query(collection(db, 'itens'), where('ativo', '==', true), orderBy('ordem')))
    ]);
    secoes = snapSecoes.docs.map(d => ({ id: d.id, ...d.data() }));
    itens  = snapItens.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    toast('Erro ao carregar itens do checklist.', 'error');
  }
}

// ---------- Iniciar Checklist ----------
btnIniciar?.addEventListener('click', () => {
  const placa = normalizarPlaca(inputPlaca.value);
  const motorista = inputMot.value.trim();

  // Validações
  let ok = true;
  erroPlaca.classList.add('hidden');
  inputPlaca.classList.remove('error');
  inputMot.classList.remove('error');

  if (!motorista) {
    inputMot.classList.add('error');
    ok = false;
  }
  if (!placa) {
    inputPlaca.classList.add('error');
    erroPlaca.textContent = 'Informe a placa do veículo.';
    erroPlaca.classList.remove('hidden');
    ok = false;
  } else if (!validarPlaca(placa)) {
    inputPlaca.classList.add('error');
    erroPlaca.textContent = 'Formato inválido. Use ABC1234 ou ABC1D23.';
    erroPlaca.classList.remove('hidden');
    ok = false;
  } else if (!placasCadastradas.includes(placa)) {
    inputPlaca.classList.add('error');
    erroPlaca.textContent = 'Placa não cadastrada no sistema.';
    erroPlaca.classList.remove('hidden');
    ok = false;
  }
  if (!ok) return;

  // Renderizar formulário de checklist
  renderizarFormChecklist();
  formInfo.classList.add('hidden');
  secaoForm.classList.remove('hidden');
});

// ---------- Renderizar itens ----------
function renderizarFormChecklist() {
  listaItens.innerHTML = '';
  respostas = {};
  observacoes = {};

  for (const secao of secoes) {
    const itensSecao = itens.filter(i => i.secaoId === secao.id).sort((a, b) => a.ordem - b.ordem);
    if (itensSecao.length === 0) continue;

    const secaoEl = document.createElement('div');
    secaoEl.className = 'secao-bloco';
    secaoEl.innerHTML = `
      <div class="secao-titulo">
        <div class="secao-numero">${secao.ordem}</div>
        ${secao.nome}
      </div>`;

    for (const item of itensSecao) {
      secaoEl.appendChild(criarItemEl(item));
    }
    listaItens.appendChild(secaoEl);
  }

  // Itens sem seção
  const semSecao = itens.filter(i => !secoes.find(s => s.id === i.secaoId));
  if (semSecao.length > 0) {
    const div = document.createElement('div');
    div.innerHTML = `<div class="secao-titulo"><div class="secao-numero">+</div>Outros</div>`;
    semSecao.forEach(item => div.appendChild(criarItemEl(item)));
    listaItens.appendChild(div);
  }
}

function criarItemEl(item) {
  const div = document.createElement('div');
  div.className = 'item-checklist';
  div.id = `item-wrap-${item.id}`;

  const naOption = item.permiteNaoAplica
    ? `<div class="radio-opcao radio-na">
        <input type="radio" name="item-${item.id}" id="na-${item.id}" value="na">
        <label for="na-${item.id}">🚫 Não se Aplica</label>
       </div>`
    : '';

  div.innerHTML = `
    <div class="item-header">
      <span class="item-numero">#${String(item.numero).padStart(2,'0')}</span>
      <span class="item-nome">${item.nome}</span>
    </div>
    <div class="item-parametro">${item.parametro}</div>
    <div class="item-badges">
      ${item.impeditivo ? '<span class="badge badge-imp">⛔ Impeditivo</span>' : '<span class="badge" style="background:rgba(0,200,150,.1);color:#00C896;">✅ Não Impeditivo</span>'}
      ${item.permiteNaoAplica ? '<span class="badge badge-na">Permite N/A</span>' : ''}
    </div>
    <div class="radio-opcoes" style="margin-top:12px;">
      <div class="radio-opcao radio-conforme">
        <input type="radio" name="item-${item.id}" id="c-${item.id}" value="c">
        <label for="c-${item.id}">✅ Conforme</label>
      </div>
      <div class="radio-opcao radio-naoconforme">
        <input type="radio" name="item-${item.id}" id="nc-${item.id}" value="nc">
        <label for="nc-${item.id}">❌ Não Conforme</label>
      </div>
      ${naOption}
    </div>
    <div class="item-obs hidden" id="obs-wrap-${item.id}">
      <textarea placeholder="Observação (opcional)..." id="obs-${item.id}" maxlength="300"></textarea>
    </div>`;

  // Eventos de seleção
  div.querySelectorAll(`input[name="item-${item.id}"]`).forEach(radio => {
    radio.addEventListener('change', () => {
      respostas[item.id] = radio.value;
      // Atualiza classe visual
      div.classList.remove('is-conforme', 'is-naoconforme', 'is-naaaplica');
      if (radio.value === 'c')  div.classList.add('is-conforme');
      if (radio.value === 'nc') div.classList.add('is-naoconforme');
      if (radio.value === 'na') div.classList.add('is-naaaplica');
      // Mostrar campo obs para não conforme
      const obsWrap = document.getElementById(`obs-wrap-${item.id}`);
      if (radio.value === 'nc') {
        obsWrap?.classList.remove('hidden');
      } else {
        obsWrap?.classList.add('hidden');
      }
    });
  });

  div.querySelector(`#obs-${item.id}`)?.addEventListener('input', (e) => {
    observacoes[item.id] = e.target.value;
  });

  return div;
}

// ---------- Enviar Checklist ----------
btnEnviar?.addEventListener('click', async () => {
  // Verificar se todos os itens foram respondidos
  const naoRespondidos = itens.filter(i => !respostas[i.id]);
  if (naoRespondidos.length > 0) {
    // Destacar item não respondido
    const primeiro = naoRespondidos[0];
    const el = document.getElementById(`item-wrap-${primeiro.id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.style.setProperty('border-color', 'var(--cor-alerta)');
    setTimeout(() => el?.style.removeProperty('border-color'), 2000);
    toast(`Responda todos os itens. Faltam ${naoRespondidos.length} item(s).`, 'error');
    return;
  }

  const placa     = normalizarPlaca(inputPlaca.value);
  const motorista = inputMot.value.trim();

  // Calcular resultado
  const { aprovado, percentual, conformes, totalItens } = calcularResultado(respostas, itens);
  const resultado = aprovado ? 'aprovado' : 'reprovado';

  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Salvando...';

  try {
    const docRef = await addDoc(collection(db, 'checklists'), {
      placa,
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
      id: docRef.id,
      placa, motorista, resultado, percentual,
      respostas, observacoes,
      criadoEm: new Date()
    };

    exibirResultado(checklistSubmetido);
    secaoForm.classList.add('hidden');
    secaoResult.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (e) {
    toast('Erro ao salvar. Tente novamente.', 'error');
    console.error(e);
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar Checklist';
  }
});

// ---------- Exibir Resultado ----------
function exibirResultado(data) {
  const banner  = document.getElementById('resultado-banner');
  const icone   = document.getElementById('resultado-icone');
  const titulo  = document.getElementById('resultado-titulo');
  const placa   = document.getElementById('resultado-placa');
  const motor   = document.getElementById('resultado-motorista');
  const datahr  = document.getElementById('resultado-datahora');
  const perc    = document.getElementById('resultado-percentual');

  banner.className = `resultado-banner ${data.resultado}`;
  icone.textContent = data.resultado === 'aprovado' ? '✅' : '❌';
  titulo.textContent = data.resultado === 'aprovado' ? 'APROVADO' : 'REPROVADO';
  placa.textContent  = data.placa;
  motor.textContent  = data.motorista;
  datahr.textContent = formatarDataHora(data.criadoEm);
  perc.textContent   = `${data.percentual}% de conformidade`;
}

// ---------- Novo Checklist ----------
btnNovo?.addEventListener('click', () => {
  checklistSubmetido = null;
  respostas = {};
  observacoes = {};
  inputPlaca.value = '';
  inputMot.value = '';
  secaoResult.classList.add('hidden');
  formInfo.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------- Exportar PDF ----------
btnPDF?.addEventListener('click', () => {
  if (!checklistSubmetido) return;
  const html = gerarHTMLPDF(checklistSubmetido, itens, secoes);
  exportarPDF(html, `checklist-${checklistSubmetido.placa}-${checklistSubmetido.id}`);
});

// ---------- Start ----------
init();
