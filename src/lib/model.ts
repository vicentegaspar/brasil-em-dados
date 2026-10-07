// Modelo canônico de séries de indicadores.
// Toda observação carrega fonte, período de referência e data de coleta —
// nunca entra número no site sem esses metadados (regra de ouro do plano).

import {
  formatarNumero,
  formatarPeriodoDiaria,
  formatarPeriodoMensal,
} from "./periodos";

export type NivelLocalidade = "N1" | "N3" | "N6";

export type Localidade = {
  /** Nível territorial IBGE: N1 Brasil, N3 Unidade da Federação, N6 Município */
  nivel: NivelLocalidade;
  /** Código IBGE da localidade ("1" para Brasil; 7 dígitos para município) */
  codigo: string;
  nome: string;
};

export type Periodicidade = "diaria" | "mensal" | "anual" | "trimestral-movel";

/** Formato canônico do período: YYYY para anual, YYYY-MM para mensal, YYYY-MM-DD para diária */
export type Periodo = string;

export type Observacao = {
  periodo: Periodo;
  valor: number;
};

export type Licenca = "verde" | "amarelo" | "vermelho";

export type SerieIndicador = {
  /** Identificador estável, ex.: "bcb-selic", "sidra-pib", "wb-<cod>-<ISO3>" */
  id: string;
  nome: string;
  unidade: string;
  periodicidade: Periodicidade;
  fonte: string;
  fonteUrl: string;
  licenca: Licenca;
  /** Data ISO de coleta — sempre presente */
  coletadoEm: string;
  localidade: Localidade;
  observacoes: Observacao[];
};

export type { Env, KVLike } from "./cache";

/**
 * Metadados obrigatórios de um indicador — os mesmos que alimentam o registro
 * único (src/lib/registro.ts). Um descritor só entra no registro com tudo
 * preenchido; a montagem do IndicadorExibicao acontece aqui, em um único lugar.
 */
export type MetaIndicador = {
  /** Identificador estável e único, ex.: "bcb-selic", "sidra-pib" */
  id: string;
  nome: string;
  /** Unidade do valor (`valor`/`valorFormatado` já na escala exibida) */
  unidade: string;
  periodicidade: Periodicidade;
  fonte: string;
  fonteUrl: string;
  licenca: Licenca;
  /** Casas decimais do valor formatado */
  casas: number;
  /** Quantas observações entram na série (janela) exibida/entregue pela API */
  janelaSerie: number;
  /**
   * Tipo de variação entre as duas últimas observações:
   * "pct" (relativa, % — default) ou "pp" (diferença em pontos percentuais,
   * para séries que JÁ são em %: inflação, desemprego, dívida/PIB...).
   */
  variacaoTipo?: "pct" | "pp";
};

/** Indicador pronto para exibição (última observação + série curta) */
export type IndicadorExibicao = {
  id: string;
  nome: string;
  unidade: string;
  periodicidade: Periodicidade;
  valor: number;
  valorFormatado: string;
  /** Último período de referência, no formato canônico */
  periodo: Periodo;
  periodoFormatado: string;
  /** Variação da última observação em relação à anterior (quando faz sentido) */
  variacaoPct: number | null;
  /** Série curta para gráfico */
  serie: Observacao[];
  fonte: string;
  fonteUrl: string;
  coletadoEm: string;
  /** Indicador indisponível: motivo (fonte fora do ar, licença, pendente) */
  indisponivelMotivo?: string;
};

function agora(): string {
  return new Date().toISOString();
}

function periodoFormatado(periodicidade: Periodicidade, p: string): string {
  if (periodicidade === "mensal" || periodicidade === "trimestral-movel") {
    return formatarPeriodoMensal(p);
  }
  if (periodicidade === "diaria") return formatarPeriodoDiaria(p);
  return p;
}

function variacao(
  atual: number,
  anterior: number,
  tipo: "pct" | "pp",
): number | null {
  if (!Number.isFinite(anterior) || anterior === 0) return null;
  if (tipo === "pp") return atual - anterior;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/** Constrói IndicadorExibicao a partir da série (última observação + variação). */
export function montarIndicador(
  meta: MetaIndicador,
  obs: Observacao[],
): IndicadorExibicao {
  if (obs.length === 0) {
    return indicadorPendente(meta, "Fonte não retornou dados válidos.");
  }
  const ultima = obs[obs.length - 1];
  const penultima = obs[obs.length - 2] ?? null;
  return {
    id: meta.id,
    nome: meta.nome,
    unidade: meta.unidade,
    periodicidade: meta.periodicidade,
    valor: ultima.valor,
    valorFormatado: formatarNumero(ultima.valor, meta.casas),
    periodo: ultima.periodo,
    periodoFormatado: periodoFormatado(meta.periodicidade, ultima.periodo),
    variacaoPct: penultima
      ? variacao(ultima.valor, penultima.valor, meta.variacaoTipo ?? "pct")
      : null,
    serie: obs.slice(-meta.janelaSerie),
    fonte: meta.fonte,
    fonteUrl: meta.fonteUrl,
    coletadoEm: agora(),
  };
}

/** Indicador marcado como pendente — aparece na UI e na API com o motivo, sem dados */
export function indicadorPendente(
  meta: MetaIndicador,
  motivo: string,
): IndicadorExibicao {
  return {
    id: meta.id,
    nome: meta.nome,
    unidade: "",
    periodicidade: meta.periodicidade,
    valor: NaN,
    valorFormatado: "",
    periodo: "",
    periodoFormatado: "",
    variacaoPct: null,
    serie: [],
    fonte: meta.fonte,
    fonteUrl: meta.fonteUrl,
    coletadoEm: "",
    indisponivelMotivo: motivo,
  };
}
