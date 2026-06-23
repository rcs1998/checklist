// ============================================================
// LOGIN.JS — Autenticação com Firebase Auth
// ============================================================
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Se já logado, redireciona
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = '/checklist/pages/admin.html';
});

const form     = document.getElementById('login-form');
const btnLogin = document.getElementById('btn-login');
const errMsg   = document.getElementById('login-erro');
const inpEmail = document.getElementById('login-email');
const inpSenha = document.getElementById('login-senha');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = inpEmail.value.trim();
  const senha = inpSenha.value;

  if (!email || !senha) {
    mostrarErro('Preencha e-mail e senha.');
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Entrando...';
  errMsg.classList.add('hidden');

  try {
    await signInWithEmailAndPassword(auth, email, senha);
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
    btnLogin.disabled = false;
    btnLogin.textContent = 'Entrar';
  }
});

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
