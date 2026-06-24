// ============================================================
// INDEX.JS — Página de realização do checklist (sem login)
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
let placasCadastradas = [];
let secoes    = [];
let itens     = [];
let respostas = {};
let observacoes = {};
let checklistSubmetido = null;

// ---------- Elementos ----------
const inputPlaca  = document.getElementById('input-placa');
const inputMot    = document.getElementById('input-motorista');
const erroPlaca   = document.getElementById('erro-placa');
const formInfo    = document.getElementById('form-info');
const secaoForm   = document.getElementById('secao-form');
const secaoResult = document.getElementById('secao-resultado');
const listaItens  = document.getElementById('lista-itens');
const acessoAdmin = document.getElementById('acesso-admin');

// ---------- Init ----------
async function init() {
  try {
    await Promise.all([carregarPlacas(), carregarItens()]);
  } catch (e) {
    console.error('Erro ao inicializar:', e);
  }
  onAuthStateChanged(auth, user => {
    if (user) acessoAdmin?.classList.remove('hidden');
  });
}

async function carregarPlacas() {
  try {
    const snap = await getDocs(
      query(collection(db, 'placas'), where('ativo', '==', true))
    );
    placasCadastradas = snap.docs.map(d => d.data().placa.toUpperCase());
  } catch (e) {
    console.error('Erro placas:', e);
    toast('Erro ao carregar placas.', 'error');
  }
}

async function carregarItens() {
  try {
    // Busca seções e itens sem filtro composto (evita exigir índice no Firestore)
    const [snapSec, snapItens] = await Promise.all([
      getDocs(query(collection(db, 'secoes'), orderBy('ordem'))),
      getDocs(query(collection(db, 'itens'),  orderBy('ordem')))
    ]);
    secoes = snapSec.docs.map(d => ({ id: d.id, ...d.data() }));
    // Filtra ativos no cliente
    itens  = snapItens.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(i => i.ativo !== false);

    console.log(`Carregados: ${secoes.length} seções, ${itens.length} itens`);
  } catch (e) {
    console.error('Erro itens:', e);
    toast('Erro ao carregar itens do checklist.', 'error');
  }
}

// ---------- Iniciar ----------
document.getElementById('btn-iniciar')?.addEventListener('click', () => {
  const placa     = normalizarPlaca(inputPlaca.value);
  const motorista = inputMot.value.trim();
  let ok = true;

  erroPlaca.classList.add('hidden');
  inputPlaca.classList.remove('error');
  inputMot.classList.remove('error');

  if (!motorista) { inputMot.classList.add('error'); ok = false; }

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

  if (itens.length === 0) {
    toast('Nenhum item encontrado. Verifique se o banco foi populado.', 'error');
    return;
  }

  const badge = document.getElementById('placa-badge');
  if (badge) badge.textContent = placa;

  renderizarFormChecklist();
  formInfo.classList.add('hidden');
  secaoForm.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------- Renderizar form ----------
function renderizarFormChecklist() {
  listaItens.innerHTML = '';
  respostas   = {};
  observacoes = {};

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

  // Itens sem seção
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

  const naOpt = item.permiteNaoAplica ? `
    <div class="radio-opcao radio-na">
      <input type="radio" name="item-${item.id}" id="na-${item.id}" value="na">
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
        <input type="radio" name="item-${item.id}" id="c-${item.id}" value="c">
        <label for="c-${item.id}">✅ Conforme</label>
      </div>
      <div class="radio-opcao radio-naoconforme">
        <input type="radio" name="item-${item.id}" id="nc-${item.id}" value="nc">
        <label for="nc-${item.id}">❌ Não Conforme</label>
      </div>
      ${naOpt}
    </div>
    <div class="item-obs hidden" id="obs-wrap-${item.id}">
      <textarea placeholder="Observação (opcional)..." id="obs-${item.id}" maxlength="300"></textarea>
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

// ---------- Enviar ----------
document.getElementById('btn-enviar')?.addEventListener('click', async () => {
  const naoResp = itens.filter(i => !respostas[i.id]);
  if (naoResp.length) {
    const el = document.getElementById(`item-wrap-${naoResp[0].id}`);
    el?.scrollIntoView({ behavior:'smooth', block:'center' });
    el?.style.setProperty('outline', '2px solid var(--cor-reprovado)');
    setTimeout(() => el?.style.removeProperty('outline'), 2500);
    toast(`Faltam ${naoResp.length} item(s) para responder.`, 'error');
    return;
  }

  const placa     = normalizarPlaca(inputPlaca.value);
  const motorista = inputMot.value.trim();
  const { aprovado, percentual, conformes, totalItens } = calcularResultado(respostas, itens);
  const resultado = aprovado ? 'aprovado' : 'reprovado';

  const btn = document.getElementById('btn-enviar');
  btn.disabled = true; btn.textContent = 'Salvando...';

  try {
    const ref = await addDoc(collection(db, 'checklists'), {
      placa, motorista, resultado, percentual,
      conformes, totalItens, respostas, observacoes,
      criadoEm: serverTimestamp()
    });
    checklistSubmetido = { id: ref.id, placa, motorista, resultado, percentual, respostas, observacoes, criadoEm: new Date() };
    exibirResultado(checklistSubmetido);
    secaoForm.classList.add('hidden');
    secaoResult.classList.remove('hidden');
    window.scrollTo({ top:0, behavior:'smooth' });
  } catch (e) {
    console.error(e);
    toast('Erro ao salvar. Tente novamente.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = '✅ Enviar Checklist';
  }
});

function exibirResultado(data) {
  document.getElementById('resultado-banner').className = `resultado-banner ${data.resultado}`;
  document.getElementById('resultado-icone').textContent     = data.resultado === 'aprovado' ? '✅' : '❌';
  document.getElementById('resultado-titulo').textContent    = data.resultado === 'aprovado' ? 'APROVADO' : 'REPROVADO';
  document.getElementById('resultado-placa').textContent     = data.placa;
  document.getElementById('resultado-motorista').textContent = data.motorista;
  document.getElementById('resultado-datahora').textContent  = formatarDataHora(data.criadoEm);
  document.getElementById('resultado-percentual').textContent = `${data.percentual}% de conformidade`;
}

// ---------- Novo checklist ----------
document.getElementById('btn-novo')?.addEventListener('click', () => {
  checklistSubmetido = null; respostas = {}; observacoes = {};
  inputPlaca.value = ''; inputMot.value = '';
  secaoResult.classList.add('hidden');
  formInfo.classList.remove('hidden');
  window.scrollTo({ top:0, behavior:'smooth' });
});

// ---------- PDF ----------
document.getElementById('btn-pdf')?.addEventListener('click', () => {
  if (!checklistSubmetido) return;
  exportarPDF(gerarHTMLPDF(checklistSubmetido, itens, secoes), `checklist-${checklistSubmetido.placa}`);
});

init();
