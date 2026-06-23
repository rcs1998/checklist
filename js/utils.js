// ============================================================
// UTILITÁRIOS COMPARTILHADOS
// ============================================================

/** Formata data para pt-BR */
export function formatarData(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Formata data + hora para pt-BR */
export function formatarDataHora(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/** Normaliza placa (uppercase, sem espaços) */
export function normalizarPlaca(placa) {
  return placa.trim().toUpperCase().replace(/\s+/g, '');
}

/** Valida formato de placa (ABC1234 ou ABC1D23) */
export function validarPlaca(placa) {
  const p = normalizarPlaca(placa);
  return /^[A-Z]{3}\d{4}$/.test(p) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(p);
}

/** Toast notification */
export function toast(msg, tipo = 'info', duracao = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.innerHTML = `<span>${icons[tipo] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all .3s ease';
    setTimeout(() => el.remove(), 300);
  }, duracao);
}

/** Abre/fecha modal */
export function abrirModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}
export function fecharModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

/** Confirma ação */
export function confirmar(msg) {
  return window.confirm(msg);
}

/** Exportar checklist para PDF via print */
export function exportarPDF(conteudoHTML, titulo = 'checklist') {
  const janela = window.open('', '_blank');
  janela.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <link rel="stylesheet" href="../css/pdf.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { margin: 20mm; size: A4; }
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  ${conteudoHTML}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 800);
    }
  </script>
</body>
</html>`);
  janela.document.close();
}

/** Calcula resultado do checklist */
export function calcularResultado(respostas, itens) {
  let aprovado = true;
  let totalItens = 0;
  let conformes = 0;

  for (const item of itens) {
    const resp = respostas[item.id];
    if (!resp || resp === 'na') {
      if (resp === 'na') totalItens++;
      continue;
    }
    totalItens++;
    if (resp === 'c') {
      conformes++;
    } else if (resp === 'nc' && item.impeditivo) {
      aprovado = false;
    }
  }

  return {
    aprovado,
    totalItens,
    conformes,
    percentual: totalItens > 0 ? Math.round((conformes / totalItens) * 100) : 0
  };
}

/** Gera HTML do PDF de resultado */
export function gerarHTMLPDF(checklist, itens, secoes) {
  const resultado = checklist.resultado;
  const dataHora = formatarDataHora(checklist.criadoEm);
  const cor = resultado === 'aprovado' ? '#00A87A' : '#E0304A';

  // Agrupar itens por seção
  const itensPorSecao = {};
  for (const secao of secoes) {
    itensPorSecao[secao.id] = { secao, lista: [] };
  }
  const semSecao = [];
  for (const item of itens) {
    const resp = checklist.respostas?.[item.id] ?? null;
    const entry = { item, resp };
    if (itensPorSecao[item.secaoId]) {
      itensPorSecao[item.secaoId].lista.push(entry);
    } else {
      semSecao.push(entry);
    }
  }

  function statusBadge(resp) {
    if (!resp) return `<span class="pdf-item-status pdf-status-na">—</span>`;
    if (resp === 'c')  return `<span class="pdf-item-status pdf-status-c">Conforme</span>`;
    if (resp === 'nc') return `<span class="pdf-item-status pdf-status-nc">Não Conforme</span>`;
    if (resp === 'na') return `<span class="pdf-item-status pdf-status-na">N/A</span>`;
    return '';
  }

  function renderItens(lista) {
    return lista.map(({ item, resp }) => {
      const obs = checklist.observacoes?.[item.id] || '';
      return `
<div class="pdf-item">
  <div class="pdf-item-num">#${String(item.numero).padStart(2, '0')}</div>
  <div class="pdf-item-body">
    <div class="pdf-item-nome">
      ${item.nome}
      ${item.impeditivo ? '<span class="pdf-imperativo-badge">Impeditivo</span>' : ''}
    </div>
    <div class="pdf-item-param">${item.parametro}</div>
    ${obs ? `<div class="pdf-item-obs">Obs.: ${obs}</div>` : ''}
  </div>
  ${statusBadge(resp)}
</div>`;
    }).join('');
  }

  let secoesHTML = '';
  for (const key of Object.keys(itensPorSecao)) {
    const { secao, lista } = itensPorSecao[key];
    if (lista.length === 0) continue;
    secoesHTML += `<div class="pdf-secao-titulo">${secao.nome}</div>${renderItens(lista)}`;
  }
  if (semSecao.length > 0) {
    secoesHTML += `<div class="pdf-secao-titulo">Outros</div>${renderItens(semSecao)}`;
  }

  return `
<div class="pdf-page">
  <div class="pdf-header">
    <div class="pdf-logo-area">
      <div class="pdf-logo-box">🚗</div>
      <div>
        <div class="pdf-title">Checklist de Veículo</div>
        <div class="pdf-subtitle">Inspeção operacional</div>
      </div>
    </div>
    <div class="pdf-data-emissao">
      Emitido em<strong>${new Date().toLocaleString('pt-BR')}</strong>
    </div>
  </div>

  <div class="pdf-resultado ${resultado}">
    <div class="pdf-resultado-icone">${resultado === 'aprovado' ? '✅' : '❌'}</div>
    <div class="pdf-resultado-texto">${resultado === 'aprovado' ? 'APROVADO' : 'REPROVADO'}</div>
    <div class="pdf-resultado-meta">
      <div class="pdf-meta-item">
        <div class="pdf-meta-label">Placa</div>
        <div class="pdf-placa">${checklist.placa}</div>
      </div>
      <div class="pdf-meta-item">
        <div class="pdf-meta-label">Motorista</div>
        <div class="pdf-meta-valor">${checklist.motorista}</div>
      </div>
      <div class="pdf-meta-item">
        <div class="pdf-meta-label">Data e Hora</div>
        <div class="pdf-meta-valor">${dataHora}</div>
      </div>
      <div class="pdf-meta-item">
        <div class="pdf-meta-label">Conformidade</div>
        <div class="pdf-meta-valor">${checklist.percentual ?? 0}%</div>
      </div>
    </div>
  </div>

  ${secoesHTML}

  <div class="pdf-footer">
    <span>Documento gerado automaticamente pelo sistema de Checklist de Veículos</span>
    <div class="pdf-assinatura">
      <div class="pdf-assinatura-linha"></div>
      <div class="pdf-assinatura-label">Assinatura do responsável</div>
    </div>
  </div>
</div>`;
}
