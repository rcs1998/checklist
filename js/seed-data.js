// ============================================================
// DADOS INICIAIS DO CHECKLIST
// Execute este script UMA VEZ para popular o banco de dados
// Acesse a página seed.html para popular o Firebase
// ============================================================

import { db } from "./firebase-config.js";
import { collection, doc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const secoes = [
  {
    id: "secao-1",
    nome: "Inspeção Externa e Documentação",
    ordem: 1
  },
  {
    id: "secao-2",
    nome: "Cabine e Equipamentos Internos",
    ordem: 2
  }
];

export const itensChecklist = [
  // ---- SEÇÃO 1: Itens 1–16 ----
  {
    id: "item-01",
    secaoId: "secao-1",
    numero: 1,
    nome: "IDB do veículo",
    parametro: "Em projeto inscrito corretamente e bem impresso, borracha limpo",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 1
  },
  {
    id: "item-02",
    secaoId: "secao-1",
    numero: 2,
    nome: "Vidros do pára-brisas",
    parametro: "Em projeto inscrito corretamente e inteiros",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 2
  },
  {
    id: "item-03",
    secaoId: "secao-1",
    numero: 3,
    nome: "Limpadores, reservatório / borrachas, nível de óleo, lâmpadas direcionais e pisca-pisca",
    parametro: "Em projeto inscrito corretamente e bem impresso, borrachas limpas",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 3
  },
  {
    id: "item-04",
    secaoId: "secao-1",
    numero: 4,
    nome: "Farol dianteiro / lanternas",
    parametro: "Em projeto inscrito corretamente e em boas condições",
    impeditivo: false,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 4
  },
  {
    id: "item-05",
    secaoId: "secao-1",
    numero: 5,
    nome: "Cinto (um por cinto com possibilidade de caixa a caixa)",
    parametro: "Em projeto inscrito, funcionando e em boas condições a caixa do motorista",
    impeditivo: false,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 5
  },
  {
    id: "item-06",
    secaoId: "secao-1",
    numero: 6,
    nome: "Pneus dianteiros e traseiros",
    parametro: "Borracha com boa qualidade de tração, tampão de válvula e calibração de acordo com o especificado pelo fabricante. Mínimo 3 dedos de friso (risco)",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 6
  },
  {
    id: "item-07",
    secaoId: "secao-1",
    numero: 7,
    nome: "Espelhos retrovisores e paralamas",
    parametro: "Pode ter limpo e em boas condições. Não pode ter riscos de aço ou ação de água, precisa de 3 espelhos (externo motorista, externo passageiro, interno). Mínimo: 3 dedos, borracha riscado do pneu (friso)",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 7
  },
  {
    id: "item-08",
    secaoId: "secao-1",
    numero: 8,
    nome: "Parachoque",
    parametro: "Pode ter após saída de barracos e para raios. Em boas condições limpa, sem amassados e rachaduras que comprometam a proteção contra raio e riscos de impacto",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 8
  },
  {
    id: "item-09",
    secaoId: "secao-1",
    numero: 9,
    nome: "Freios",
    parametro: "Revisar o nível de fluido de freios e pastilhas traseiras e dianteiras. Em boas condições, torque com pé no freio, freia, pedal firme, sem pó do freio, borracha conforme e parafusos de borracha",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 9
  },
  {
    id: "item-10",
    secaoId: "secao-1",
    numero: 10,
    nome: "Cinto de borracha",
    parametro: "Tipo de cinto com borracha, correta, correia de barras e barra de borracha. Não pode ter abrigo conforme ou torcer a borracha. Não pode ter aparafusamento de risco atrás (exceder no risco)",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 10
  },
  {
    id: "item-11",
    secaoId: "secao-1",
    numero: 11,
    nome: "Direção",
    parametro: "Em projeto inscrito corretamente e limpo, sem folga e bem torqueado",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 11
  },
  {
    id: "item-12",
    secaoId: "secao-1",
    numero: 12,
    nome: "Limpadores de pára-brisas",
    parametro: "Em projeto inscrito corretamente, borracha bem vascada e limpa ao vidro do pára-brisas. Não pode ter repuxado e folga no limpador de pára-brisas",
    impeditivo: false,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 12
  },
  {
    id: "item-13",
    secaoId: "secao-1",
    numero: 13,
    nome: "Lataria/borracha blindada",
    parametro: "Inteiros, bem borrachada e limpos",
    impeditivo: false,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 13
  },
  {
    id: "item-14",
    secaoId: "secao-1",
    numero: 14,
    nome: "Transportador de objetos / caixas acima da bota do sucador",
    parametro: "Não pode passar objetos acima do limite do cinto. Adequada e conforme o recomendado pelo fabricante. Correia de fixação conforme e parafusos fixados (sem folga)",
    impeditivo: true,
    permiteNaoAplica: true,
    ativo: true,
    ordem: 14
  },
  {
    id: "item-15",
    secaoId: "secao-1",
    numero: 15,
    nome: "Documento do veículo",
    parametro: "Presente no veículo",
    impeditivo: false,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 15
  },
  {
    id: "item-16",
    secaoId: "secao-1",
    numero: 16,
    nome: "Travamento do capô",
    parametro: "Borracha do capô até ao trava e trava em boas condições",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 16
  },
  // ---- SEÇÃO 2: Itens 17–25 ----
  {
    id: "item-17",
    secaoId: "secao-2",
    numero: 17,
    nome: "Condição física / funcional do cinto de segurança",
    parametro: "Conforme até acomodado, afivele e borracha sem danos. Não pode ter abrigo danificado, travamento ou apresentar qualquer irregularidade",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 1
  },
  {
    id: "item-18",
    secaoId: "secao-2",
    numero: 18,
    nome: "Itens de aplicação (limpeza do veículo / extintor e kit de primeiros socorros)",
    parametro: "Verificar o prazo de validade do extintor, pressão do extintor, e o prazo de validade do kit de primeiros socorros da quantidade de áreas por dia",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 2
  },
  {
    id: "item-19",
    secaoId: "secao-2",
    numero: 19,
    nome: "Bancos/forração (aspe)",
    parametro: "Borracha a boa por voo, presença e inteiros de bota e a tornar dos bancos para fixação e parafusos dos bancos",
    impeditivo: true,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 3
  },
  {
    id: "item-20",
    secaoId: "secao-2",
    numero: 20,
    nome: "Mecânica, televisão e caixa do cinto",
    parametro: "Presença do veículo e em boas condições",
    impeditivo: false,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 4
  },
  {
    id: "item-21",
    secaoId: "secao-2",
    numero: 21,
    nome: "Ar/lanternas",
    parametro: "Presença do veículo e em boas condições",
    impeditivo: false,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 5
  },
  {
    id: "item-22",
    secaoId: "secao-2",
    numero: 22,
    nome: "Carregadores de celulares",
    parametro: "Presença do veículo e em boas condições",
    impeditivo: false,
    permiteNaoAplica: true,
    ativo: true,
    ordem: 6
  },
  {
    id: "item-23",
    secaoId: "secao-2",
    numero: 23,
    nome: "Caixas compartimentos",
    parametro: "Presença do veículo e em boas condições",
    impeditivo: false,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 7
  },
  {
    id: "item-24",
    secaoId: "secao-2",
    numero: 24,
    nome: "Carregadores de celular",
    parametro: "Presença do veículo e em boas condições",
    impeditivo: false,
    permiteNaoAplica: true,
    ativo: true,
    ordem: 8
  },
  {
    id: "item-25",
    secaoId: "secao-2",
    numero: 25,
    nome: "Pasta de procedimentos",
    parametro: "Presença do veículo e em boas condições",
    impeditivo: false,
    permiteNaoAplica: false,
    ativo: true,
    ordem: 9
  }
];

export async function popularBancoDeDados() {
  const resultados = { secoes: 0, itens: 0, erros: [] };

  // Verificar se já foi populado
  const checkSnap = await getDocs(collection(db, "itens"));
  if (!checkSnap.empty) {
    return { jaPopulado: true };
  }

  // Inserir seções
  for (const secao of secoes) {
    try {
      await setDoc(doc(db, "secoes", secao.id), {
        ...secao,
        criadoEm: new Date()
      });
      resultados.secoes++;
    } catch (e) {
      resultados.erros.push(`Seção ${secao.id}: ${e.message}`);
    }
  }

  // Inserir itens
  for (const item of itensChecklist) {
    try {
      await setDoc(doc(db, "itens", item.id), {
        ...item,
        criadoEm: new Date()
      });
      resultados.itens++;
    } catch (e) {
      resultados.erros.push(`Item ${item.id}: ${e.message}`);
    }
  }

  return resultados;
}
