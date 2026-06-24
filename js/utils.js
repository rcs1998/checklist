// ============================================================
// LOGIN.JS — Autenticação com Firebase Auth
// ============================================================
import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Se já logado e ativo, redireciona
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Verifica se usuário está ativo
    try {
      const snap = await getDoc(doc(db, 'usuarios', user.uid));
      if (snap.exists() && snap.data().ativo === false) {
        // Usuário inativo — desloga e mostra aviso
        await signOut(auth);
        mostrarErro('Seu acesso foi desativado. Entre em contato com o administrador.');
        return;
      }
    } catch (e) {
      // Se não achar doc (ex: primeiro admin criado direto no console), deixa passar
    }
    window.location.href = '/checklist/pages/admin.html';
  }
});

const form           = document.getElementById('login-form');
const btnLogin       = document.getElementById('btn-login');
const errMsg         = document.getElementById('login-erro');
const inpEmail       = document.getElementById('login-email');
const inpSenha       = document.getElementById('login-senha');
const linkEsqueceu   = document.getElementById('link-esqueceu');
const btnReset       = document.getElementById('btn-reset-senha');
const secaoReset     = document.getElementById('secao-reset');
const secaoLogin     = document.getElementById('secao-login');
const btnVoltarLogin = document.getElementById('btn-voltar-login');

// ---------- Login ----------
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = inpEmail.value.trim();
  const senha = inpSenha.value;

  if (!email || !senha) {
    mostrarErro('Preencha e-mail e senha.');
    return;
  }

  btnLogin.disabled    = true;
  btnLogin.textContent = 'Entrando...';
  errMsg.classList.add('hidden');

  try {
    const cred = await signInWithEmailAndPassword(auth, email, senha);

    // Verificar se usuário está ativo no Firestore
    try {
      const snap = await getDoc(doc(db, 'usuarios', cred.user.uid));
      if (snap.exists() && snap.data().ativo === false) {
        await signOut(auth);
        mostrarErro('Seu acesso foi desativado. Entre em contato com o administrador.');
        return;
      }
    } catch (e) {
      // Usuário não tem doc no Firestore (admin criado pelo console) — permite acesso
    }

    window.location.href = '/checklist/pages/admin.html';
  } catch (err) {
    const msgs = {
      'auth/user-not-found':     'Usuário não encontrado.',
      'auth/wrong-password':     'Senha incorreta.',
      'auth/invalid-email':      'E-mail inválido.',
      'auth/too-many-requests':  'Muitas tentativas. Tente mais tarde.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
    };
    mostrarErro(msgs[err.code] || 'Erro ao entrar. Tente novamente.');
  } finally {
    btnLogin.disabled    = false;
    btnLogin.textContent = 'Entrar';
  }
});

// ---------- Esqueceu a senha ----------
linkEsqueceu?.addEventListener('click', (e) => {
  e.preventDefault();
  const emailAtual    = inpEmail?.value.trim();
  const inpResetEmail = document.getElementById('reset-email');
  if (inpResetEmail && emailAtual) inpResetEmail.value = emailAtual;
  secaoLogin?.classList.add('hidden');
  secaoReset?.classList.remove('hidden');
  errMsg.classList.add('hidden');
});

btnVoltarLogin?.addEventListener('click', () => {
  secaoReset?.classList.add('hidden');
  secaoLogin?.classList.remove('hidden');
  document.getElementById('reset-erro')?.classList.add('hidden');
  document.getElementById('reset-sucesso')?.classList.add('hidden');
});

btnReset?.addEventListener('click', async () => {
  const email     = document.getElementById('reset-email')?.value.trim();
  const resetErro = document.getElementById('reset-erro');
  const resetSucc = document.getElementById('reset-sucesso');

  resetErro?.classList.add('hidden');
  resetSucc?.classList.add('hidden');

  if (!email) {
    resetErro.textContent = 'Informe o e-mail para redefinição.';
    resetErro.classList.remove('hidden');
    return;
  }

  btnReset.disabled    = true;
  btnReset.textContent = 'Enviando...';

  try {
    await sendPasswordResetEmail(auth, email);
    resetSucc.textContent = `✅ E-mail de redefinição enviado para ${email}. Verifique sua caixa de entrada.`;
    resetSucc.classList.remove('hidden');
    document.getElementById('reset-email').value = '';
  } catch (err) {
    const msgs = {
      'auth/user-not-found':    'Nenhuma conta encontrada com este e-mail.',
      'auth/invalid-email':     'E-mail inválido.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    };
    resetErro.textContent = msgs[err.code] || 'Erro ao enviar. Tente novamente.';
    resetErro.classList.remove('hidden');
  } finally {
    btnReset.disabled    = false;
    btnReset.textContent = 'Enviar link de redefinição';
  }
});

// ---------- Utilitários ----------
function mostrarErro(msg) {
  errMsg.textContent = msg;
  errMsg.classList.remove('hidden');
}

// Toggle senha
document.getElementById('toggle-senha')?.addEventListener('click', () => {
  const tipo = inpSenha.type === 'password' ? 'text' : 'password';
  inpSenha.type = tipo;
  document.getElementById('toggle-senha').textContent = tipo === 'password' ? '👁️' : '🙈';
});
