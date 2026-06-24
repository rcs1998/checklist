// ============================================================
// ADMIN.JS — Resultados, Placas, Itens, Usuários e Dashboard
// ============================================================
import { db, auth, app } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, serverTimestamp, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updatePassword,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  toast, abrirModal, fecharModal, confirmar,
  formatarDataHora, normalizarPlaca, validarPlaca,
  exportarPDF, gerarHTMLPDF
} from "./utils.js";

// ---------- Estado ----------
let secoes = [];
let itens  = [];
let placas = [];
let checklists = [];
let usuarios = [];
let checklistDetalhe = null;
let usuarioAtual = null;

// ---------- Guard de autenticação ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  usuarioAtual = user;
  document.getElementById('user-email').textContent = user.email;

  // Verificar se precisa trocar senha no primeiro acesso
  const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
  if (userDoc.exists() && userDoc.data().trocarSenha === true) {
    mostrarTrocaSenha();
    return;
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
      <div id="troca-erro" class="hidden" style="
        background:var(--cor-reprovado-dim);border:1px solid var(--cor-reprovado);
        color:var(--cor-reprovado);border-radius:var(--radius-sm);
        padding:10px 14px;font-size:13px;margin-bottom:16px;
      "></div>
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
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('toggle-nova-senha')?.addEventListener('click', () => {
    const inp = document.getElementById('nova-senha');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    document.getElementById('toggle-nova-senha').textContent = inp.type === 'password' ? '👁️' : '🙈';
  });

  document.getElementById('btn-confirmar-troca')?.addEventListener('click', async () => {
    const nova = document.getElementById('nova-senha').value;
    const conf = document.getElementById('confirmar-senha').value;
    const erroEl = document.getElementById('troca-erro');
    erroEl.classList.add('hidden');

    if (!nova || !conf) {
      erroEl.textContent = 'Preencha os dois campos.';
      erroEl.classList.remove('hidden');
      return;
    }
    if (nova.length < 6) {
      erroEl.textContent = 'A senha deve ter no mínimo 6 caracteres.';
      erroEl.classList.remove('hidden');
      return;
    }
    if (nova !== conf) {
      erroEl.textContent = 'As senhas não conferem.';
      erroEl.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('btn-confirmar-troca');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      await updatePassword(usuarioAtual, nova);
      await updateDoc(doc(db, 'usuarios', usuarioAtual.uid), { trocarSenha: false });
      overlay.remove();
      toast('Senha definida com sucesso! Bem-vindo ao sistema.', 'success');
      init();
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        erroEl.textContent = 'Sessão expirada. Faça login novamente para redefinir a senha.';
      } else {
        erroEl.textContent = `Erro: ${e.message}`;
      }
      erroEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Definir nova senha e continuar';
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
  await Promise.all([carregarSecoes(), carregarItens(), carregarPlacas()]);
  await Promise.all([carregarChecklists(), carregarUsuarios()]);
  renderizarEstatisticas();
}

// ============================================================
// CHECKLISTS / HISTÓRICO
// ============================================================
async function carregarChecklists() {
  const loading = document.getElementById('hist-loading');
  const lista   = document.getElementById('hist-lista');
  loading?.classList.remove('hidden');

  try {
    const snap = await getDocs(query(collection(db, 'checklists'), orderBy('criadoEm', 'desc')));
    checklists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarHistorico(checklists);
  } catch (e) {
    toast('Erro ao carregar histórico.', 'error');
  } finally {
    loading?.classList.add('hidden');
  }
}

function renderizarHistorico(lista) {
  const el = document.getElementById('hist-lista');
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
        <div class="historico-meta">
          👤 ${c.motorista} &nbsp;•&nbsp; 📅 ${formatarDataHora(c.criadoEm)}
        </div>
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

  document.getElementById('det-placa').textContent     = c.placa;
  document.getElementById('det-motorista').textContent = c.motorista;
  document.getElementById('det-datahora').textContent  = formatarDataHora(c.criadoEm);
  document.getElementById('det-resultado').innerHTML   =
    `<span class="badge badge-${c.resultado}">${c.resultado === 'aprovado' ? '✅ Aprovado' : '❌ Reprovado'}</span>`;
  document.getElementById('det-percentual').textContent = `${c.percentual ?? 0}% de conformidade`;

  const container = document.getElementById('det-itens');
  container.innerHTML = '';

  for (const secao of secoes) {
    const itensSecao = itens.filter(i => i.secaoId === secao.id).sort((a,b) => a.ordem - b.ordem);
    if (itensSecao.length === 0) continue;
    container.innerHTML += `<div class="secao-detalhe-titulo">${secao.nome}</div>`;

    for (const item of itensSecao) {
      const resp = c.respostas?.[item.id];
      const obs  = c.observacoes?.[item.id] || '';
      const statusMap = { c: '✅ Conforme', nc: '❌ Não Conforme', na: '🚫 Não se Aplica' };
      const badgeMap  = { c: 'badge-aprovado', nc: 'badge-reprovado', na: 'badge-na' };
      container.innerHTML += `
        <div class="detalhe-item">
          <div class="detalhe-item-header">
            <span class="item-numero">#${String(item.numero).padStart(2,'0')}</span>
            <span class="detalhe-item-nome">${item.nome}${item.impeditivo ? ' <span class="badge badge-imp" style="font-size:10px">Impeditivo</span>' : ''}</span>
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
  const html = gerarHTMLPDF(checklistDetalhe, itens, secoes);
  exportarPDF(html, `checklist-${checklistDetalhe.placa}-${checklistDetalhe.id}`);
});

// Filtros
document.getElementById('filtro-busca')?.addEventListener('input', aplicarFiltros);
document.getElementById('filtro-resultado')?.addEventListener('change', aplicarFiltros);
document.getElementById('filtro-placa-hist')?.addEventListener('input', aplicarFiltros);

function aplicarFiltros() {
  const busca     = document.getElementById('filtro-busca')?.value.toLowerCase() || '';
  const resultado = document.getElementById('filtro-resultado')?.value || '';
  const placa     = document.getElementById('filtro-placa-hist')?.value.toUpperCase() || '';
  const filtrado = checklists.filter(c => {
    const matchBusca     = !busca || c.motorista?.toLowerCase().includes(busca) || c.placa?.includes(busca.toUpperCase());
    const matchResultado = !resultado || c.resultado === resultado;
    const matchPlaca     = !placa || c.placa?.includes(placa);
    return matchBusca && matchResultado && matchPlaca;
  });
  renderizarHistorico(filtrado);
}

// ---------- Estatísticas ----------
function renderizarEstatisticas() {
  const total    = checklists.length;
  const aprovado = checklists.filter(c => c.resultado === 'aprovado').length;
  const reprovado = total - aprovado;
  document.getElementById('stat-total-val').textContent    = total;
  document.getElementById('stat-aprovado-val').textContent = aprovado;
  document.getElementById('stat-reprovado-val').textContent = reprovado;
}

// ============================================================
// DASHBOARD
// ============================================================
let chartDonut = null;
let chartLine  = null;

function renderizarDashboard() {
  const filtroTipo = document.getElementById('dash-filtro-tipo')?.value || 'mes';
  let checksFiltrados = filtrarChecklistsDash(filtroTipo);
  renderizarKPIs(checksFiltrados);
  renderizarGraficoDonut(checksFiltrados);
  renderizarGraficoLinha(filtroTipo);
  renderizarNaoConformes(checksFiltrados);
}

function filtrarChecklistsDash(tipo) {
  const agora = new Date();
  if (tipo === 'mes') {
    const mes  = parseInt(document.getElementById('dash-mes')?.value ?? agora.getMonth() + 1);
    const ano  = parseInt(document.getElementById('dash-ano')?.value ?? agora.getFullYear());
    return checklists.filter(c => {
      const d = toDate(c.criadoEm);
      return d && d.getMonth() + 1 === mes && d.getFullYear() === ano;
    });
  } else {
    const de  = document.getElementById('dash-de')?.value;
    const ate = document.getElementById('dash-ate')?.value;
    if (!de || !ate) return checklists;
    const deDt  = new Date(de + 'T00:00:00');
    const ateDt = new Date(ate + 'T23:59:59');
    return checklists.filter(c => {
      const d = toDate(c.criadoEm);
      return d && d >= deDt && d <= ateDt;
    });
  }
}

function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return isNaN(d) ? null : d;
}

function renderizarKPIs(lista) {
  const total = lista.length;
  const aprov = lista.filter(c => c.resultado === 'aprovado').length;
  const repr  = total - aprov;
  const taxaAprov = total > 0 ? Math.round((aprov / total) * 100) : 0;
  const mediaConf = total > 0
    ? Math.round(lista.reduce((s,c) => s + (c.percentual ?? 0), 0) / total)
    : 0;

  // Contar impedimentos (checklists reprovados com item impeditivo NC)
  let impeditivos = 0;
  for (const c of lista) {
    if (c.resultado === 'reprovado') {
      const temImp = itens.some(i => i.impeditivo && c.respostas?.[i.id] === 'nc');
      if (temImp) impeditivos++;
    }
  }

  document.getElementById('dash-kpi-total').textContent   = total;
  document.getElementById('dash-kpi-aprov').textContent   = taxaAprov + '%';
  document.getElementById('dash-kpi-repr').textContent    = repr;
  document.getElementById('dash-kpi-media').textContent   = mediaConf + '%';
  document.getElementById('dash-kpi-imp').textContent     = impeditivos;
  document.getElementById('dash-kpi-sub-aprov').textContent = `${aprov} de ${total} inspeções`;
  document.getElementById('dash-kpi-sub-repr').textContent  = `${repr} reprovações no período`;
  document.getElementById('dash-kpi-sub-media').textContent = 'Média de conformidade';
  document.getElementById('dash-kpi-sub-imp').textContent   = 'Por item impeditivo';
}

function renderizarGraficoDonut(lista) {
  const aprov = lista.filter(c => c.resultado === 'aprovado').length;
  const repr  = lista.length - aprov;

  const ctx = document.getElementById('chart-donut')?.getContext('2d');
  if (!ctx) return;

  if (chartDonut) chartDonut.destroy();

  if (lista.length === 0) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  chartDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Aprovados', 'Reprovados'],
      datasets: [{
        data: [aprov, repr],
        backgroundColor: ['#00A87A', '#E0304A'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            font: { size: 13, family: 'Inter' },
            color: '#4B5278',
            usePointStyle: true,
            pointStyleWidth: 10
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} (${Math.round(ctx.parsed / (aprov + repr) * 100)}%)`
          }
        }
      }
    }
  });
}

function renderizarGraficoLinha(tipo) {
  const ctx = document.getElementById('chart-linha')?.getContext('2d');
  if (!ctx) return;

  let labels = [];
  let dadosAprov = [];
  let dadosRepr  = [];

  if (tipo === 'mes') {
    const mes = parseInt(document.getElementById('dash-mes')?.value ?? new Date().getMonth() + 1);
    const ano = parseInt(document.getElementById('dash-ano')?.value ?? new Date().getFullYear());
    const diasNoMes = new Date(ano, mes, 0).getDate();

    for (let d = 1; d <= diasNoMes; d++) {
      const dt = new Date(ano, mes - 1, d);
      const do_ = new Date(ano, mes - 1, d, 0, 0, 0);
      const ate = new Date(ano, mes - 1, d, 23, 59, 59);
      const grupo = checklists.filter(c => {
        const cd = toDate(c.criadoEm);
        return cd && cd >= do_ && cd <= ate;
      });
      labels.push(d.toString());
      dadosAprov.push(grupo.filter(c => c.resultado === 'aprovado').length);
      dadosRepr.push(grupo.filter(c => c.resultado === 'reprovado').length);
    }
  } else {
    const de  = document.getElementById('dash-de')?.value;
    const ate = document.getElementById('dash-ate')?.value;
    if (!de || !ate) {
      if (chartLine) chartLine.destroy();
      return;
    }
    const deDt  = new Date(de + 'T00:00:00');
    const ateDt = new Date(ate + 'T23:59:59');
    const diff  = Math.ceil((ateDt - deDt) / (1000 * 60 * 60 * 24));
    const dias  = Math.min(diff + 1, 62);

    for (let i = 0; i < dias; i++) {
      const d = new Date(deDt);
      d.setDate(d.getDate() + i);
      const do_ = new Date(d); do_.setHours(0,0,0,0);
      const a   = new Date(d); a.setHours(23,59,59,999);
      const grupo = checklists.filter(c => {
        const cd = toDate(c.criadoEm); return cd && cd >= do_ && cd <= a;
      });
      labels.push(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`);
      dadosAprov.push(grupo.filter(c => c.resultado === 'aprovado').length);
      dadosRepr.push(grupo.filter(c => c.resultado === 'reprovado').length);
    }
  }

  if (chartLine) chartLine.destroy();

  chartLine = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Aprovados',
          data: dadosAprov,
          backgroundColor: 'rgba(0,168,122,0.75)',
          borderRadius: 4,
          borderSkipped: false
        },
        {
          label: 'Reprovados',
          data: dadosRepr,
          backgroundColor: 'rgba(224,48,74,0.75)',
          borderRadius: 4,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            font: { size: 11 },
            color: '#8892B0',
            maxTicksLimit: 15,
            maxRotation: 45
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { font: { size: 11 }, color: '#8892B0', stepSize: 1 },
          grid: { color: '#DDE1EE' }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 13, family: 'Inter' }, color: '#4B5278', usePointStyle: true }
        }
      }
    }
  });
}

function renderizarNaoConformes(lista) {
  const el = document.getElementById('dash-nc-lista');
  if (!el) return;

  if (lista.length === 0) {
    el.innerHTML = `<div class="dash-empty">📭 Nenhuma inspeção no período selecionado.</div>`;
    return;
  }

  // Contar NCs por item
  const contagem = {};
  for (const c of lista) {
    for (const [itemId, resp] of Object.entries(c.respostas || {})) {
      if (resp === 'nc') {
        contagem[itemId] = (contagem[itemId] || 0) + 1;
      }
    }
  }

  if (Object.keys(contagem).length === 0) {
    el.innerHTML = `<div class="dash-empty">✅ Nenhum item não conforme no período!</div>`;
    return;
  }

  const rankingItems = Object.entries(contagem)
    .map(([id, qty]) => ({ item: itens.find(i => i.id === id), qty }))
    .filter(x => x.item)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const maxQty = rankingItems[0]?.qty || 1;

  el.innerHTML = rankingItems.map(({ item, qty }, idx) => {
    const pct = Math.round((qty / lista.length) * 100);
    const rankClass = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
    return `
    <div class="dash-nc-item">
      <div class="dash-nc-rank ${rankClass}">${idx + 1}</div>
      <div class="dash-nc-info">
        <div class="dash-nc-nome" title="${item.nome}">#${String(item.numero).padStart(2,'0')} — ${item.nome}</div>
        <div style="font-size:11px;color:var(--cor-texto-3);margin-top:2px">${item.impeditivo ? '⛔ Impeditivo' : '✅ Não impeditivo'} • ${pct}% das inspeções</div>
      </div>
      <div class="dash-nc-bar-wrap">
        <div class="dash-nc-bar-bg">
          <div class="dash-nc-bar" style="width:${Math.round((qty/maxQty)*100)}%"></div>
        </div>
        <div class="dash-nc-count">${qty}</div>
      </div>
    </div>`;
  }).join('');
}

// Eventos filtros dashboard
document.getElementById('dash-filtro-tipo')?.addEventListener('change', function() {
  const tipo = this.value;
  document.getElementById('dash-filtros-mes')?.classList.toggle('hidden', tipo !== 'mes');
  document.getElementById('dash-filtros-custom')?.classList.toggle('hidden', tipo !== 'custom');
  renderizarDashboard();
});

document.getElementById('dash-mes')?.addEventListener('change', renderizarDashboard);
document.getElementById('dash-ano')?.addEventListener('change', renderizarDashboard);
document.getElementById('dash-de')?.addEventListener('change', renderizarDashboard);
document.getElementById('dash-ate')?.addEventListener('change', renderizarDashboard);

// ============================================================
// PLACAS
// ============================================================
async function carregarPlacas() {
  try {
    const snap = await getDocs(query(collection(db, 'placas'), orderBy('placa')));
    placas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarPlacas();
  } catch (e) {
    toast('Erro ao carregar placas.', 'error');
  }
}

function renderizarPlacas() {
  const el = document.getElementById('lista-placas');
  if (!el) return;
  if (placas.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🚗</div><p>Nenhuma placa cadastrada ainda.</p></div>`;
    return;
  }
  el.innerHTML = placas.map(p => `
    <div class="item-lista ${p.ativo ? '' : 'inativo'}">
      <div class="item-lista-info">
        <div class="placa-chip ${p.ativo ? '' : 'inativa'}">🚗 ${p.placa}</div>
        <div class="item-lista-meta" style="margin-top:6px">
          ${p.ativo
            ? '<span class="badge badge-aprovado">Ativa</span>'
            : '<span class="badge badge-reprovado">Inativa</span>'}
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
  document.getElementById('placa-id').value = '';
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

  if (!validarPlaca(placa)) {
    toast('Formato de placa inválido. Use ABC1234 ou ABC1D23.', 'error');
    return;
  }
  const duplicata = placas.find(p => p.placa === placa && p.id !== id);
  if (duplicata) {
    toast('Essa placa já está cadastrada.', 'error');
    return;
  }
  try {
    if (id) {
      await updateDoc(doc(db, 'placas', id), { placa });
      toast('Placa atualizada!', 'success');
    } else {
      await addDoc(collection(db, 'placas'), { placa, ativo: true, criadoEm: serverTimestamp() });
      toast('Placa cadastrada!', 'success');
    }
    fecharModal('modal-placa');
    await carregarPlacas();
  } catch (e) {
    toast('Erro ao salvar placa.', 'error');
  }
});

window.togglePlaca = async (id, ativo) => {
  const acao = ativo ? 'inativar' : 'ativar';
  if (!confirmar(`Deseja ${acao} esta placa?`)) return;
  try {
    await updateDoc(doc(db, 'placas', id), { ativo: !ativo });
    toast(`Placa ${ativo ? 'inativada' : 'ativada'}!`, 'success');
    await carregarPlacas();
  } catch (e) {
    toast('Erro ao alterar status.', 'error');
  }
};

// ============================================================
// ITENS DO CHECKLIST
// ============================================================
async function carregarSecoes() {
  try {
    const snap = await getDocs(query(collection(db, 'secoes'), orderBy('ordem')));
    secoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sel = document.getElementById('item-secao');
    if (sel) {
      sel.innerHTML = secoes.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
    }
  } catch (e) {
    console.error(e);
  }
}

async function carregarItens() {
  try {
    const snap = await getDocs(query(collection(db, 'itens'), orderBy('ordem')));
    itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarItens();
  } catch (e) {
    toast('Erro ao carregar itens.', 'error');
  }
}

function renderizarItens() {
  const el = document.getElementById('lista-itens-config');
  if (!el) return;
  if (itens.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Nenhum item cadastrado.</p></div>`;
    return;
  }
  let html = '';
  for (const secao of secoes) {
    const itensSecao = itens.filter(i => i.secaoId === secao.id).sort((a,b) => a.ordem - b.ordem);
    if (itensSecao.length === 0) continue;
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
  document.getElementById('item-id').value         = '';
  document.getElementById('item-nome').value       = '';
  document.getElementById('item-param').value      = '';
  document.getElementById('item-numero').value     = '';
  document.getElementById('item-impeditivo').checked  = false;
  document.getElementById('item-na').checked          = false;
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
  const id         = document.getElementById('item-id').value;
  const nome       = document.getElementById('item-nome').value.trim();
  const parametro  = document.getElementById('item-param').value.trim();
  const numero     = parseInt(document.getElementById('item-numero').value);
  const secaoId    = document.getElementById('item-secao').value;
  const impeditivo = document.getElementById('item-impeditivo').checked;
  const permiteNaoAplica = document.getElementById('item-na').checked;

  if (!nome || !parametro || !numero || !secaoId) {
    toast('Preencha todos os campos obrigatórios.', 'error');
    return;
  }
  const itensSecao = itens.filter(i => i.secaoId === secaoId && i.id !== id);
  const ordem = itensSecao.length + 1;
  const dados = { nome, parametro, numero, secaoId, impeditivo, permiteNaoAplica, ordem, ativo: true };

  try {
    if (id) {
      await updateDoc(doc(db, 'itens', id), dados);
      toast('Item atualizado!', 'success');
    } else {
      await addDoc(collection(db, 'itens'), { ...dados, criadoEm: serverTimestamp() });
      toast('Item adicionado!', 'success');
    }
    fecharModal('modal-item');
    await carregarItens();
  } catch (e) {
    toast('Erro ao salvar item.', 'error');
  }
});

window.toggleItem = async (id, ativo) => {
  const acao = ativo ? 'remover' : 'reativar';
  if (!confirmar(`Deseja ${acao} este item?`)) return;
  try {
    await updateDoc(doc(db, 'itens', id), { ativo: !ativo });
    toast(`Item ${ativo ? 'removido' : 'reativado'}!`, 'success');
    await carregarItens();
  } catch (e) {
    toast('Erro ao alterar item.', 'error');
  }
};

// ============================================================
// USUÁRIOS
// ============================================================
async function carregarUsuarios() {
  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), orderBy('criadoEm', 'desc')));
    usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarUsuarios();
  } catch (e) {
    toast('Erro ao carregar usuários.', 'error');
    console.error(e);
  }
}

function renderizarUsuarios() {
  const el = document.getElementById('lista-usuarios');
  if (!el) return;

  if (usuarios.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👤</div>
        <p>Nenhum usuário cadastrado ainda.</p>
        <p style="font-size:13px;color:var(--cor-texto-3);margin-top:8px">
          O primeiro admin deve ser criado pelo console do Firebase.
        </p>
      </div>`;
    return;
  }

  el.innerHTML = usuarios.map(u => {
    const eVoceMesmo = u.email === usuarioAtual?.email;
    return `
    <div class="item-lista ${u.ativo ? '' : 'inativo'}">
      <div class="item-lista-info">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="
            width:36px;height:36px;border-radius:50%;
            background:var(--cor-primaria-dim);
            display:flex;align-items:center;justify-content:center;
            font-size:16px;flex-shrink:0;
          ">👤</div>
          <div>
            <div style="font-weight:600;font-size:14px;color:var(--cor-texto)">${u.nome || '—'}</div>
            <div style="font-size:12px;color:var(--cor-texto-3);font-family:'JetBrains Mono',monospace">${u.email}</div>
          </div>
        </div>
        <div class="item-lista-meta" style="margin-top:10px;padding-left:46px">
          ${u.ativo
            ? '<span class="badge badge-aprovado">✅ Ativo</span>'
            : '<span class="badge badge-reprovado">🔒 Inativo</span>'}
          ${eVoceMesmo ? '<span class="badge" style="background:var(--cor-primaria-dim);color:var(--cor-primaria)">Você</span>' : ''}
          ${u.trocarSenha ? '<span class="badge badge-alerta">⏳ Aguardando troca de senha</span>' : ''}
          <span style="font-size:12px;color:var(--cor-texto-3)">Criado em ${formatarDataHora(u.criadoEm)}</span>
        </div>
      </div>
      <div class="item-lista-actions">
        <button class="btn btn-ghost btn-sm" onclick="enviarResetSenha('${u.email}')" title="Enviar link de redefinição">
          🔑 Reset
        </button>
        ${eVoceMesmo ? '' : `
          <button class="btn btn-sm ${u.ativo ? 'btn-danger' : 'btn-ghost'}" onclick="toggleUsuario('${u.id}', ${u.ativo}, '${u.email}')">
            ${u.ativo ? '🔒 Inativar' : '🔓 Ativar'}
          </button>
        `}
      </div>
    </div>`;
  }).join('');
}

// Adicionar usuário
document.getElementById('btn-add-usuario')?.addEventListener('click', () => {
  document.getElementById('usuario-nome').value  = '';
  document.getElementById('usuario-email').value = '';
  document.getElementById('usuario-senha').value = '';
  document.getElementById('usuario-modal-erro')?.classList.add('hidden');
  abrirModal('modal-usuario');
});

document.getElementById('btn-salvar-usuario')?.addEventListener('click', async () => {
  const nome  = document.getElementById('usuario-nome').value.trim();
  const email = document.getElementById('usuario-email').value.trim().toLowerCase();
  const senha = document.getElementById('usuario-senha').value;
  const erroEl = document.getElementById('usuario-modal-erro');

  erroEl?.classList.add('hidden');

  if (!nome || !email || !senha) {
    erroEl.textContent = 'Preencha todos os campos.';
    erroEl.classList.remove('hidden');
    return;
  }
  if (senha.length < 6) {
    erroEl.textContent = 'A senha deve ter no mínimo 6 caracteres.';
    erroEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('btn-salvar-usuario');
  btn.disabled = true;
  btn.textContent = 'Criando...';

  try {
    const adminEmail = usuarioAtual.email;
    const adminUid   = usuarioAtual.uid;

    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    const novoUid = cred.user.uid;

    // Salva metadados com trocarSenha: true
    await setDoc(doc(db, 'usuarios', novoUid), {
      uid: novoUid,
      nome,
      email,
      ativo: true,
      trocarSenha: true,
      criadoEm: serverTimestamp(),
      criadoPor: adminUid
    });

    toast(`✅ Usuário ${nome} criado! Você será redirecionado para reautenticar.`, 'success');
    fecharModal('modal-usuario');
    await carregarUsuarios();

    setTimeout(async () => {
      await signOut(auth);
      window.location.href = `login.html?msg=usuario-criado`;
    }, 2000);

  } catch (e) {
    const msgs = {
      'auth/email-already-in-use': 'Este e-mail já está em uso.',
      'auth/invalid-email':        'E-mail inválido.',
      'auth/weak-password':        'Senha muito fraca (mínimo 6 caracteres).',
    };
    erroEl.textContent = msgs[e.code] || `Erro: ${e.message}`;
    erroEl.classList.remove('hidden');
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar Usuário';
  }
});

window.toggleUsuario = async (id, ativo, email) => {
  if (email === usuarioAtual?.email) {
    toast('Você não pode inativar a si mesmo.', 'error');
    return;
  }
  const acao = ativo ? 'inativar' : 'ativar';
  if (!confirmar(`Deseja ${acao} o usuário ${email}?`)) return;
  try {
    await updateDoc(doc(db, 'usuarios', id), { ativo: !ativo });
    toast(`Usuário ${ativo ? 'inativado' : 'ativado'}!`, 'success');
    await carregarUsuarios();
  } catch (e) {
    toast('Erro ao alterar status do usuário.', 'error');
  }
};

window.enviarResetSenha = async (email) => {
  if (!confirmar(`Enviar link de redefinição de senha para ${email}?`)) return;
  try {
    await sendPasswordResetEmail(auth, email);
    toast(`Link enviado para ${email}`, 'success');
  } catch (e) {
    toast('Erro ao enviar e-mail de redefinição.', 'error');
  }
};

// Toggle senha no modal de usuário
document.getElementById('toggle-usuario-senha')?.addEventListener('click', () => {
  const inp = document.getElementById('usuario-senha');
  const btn = document.getElementById('toggle-usuario-senha');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
});

// ============================================================
// FECHAR MODAIS
// ============================================================
document.querySelectorAll('.modal-close, [data-fechar-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal-backdrop')?.classList.add('hidden');
  });
});

document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.classList.add('hidden');
  });
});

// Exibir mensagem de sucesso de criação de usuário
const params = new URLSearchParams(window.location.search);
if (params.get('msg') === 'usuario-criado') {
  history.replaceState({}, '', window.location.pathname);
  setTimeout(() => toast('Usuário criado com sucesso! Bem-vindo de volta.', 'success'), 1000);
}
