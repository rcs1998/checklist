// ============================================================
// ADMIN.JS — Resultados, Placas, Itens e Usuários
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
  signOut
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
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    usuarioAtual = user;
    document.getElementById('user-email').textContent = user.email;
    init();
  }
});

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
    document.getElementById(btn.dataset.tab)?.classList.add('active');
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
              ${item.impeditivo ? '<span class="badge badge-imp">⛔ Impeditivo</span>' : '<span class="badge" style="background:rgba(0,200,150,.1);color:#00C896">✅ Não Impeditivo</span>'}
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
            <div style="font-weight:600;font-size:14px">${u.nome || '—'}</div>
            <div style="font-size:12px;color:var(--cor-texto-3);font-family:'JetBrains Mono',monospace">${u.email}</div>
          </div>
        </div>
        <div class="item-lista-meta" style="margin-top:10px;padding-left:46px">
          ${u.ativo
            ? '<span class="badge badge-aprovado">✅ Ativo</span>'
            : '<span class="badge badge-reprovado">🔒 Inativo</span>'}
          ${eVoceMesmo ? '<span class="badge" style="background:var(--cor-primaria-dim);color:var(--cor-primaria)">Você</span>' : ''}
          <span style="font-size:12px;color:var(--cor-texto-3)">Criado em ${formatarDataHora(u.criadoEm)}</span>
        </div>
      </div>
      <div class="item-lista-actions">
        <button class="btn btn-ghost btn-sm" onclick="enviarResetSenha('${u.email}')" title="Enviar link de redefinição">
          🔑 Reset senha
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
    // Cria o usuário no Firebase Auth
    // IMPORTANTE: Isso vai fazer login com o novo usuário momentaneamente.
    // Salvamos o token do admin antes.
    const adminEmail = usuarioAtual.email;

    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    const novoUid = cred.user.uid;

    // Salva metadados no Firestore
    await setDoc(doc(db, 'usuarios', novoUid), {
      uid: novoUid,
      nome,
      email,
      ativo: true,
      criadoEm: serverTimestamp(),
      criadoPor: usuarioAtual.uid
    });

    // O Firebase Auth faz login automático com o novo usuário.
    // Precisamos reconectar o admin. Como não temos a senha do admin,
    // usamos signOut e redirecionamos para login.
    toast(`✅ Usuário ${nome} criado! Você será redirecionado para reautenticar.`, 'success');
    fecharModal('modal-usuario');
    await carregarUsuarios();

    // Desloga e pede relogin após 2s
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
  if (!confirmar(`Deseja ${acao} o usuário ${email}?\n\nNota: isso apenas marca o status no sistema. O acesso ao Firebase Auth precisa ser gerenciado pelo console do Firebase.`)) return;
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
  // Limpa URL
  history.replaceState({}, '', window.location.pathname);
}
