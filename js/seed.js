// ============================================================
// SEED.JS — Popula o banco de dados com os dados iniciais
// ============================================================
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { popularBancoDeDados } from "./seed-data.js";

const btnSeed   = document.getElementById('btn-seed');
const resultado = document.getElementById('seed-resultado');
const status    = document.getElementById('seed-status');

onAuthStateChanged(auth, (user) => {
  if (!user) {
    status.textContent = '⚠️ Você precisa estar logado para popular o banco.';
    status.style.color = 'var(--cor-alerta)';
    if (btnSeed) {
      btnSeed.disabled = true;
      btnSeed.textContent = '🔒 Faça login para continuar';
    }
  } else {
    status.textContent = `✅ Logado como ${user.email}. Pronto para popular o banco.`;
    status.style.color = 'var(--cor-aprovado)';
    if (btnSeed) {
      btnSeed.disabled = false;
      btnSeed.textContent = '🌱 Popular Banco de Dados';
    }
  }
});

btnSeed?.addEventListener('click', async () => {
  btnSeed.disabled = true;
  btnSeed.textContent = 'Populando...';
  resultado.innerHTML = '';

  try {
    const res = await popularBancoDeDados();

    if (res.jaPopulado) {
      resultado.innerHTML = `<p style="color:var(--cor-alerta)">⚠️ O banco já foi populado anteriormente. Para re-popular, delete os dados existentes primeiro.</p>`;
      return;
    }

    resultado.innerHTML = `
      <p style="color:var(--cor-aprovado)">✅ Banco populado com sucesso!</p>
      <ul style="margin-top:12px;color:var(--cor-texto-2);font-size:14px;list-style:disc;padding-left:20px">
        <li>${res.secoes} seções criadas</li>
        <li>${res.itens} itens criados</li>
        ${res.erros.length > 0 ? `<li style="color:var(--cor-reprovado)">${res.erros.length} erros: ${res.erros.join(', ')}</li>` : ''}
      </ul>
      <p style="margin-top:12px;font-size:13px;color:var(--cor-texto-3)">Você pode fechar esta página e ir para o sistema.</p>`;
  } catch (e) {
    resultado.innerHTML = `<p style="color:var(--cor-reprovado)">❌ Erro: ${e.message}</p>`;
  } finally {
    btnSeed.disabled = false;
    btnSeed.textContent = '🌱 Popular Banco de Dados';
  }
});
