// ============================================================
// ADMIN.JS — Resultados, Placas, Itens, Usuários e Dashboard
// ============================================================
import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, updateDoc,
  doc, query, orderBy, serverTimestamp, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updatePassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  toast, abrirModal, fecharModal, confirmar,
  formatarDataHora, normalizarPlaca, validarPlaca,
  exportarPDF, gerarHTMLPDF
} from "./utils.js";

// ---------- Estado ----------
let secoes         = [];
let itens          = [];
let placas         = [];
let checklists     = [];
let usuarios       = [];
let checklistDetalhe = null;
let usuarioAtual   = null;
let chartDonut     = null;
let chartLine      = null;

// ---------- Guard de autenticação ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  usuarioAtual = user;
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user.email;

  // Verificar troca de senha obrigatória
  try {
    const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
    if (userDoc.exists() && userDoc.data().trocarSenha === true) {
      mostrarTrocaSenha();
      return;
    }
  } catch (e) {
    // usuário admin criado direto no console, sem doc — permite acesso
  }

  init();
});

// ---------- Troca de senha obrigatória ----------
function mostrarTrocaSenha() {
  const overlay = document.createElement('div');
  overlay.className = 'change-password-overlay';
  overlay.id = 'overlay-troca-senha';
  overlay.innerHTML = `
    <div class="change-password-box">
      <h2>🔑 Crie sua nova senha</h2>
      <p>Por segurança, você precisa criar uma nova senha antes de continuar. Esta é sua primeira vez acessando o sistema.</p>
      <div id="troca-erro" class="hidden" style="background:var(--cor-reprovado-dim);border:1px solid var(--cor-reprovado);color:var(--cor-reprovado);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px;margin-bottom:16px;"></div>
      <div class="form-group">
        <label class="form-label">Nova senha <span class="req">*</span></label>
        <div style="position:relative">
          <input type="password" id="nova-senha" class="form-control" placeholder="Mínimo 6 caracteres" style="padding-right:44px">
          <button type="button" id="toggle-nova-senha" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;color:var(--cor-texto-3)">👁️</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Confirmar nova senha <span class="req">*</span></label>
        <input type="password" id="confirmar-senha" class="form-control" placeholder="Repita a senha">
      </div>
      <button id="btn-confirmar-troca" class="btn btn-primary btn-lg" style="width:100%">Definir nova senha e continuar</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('toggle-nova-senha')?.addEventListener('click', () => {
    const inp = document.getElementById('nova-senha');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    document.getElementById('toggle-nova-senha').textContent = inp.type === 'password' ? '👁️' : '🙈';
  });

  document.getElementById('btn-confirmar-troca')?.addEventListener('click', async () => {
    const nova  = document.getElementById('nova-senha').value;
    const conf  = document.getElementById('confirmar-senha').value;
    const erroEl = document.getElementById('troca-erro');
    erroEl.classList.add('hidden');

    if (!nova || !conf) { erroEl.textContent = 'Preencha os dois campos.'; erroEl.classList.remove('hidden'); return; }
    if (nova.length < 6) { erroEl.textContent = 'A senha deve ter no mínimo 6 caracteres.'; erroEl.classList.remove('hidden'); return; }
    if (nova !== conf)   { erroEl.textContent = 'As senhas não conferem.'; erroEl.classList.remove('hidden'); return; }

    const btn = document.getElementById('btn-confirmar-troca');
    btn.disabled = true; btn.textContent = 'Salvando...';

    try {
      await updatePassword(usuarioAtual, nova);
      await updateDoc(doc(db, 'usuarios', usuarioAtual.uid), { trocarSenha: false });
      overlay.remove();
      toast('Senha definida com sucesso!', 'success');
      init();
    } catch (e) {
      erroEl.textContent = e.code === 'auth/requires-recent-login'
        ? 'Sessão expirada. Faça login novamente.'
        : `Erro: ${e.message}`;
      erroEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Definir nova senha e continuar';
    }
  });
}

// ---------- Logout ----------
document.getElementById('btn-logout')?.addEventListener('click', () => {
  signOut(auth).then(() => window.location.href = 'login.html');
});

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.dataset.tab;
    document.getElementById(tabId)?.classList.add('active');
    if (tabId === 'tab-dashboard') renderizarDashboard();
  });
});

// ---------- Inicialização ----------
async function init() {
  try {
    await Promise.all([carregarSecoes(), carregarItens(), carregarPlacas()]);
    await Promise.all([carregarChecklists(), carregarUsuarios()]);
    renderizarEstatisticas();
  } catch (e) {
    console.error('Erro na inicialização:', e);
    toast('Erro ao inicializar o painel. Recarregue a página.', 'error');
  }
}

// ============================================================
// CHECKLISTS / HISTÓRICO
// ============================================================
async function carregarChecklists() {
  const loading = document.getElementById('hist-loading');
  loading?.classList.remove('hidden');
  try {
    const snap = await getDocs(query(collection(db, 'checklists'), orderBy('criadoEm', 'desc')));
    checklists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarHistorico(checklists);
  } catch (e) {
    console.error('Erro checklists:', e);
    toast('Erro ao carregar histórico.', 'error');
  } finally {
    loading?.classList.add('hidden');
  }
}

function renderizarHistorico(lista) {
  const el    = document.getElementById('hist-lista');
  const empty = document.getElementById('hist-empty');
  if (!el) return;
  if (lista.length === 0) {
    el.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  el.innerHTML = lista.map(c => `
    <div class="historico-item" onclick="verDetalhe('${c.id}')">
      <div class="historico-info">
        <div class="historico-placa">${c.placa}</div>
        <div class="historico-meta">👤 ${c.motorista} &nbsp;•&nbsp; 📅 ${formatarDataHora(c.criadoEm)}</div>
      </div>
      <div class="historico-right">
        <span class="badge badge-${c.resultado}">${c.resultado === 'aprovado' ? '✅ Aprovado' : '❌ Reprovado'}</span>
        <span style="font-size:12px;color:var(--cor-texto-3)">${c.percentual ?? 0}% conformidade</span>
      </div>
    </div>`).join('');
}

window.verDetalhe = async (id) => {
  const c = checklists.find(x => x.id === id);
  if (!c) return;
  checklistDetalhe = c;

  document.getElementById('det-placa').textContent      = c.placa;
  document.getElementById('det-motorista').textContent  = c.motorista;
  document.getElementById('det-datahora').textContent   = formatarDataHora(c.criadoEm);
  document.getElementById('det-resultado').innerHTML    =
    `<span class="badge badge-${c.resultado}">${c.resultado === 'aprovado' ? '✅ Aprovado' : '❌ Reprovado'}</span>`;
  document.getElementById('det-percentual').textContent = `${c.percentual ?? 0}% de conformidade`;

  const container = document.getElementById('det-itens');
  container.innerHTML = '';
  for (const secao of secoes) {
    const itensSecao = itens.filter(i => i.secaoId === secao.id).sort((a, b) => a.ordem - b.ordem);
    if (!itensSecao.length) continue;
    container.innerHTML += `<div class="secao-detalhe-titulo">${secao.nome}</div>`;
    for (const item of itensSecao) {
      const resp = c.respostas?.[item.id];
      const obs  = c.observacoes?.[item.id] || '';
      const statusMap = { c: '✅ Conforme', nc: '❌ Não Conforme', na: '🚫 N/A' };
      const badgeMap  = { c: 'badge-aprovado', nc: 'badge-reprovado', na: 'badge-na' };
      container.innerHTML += `
        <div class="detalhe-item">
          <div class="detalhe-item-header">
            <span class="item-numero">#${String(item.numero).padStart(2,'0')}</span>
            <span class="detalhe-item-nome">${item.nome}${item.impeditivo ? ' <span class="badge badge-imp" style="font-size:10px">Imp.</span>' : ''}</span>
            <span class="badge ${badgeMap[resp] || 'badge-na'}">${statusMap[resp] || '—'}</span>
          </div>
          ${obs ? `<div class="detalhe-item-obs">📝 ${obs}</div>` : ''}
        </div>`;
    }
  }
  abrirModal('modal-detalhe');
};

document.getElementById('btn-det-pdf')?.addEventListener('click', () => {
  if (!checklistDetalhe) return;
  exportarPDF(gerarHTMLPDF(checklistDetalhe, itens, secoes), `checklist-${checklistDetalhe.placa}`);
});

// Filtros histórico
['filtro-busca','filtro-resultado','filtro-placa-hist'].forEach(id => {
  document.getElementById(id)?.addEventListener(id === 'filtro-resultado' ? 'change' : 'input', aplicarFiltros);
});

function aplicarFiltros() {
  const busca     = (document.getElementById('filtro-busca')?.value || '').toLowerCase();
  const resultado = document.getElementById('filtro-resultado')?.value || '';
  const placa     = (document.getElementById('filtro-placa-hist')?.value || '').toUpperCase();
  renderizarHistorico(checklists.filter(c =>
    (!busca     || c.motorista?.toLowerCase().includes(busca) || c.placa?.includes(busca.toUpperCase())) &&
    (!resultado || c.resultado === resultado) &&
    (!placa     || c.placa?.includes(placa))
  ));
}

function renderizarEstatisticas() {
  const total   = checklists.length;
  const aprov   = checklists.filter(c => c.resultado === 'aprovado').length;
  document.getElementById('stat-total-val').textContent    = total;
  document.getElementById('stat-aprovado-val').textContent = aprov;
  document.getElementById('stat-reprovado-val').textContent = total - aprov;
}

// ============================================================
// DASHBOARD
// ============================================================
function renderizarDashboard() {
  const tipo = document.getElementById('dash-filtro-tipo')?.value || 'mes';
  const lista = filtrarChecklistsDash(tipo);
  renderizarKPIs(lista);
  renderizarGraficoDonut(lista);
  renderizarGraficoLinha(tipo);
  renderizarNaoConformes(lista);
}

function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return isNaN(d) ? null : d;
}

function filtrarChecklistsDash(tipo) {
  const agora = new Date();
  if (tipo === 'mes') {
    const mes = parseInt(document.getElementById('dash-mes')?.value || agora.getMonth() + 1);
    const ano = parseInt(document.getElementById('dash-ano')?.value || agora.getFullYear());
    return checklists.filter(c => {
      const d = toDate(c.criadoEm);
      return d && d.getMonth() + 1 === mes && d.getFullYear() === ano;
    });
  }
  const de  = document.getElementById('dash-de')?.value;
  const ate = document.getElementById('dash-ate')?.value;
  if (!de || !ate) return checklists;
  const deDt  = new Date(de + 'T00:00:00');
  const ateDt = new Date(ate + 'T23:59:59');
  return checklists.filter(c => { const d = toDate(c.criadoEm); return d && d >= deDt && d <= ateDt; });
}

function renderizarKPIs(lista) {
  const total = lista.length;
  const aprov = lista.filter(c => c.resultado === 'aprovado').length;
  const repr  = total - aprov;
  const taxa  = total > 0 ? Math.round((aprov / total) * 100) : 0;
  const media = total > 0 ? Math.round(lista.reduce((s,c) => s + (c.percentual ?? 0), 0) / total) : 0;
  let imp = 0;
  for (const c of lista) {
    if (c.resultado === 'reprovado' && itens.some(i => i.impeditivo && c.respostas?.[i.id] === 'nc')) imp++;
  }
  document.getElementById('dash-kpi-total').textContent = total;
  document.getElementById('dash-kpi-aprov').textContent = taxa + '%';
  document.getElementById('dash-kpi-repr').textContent  = repr;
  document.getElementById('dash-kpi-media').textContent = media + '%';
  document.getElementById('dash-kpi-imp').textContent   = imp;
  document.getElementById('dash-kpi-sub-aprov').textContent = `${aprov} de ${total} inspeções`;
  document.getElementById('dash-kpi-sub-repr').textContent  = `${repr} reprovações no período`;
}

function renderizarGraficoDonut(lista) {
  const ctx = document.getElementById('chart-donut')?.getContext('2d');
  if (!ctx) return;
  if (chartDonut) { chartDonut.destroy(); chartDonut = null; }
  const aprov = lista.filter(c => c.resultado === 'aprovado').length;
  const repr  = lista.length - aprov;
  if (lista.length === 0) return;
  chartDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Aprovados', 'Reprovados'],
      datasets: [{ data: [aprov, repr], backgroundColor: ['#00A87A','#E0304A'], borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, font: { size: 13, family:'Inter' }, color:'#4B5278', usePointStyle:true } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} (${lista.length > 0 ? Math.round(ctx.parsed/lista.length*100) : 0}%)` } }
      }
    }
  });
}

function renderizarGraficoLinha(tipo) {
  const ctx = document.getElementById('chart-linha')?.getContext('2d');
  if (!ctx) return;
  if (chartLine) { chartLine.destroy(); chartLine = null; }

  let labels = [], dadosAprov = [], dadosRepr = [];

  if (tipo === 'mes') {
    const mes = parseInt(document.getElementById('dash-mes')?.value || new Date().getMonth() + 1);
    const ano = parseInt(document.getElementById('dash-ano')?.value || new Date().getFullYear());
    const dias = new Date(ano, mes, 0).getDate();
    for (let d = 1; d <= dias; d++) {
      const do_ = new Date(ano, mes-1, d, 0,0,0);
      const at_ = new Date(ano, mes-1, d, 23,59,59);
      const g   = checklists.filter(c => { const cd = toDate(c.criadoEm); return cd && cd >= do_ && cd <= at_; });
      labels.push(String(d));
      dadosAprov.push(g.filter(c => c.resultado === 'aprovado').length);
      dadosRepr.push(g.filter(c => c.resultado === 'reprovado').length);
    }
  } else {
    const de  = document.getElementById('dash-de')?.value;
    const ate = document.getElementById('dash-ate')?.value;
    if (!de || !ate) return;
    const deDt = new Date(de + 'T00:00:00');
    const dias = Math.min(Math.ceil((new Date(ate+'T23:59:59') - deDt) / 86400000) + 1, 62);
    for (let i = 0; i < dias; i++) {
      const d   = new Date(deDt); d.setDate(d.getDate() + i);
      const do_ = new Date(d); do_.setHours(0,0,0,0);
      const at_ = new Date(d); at_.setHours(23,59,59,999);
      const g   = checklists.filter(c => { const cd = toDate(c.criadoEm); return cd && cd >= do_ && cd <= at_; });
      labels.push(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`);
      dadosAprov.push(g.filter(c => c.resultado === 'aprovado').length);
      dadosRepr.push(g.filter(c => c.resultado === 'reprovado').length);
    }
  }

  chartLine = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Aprovados', data: dadosAprov, backgroundColor:'rgba(0,168,122,0.75)', borderRadius:4, borderSkipped:false },
        { label:'Reprovados', data: dadosRepr, backgroundColor:'rgba(224,48,74,0.75)', borderRadius:4, borderSkipped:false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      scales: {
        x: { stacked:true, grid:{display:false}, ticks:{font:{size:11}, color:'#8892B0', maxTicksLimit:15, maxRotation:45} },
        y: { stacked:true, beginAtZero:true, ticks:{font:{size:11}, color:'#8892B0', stepSize:1}, grid:{color:'#DDE1EE'} }
      },
      plugins: { legend:{ position:'bottom', labels:{font:{size:13,family:'Inter'}, color:'#4B5278', usePointStyle:true} } }
    }
  });
}

function renderizarNaoConformes(lista) {
  const el = document.getElementById('dash-nc-lista');
  if (!el) return;
  if (lista.length === 0) { el.innerHTML = `<div class="dash-empty">📭 Nenhuma inspeção no período selecionado.</div>`; return; }

  const contagem = {};
  for (const c of lista) {
    for (const [itemId, resp] of Object.entries(c.respostas || {})) {
      if (resp === 'nc') contagem[itemId] = (contagem[itemId] || 0) + 1;
    }
  }
  if (!Object.keys(contagem).length) { el.innerHTML = `<div class="dash-empty">✅ Nenhum item não conforme no período!</div>`; return; }

  const ranking = Object.entries(contagem)
    .map(([id, qty]) => ({ item: itens.find(i => i.id === id), qty }))
    .filter(x => x.item)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const maxQty = ranking[0]?.qty || 1;
  el.innerHTML = ranking.map(({ item, qty }, idx) => {
    const pct  = Math.round((qty / lista.length) * 100);
    const cls  = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
    return `
    <div class="dash-nc-item">
      <div class="dash-nc-rank ${cls}">${idx+1}</div>
      <div class="dash-nc-info">
        <div class="dash-nc-nome" title="${item.nome}">#${String(item.numero).padStart(2,'0')} — ${item.nome}</div>
        <div style="font-size:11px;color:var(--cor-texto-3);margin-top:2px">${item.impeditivo?'⛔ Impeditivo':'✅ Não impeditivo'} • ${pct}% das inspeções</div>
      </div>
      <div class="dash-nc-bar-wrap">
        <div class="dash-nc-bar-bg"><div class="dash-nc-bar" style="width:${Math.round((qty/maxQty)*100)}%"></div></div>
        <div class="dash-nc-count">${qty}</div>
      </div>
    </div>`;
  }).join('');
}

// Eventos filtros dashboard
document.getElementById('dash-filtro-tipo')?.addEventListener('change', function() {
  const tipo = this.value;
  const fMes    = document.getElementById('dash-filtros-mes');
  const fCustom = document.getElementById('dash-filtros-custom');
  if (fMes)    fMes.style.display    = tipo === 'mes'    ? 'flex' : 'none';
  if (fCustom) fCustom.style.display = tipo === 'custom' ? 'flex' : 'none';
  renderizarDashboard();
});
['dash-mes','dash-ano','dash-de','dash-ate'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', renderizarDashboard);
});

// ============================================================
// PLACAS
// ============================================================
async function carregarPlacas() {
  try {
    const snap = await getDocs(query(collection(db, 'placas'), orderBy('placa')));
    placas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarPlacas();
  } catch (e) { console.error('Erro placas:', e); toast('Erro ao carregar placas.', 'error'); }
}

function renderizarPlacas() {
  const el = document.getElementById('lista-placas');
  if (!el) return;
  if (!placas.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">🚗</div><p>Nenhuma placa cadastrada.</p></div>`; return; }
  el.innerHTML = placas.map(p => `
    <div class="item-lista ${p.ativo ? '' : 'inativo'}">
      <div class="item-lista-info">
        <div class="placa-chip ${p.ativo ? '' : 'inativa'}">🚗 ${p.placa}</div>
        <div class="item-lista-meta" style="margin-top:6px">
          ${p.ativo ? '<span class="badge badge-aprovado">Ativa</span>' : '<span class="badge badge-reprovado">Inativa</span>'}
          <span style="font-size:12px;color:var(--cor-texto-3)">Cadastrada em ${formatarDataHora(p.criadoEm)}</span>
        </div>
      </div>
      <div class="item-lista-actions">
        <button class="btn btn-ghost btn-sm" onclick="editarPlaca('${p.id}')">✏️ Editar</button>
        <button class="btn btn-sm ${p.ativo ? 'btn-danger' : 'btn-ghost'}" onclick="togglePlaca('${p.id}', ${p.ativo})">
          ${p.ativo ? '🔒 Inativar' : '🔓 Ativar'}
        </button>
      </div>
    </div>`).join('');
}

document.getElementById('btn-add-placa')?.addEventListener('click', () => {
  document.getElementById('modal-placa-titulo').textContent = 'Nova Placa';
  document.getElementById('placa-id').value    = '';
  document.getElementById('placa-input').value = '';
  abrirModal('modal-placa');
});

window.editarPlaca = (id) => {
  const p = placas.find(x => x.id === id);
  if (!p) return;
  document.getElementById('modal-placa-titulo').textContent = 'Editar Placa';
  document.getElementById('placa-id').value    = p.id;
  document.getElementById('placa-input').value = p.placa;
  abrirModal('modal-placa');
};

document.getElementById('btn-salvar-placa')?.addEventListener('click', async () => {
  const id    = document.getElementById('placa-id').value;
  const placa = normalizarPlaca(document.getElementById('placa-input').value);
  if (!validarPlaca(placa)) { toast('Formato inválido. Use ABC1234 ou ABC1D23.', 'error'); return; }
  if (placas.find(p => p.placa === placa && p.id !== id)) { toast('Placa já cadastrada.', 'error'); return; }
  try {
    if (id) { await updateDoc(doc(db, 'placas', id), { placa }); toast('Placa atualizada!', 'success'); }
    else    { await addDoc(collection(db, 'placas'), { placa, ativo: true, criadoEm: serverTimestamp() }); toast('Placa cadastrada!', 'success'); }
    fecharModal('modal-placa');
    await carregarPlacas();
  } catch (e) { toast('Erro ao salvar placa.', 'error'); }
});

window.togglePlaca = async (id, ativo) => {
  if (!confirmar(`Deseja ${ativo ? 'inativar' : 'ativar'} esta placa?`)) return;
  try {
    await updateDoc(doc(db, 'placas', id), { ativo: !ativo });
    toast(`Placa ${ativo ? 'inativada' : 'ativada'}!`, 'success');
    await carregarPlacas();
  } catch (e) { toast('Erro ao alterar status.', 'error'); }
};

// ============================================================
// ITENS DO CHECKLIST
// ============================================================
async function carregarSecoes() {
  try {
    const snap = await getDocs(query(collection(db, 'secoes'), orderBy('ordem')));
    secoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sel = document.getElementById('item-secao');
    if (sel) sel.innerHTML = secoes.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
  } catch (e) { console.error('Erro seções:', e); }
}

async function carregarItens() {
  try {
    const snap = await getDocs(query(collection(db, 'itens'), orderBy('ordem')));
    itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarItens();
  } catch (e) { console.error('Erro itens:', e); toast('Erro ao carregar itens.', 'error'); }
}

function renderizarItens() {
  const el = document.getElementById('lista-itens-config');
  if (!el) return;
  if (!itens.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Nenhum item cadastrado.</p></div>`; return; }
  let html = '';
  for (const secao of secoes) {
    const itensSecao = itens.filter(i => i.secaoId === secao.id).sort((a,b) => a.ordem - b.ordem);
    if (!itensSecao.length) continue;
    html += `<div class="secao-titulo" style="margin-top:16px"><div class="secao-numero">${secao.ordem}</div>${secao.nome}</div>`;
    for (const item of itensSecao) {
      html += `
        <div class="item-lista ${item.ativo ? '' : 'inativo'}">
          <div class="item-lista-info">
            <div class="item-lista-nome">#${String(item.numero).padStart(2,'0')} — ${item.nome}</div>
            <div class="item-lista-meta">
              ${item.impeditivo ? '<span class="badge badge-imp">⛔ Impeditivo</span>' : '<span class="badge" style="background:rgba(0,168,122,.1);color:#00A87A">✅ Não Impeditivo</span>'}
              ${item.permiteNaoAplica ? '<span class="badge badge-na">Permite N/A</span>' : ''}
              ${item.ativo ? '' : '<span class="badge badge-reprovado">Inativo</span>'}
            </div>
          </div>
          <div class="item-lista-actions">
            <button class="btn btn-ghost btn-sm" onclick="editarItem('${item.id}')">✏️</button>
            <button class="btn btn-sm ${item.ativo ? 'btn-danger' : 'btn-ghost'}" onclick="toggleItem('${item.id}', ${item.ativo})">
              ${item.ativo ? '🔒' : '🔓'}
            </button>
          </div>
        </div>`;
    }
  }
  el.innerHTML = html;
}

document.getElementById('btn-add-item')?.addEventListener('click', () => {
  document.getElementById('modal-item-titulo').textContent = 'Novo Item';
  ['item-id','item-nome','item-param','item-numero'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('item-impeditivo').checked = false;
  document.getElementById('item-na').checked = false;
  abrirModal('modal-item');
});

window.editarItem = (id) => {
  const item = itens.find(x => x.id === id);
  if (!item) return;
  document.getElementById('modal-item-titulo').textContent = 'Editar Item';
  document.getElementById('item-id').value       = item.id;
  document.getElementById('item-nome').value     = item.nome;
  document.getElementById('item-param').value    = item.parametro;
  document.getElementById('item-numero').value   = item.numero;
  document.getElementById('item-secao').value    = item.secaoId;
  document.getElementById('item-impeditivo').checked = item.impeditivo;
  document.getElementById('item-na').checked         = item.permiteNaoAplica;
  abrirModal('modal-item');
};

document.getElementById('btn-salvar-item')?.addEventListener('click', async () => {
  const id        = document.getElementById('item-id').value;
  const nome      = document.getElementById('item-nome').value.trim();
  const parametro = document.getElementById('item-param').value.trim();
  const numero    = parseInt(document.getElementById('item-numero').value);
  const secaoId   = document.getElementById('item-secao').value;
  const impeditivo      = document.getElementById('item-impeditivo').checked;
  const permiteNaoAplica = document.getElementById('item-na').checked;

  if (!nome || !parametro || !numero || !secaoId) { toast('Preencha todos os campos.', 'error'); return; }
  const ordem = itens.filter(i => i.secaoId === secaoId && i.id !== id).length + 1;
  const dados = { nome, parametro, numero, secaoId, impeditivo, permiteNaoAplica, ordem, ativo: true };
  try {
    if (id) { await updateDoc(doc(db, 'itens', id), dados); toast('Item atualizado!', 'success'); }
    else    { await addDoc(collection(db, 'itens'), { ...dados, criadoEm: serverTimestamp() }); toast('Item adicionado!', 'success'); }
    fecharModal('modal-item');
    await carregarItens();
  } catch (e) { toast('Erro ao salvar item.', 'error'); }
});

window.toggleItem = async (id, ativo) => {
  if (!confirmar(`Deseja ${ativo ? 'remover' : 'reativar'} este item?`)) return;
  try {
    await updateDoc(doc(db, 'itens', id), { ativo: !ativo });
    toast(`Item ${ativo ? 'removido' : 'reativado'}!`, 'success');
    await carregarItens();
  } catch (e) { toast('Erro ao alterar item.', 'error'); }
};

// ============================================================
// USUÁRIOS
// ============================================================
async function carregarUsuarios() {
  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), orderBy('criadoEm', 'desc')));
    usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarUsuarios();
  } catch (e) { console.error('Erro usuários:', e); toast('Erro ao carregar usuários.', 'error'); }
}

function renderizarUsuarios() {
  const el = document.getElementById('lista-usuarios');
  if (!el) return;
  if (!usuarios.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><p>Nenhum usuário cadastrado ainda.</p><p style="font-size:13px;color:var(--cor-texto-3);margin-top:8px">O primeiro admin deve ser criado pelo console do Firebase.</p></div>`;
    return;
  }
  el.innerHTML = usuarios.map(u => {
    const eVoce = u.email === usuarioAtual?.email;
    return `
    <div class="item-lista ${u.ativo ? '' : 'inativo'}">
      <div class="item-lista-info">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--cor-primaria-dim);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">👤</div>
          <div>
            <div style="font-weight:600;font-size:14px;color:var(--cor-texto)">${u.nome || '—'}</div>
            <div style="font-size:12px;color:var(--cor-texto-3);font-family:'JetBrains Mono',monospace">${u.email}</div>
          </div>
        </div>
        <div class="item-lista-meta" style="margin-top:10px;padding-left:46px">
          ${u.ativo ? '<span class="badge badge-aprovado">✅ Ativo</span>' : '<span class="badge badge-reprovado">🔒 Inativo</span>'}
          ${eVoce ? '<span class="badge" style="background:var(--cor-primaria-dim);color:var(--cor-primaria)">Você</span>' : ''}
          ${u.trocarSenha ? '<span class="badge badge-alerta">⏳ Aguardando troca de senha</span>' : ''}
          <span style="font-size:12px;color:var(--cor-texto-3)">Criado em ${formatarDataHora(u.criadoEm)}</span>
        </div>
      </div>
      <div class="item-lista-actions">
        <button class="btn btn-ghost btn-sm" onclick="enviarResetSenha('${u.email}')">🔑 Reset</button>
        ${eVoce ? '' : `<button class="btn btn-sm ${u.ativo ? 'btn-danger' : 'btn-ghost'}" onclick="toggleUsuario('${u.id}', ${u.ativo}, '${u.email}')">${u.ativo ? '🔒 Inativar' : '🔓 Ativar'}</button>`}
      </div>
    </div>`;
  }).join('');
}

document.getElementById('btn-add-usuario')?.addEventListener('click', () => {
  ['usuario-nome','usuario-email','usuario-senha'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('usuario-modal-erro')?.classList.add('hidden');
  abrirModal('modal-usuario');
});

document.getElementById('btn-salvar-usuario')?.addEventListener('click', async () => {
  const nome   = document.getElementById('usuario-nome').value.trim();
  const email  = document.getElementById('usuario-email').value.trim().toLowerCase();
  const senha  = document.getElementById('usuario-senha').value;
  const erroEl = document.getElementById('usuario-modal-erro');
  erroEl?.classList.add('hidden');

  if (!nome || !email || !senha) { erroEl.textContent = 'Preencha todos os campos.'; erroEl.classList.remove('hidden'); return; }
  if (senha.length < 6) { erroEl.textContent = 'Senha mínima: 6 caracteres.'; erroEl.classList.remove('hidden'); return; }

  const btn = document.getElementById('btn-salvar-usuario');
  btn.disabled = true; btn.textContent = 'Criando...';

  try {
    const adminUid = usuarioAtual.uid;
    const cred     = await createUserWithEmailAndPassword(auth, email, senha);
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      uid: cred.user.uid, nome, email, ativo: true,
      trocarSenha: true, criadoEm: serverTimestamp(), criadoPor: adminUid
    });
    toast(`Usuário ${nome} criado! Redirecionando para reautenticar...`, 'success');
    fecharModal('modal-usuario');
    await carregarUsuarios();
    setTimeout(async () => { await signOut(auth); window.location.href = 'login.html?msg=usuario-criado'; }, 2000);
  } catch (e) {
    const msgs = { 'auth/email-already-in-use':'E-mail já em uso.', 'auth/invalid-email':'E-mail inválido.', 'auth/weak-password':'Senha fraca.' };
    erroEl.textContent = msgs[e.code] || `Erro: ${e.message}`;
    erroEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Criar Usuário';
  }
});

window.toggleUsuario = async (id, ativo, email) => {
  if (email === usuarioAtual?.email) { toast('Você não pode inativar a si mesmo.', 'error'); return; }
  if (!confirmar(`Deseja ${ativo ? 'inativar' : 'ativar'} o usuário ${email}?`)) return;
  try {
    await updateDoc(doc(db, 'usuarios', id), { ativo: !ativo });
    toast(`Usuário ${ativo ? 'inativado' : 'ativado'}!`, 'success');
    await carregarUsuarios();
  } catch (e) { toast('Erro ao alterar status.', 'error'); }
};

window.enviarResetSenha = async (email) => {
  if (!confirmar(`Enviar link de redefinição para ${email}?`)) return;
  try { await sendPasswordResetEmail(auth, email); toast(`Link enviado para ${email}`, 'success'); }
  catch (e) { toast('Erro ao enviar e-mail.', 'error'); }
};

document.getElementById('toggle-usuario-senha')?.addEventListener('click', () => {
  const inp = document.getElementById('usuario-senha');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  document.getElementById('toggle-usuario-senha').textContent = inp.type === 'password' ? '👁️' : '🙈';
});

// ============================================================
// FECHAR MODAIS
// ============================================================
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => btn.closest('.modal-backdrop')?.classList.add('hidden'));
});
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.classList.add('hidden'); });
});

// Msg pós criação de usuário
if (new URLSearchParams(window.location.search).get('msg') === 'usuario-criado') {
  history.replaceState({}, '', window.location.pathname);
  setTimeout(() => toast('Usuário criado! Bem-vindo de volta.', 'success'), 800);
}
