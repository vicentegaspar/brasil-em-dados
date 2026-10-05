// Modelo canônico de séries de indicadores.
// Toda observação carrega fonte, período de referência e data de coleta —
// nunca entra número no site sem esses metadados (regra de ouro do plano).

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
  /** Identificador estável, ex.: "bcb-sgs-432", "ibge-sidra-5938-pib" */
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
  /** Variação % da última observação em relação à anterior (quando faz sentido) */
  variacaoPct: number | null;
  /** Série (até 12 últimos pontos) para gráfico */
  serie: Observacao[];
  fonte: string;
  fonteUrl: string;
  coletadoEm: string;
  /** Indicador indisponível: motivo (fonte fora do ar, licença, pendente) */
  indisponivelMotivo?: string;
};

/** Indicador marcado como pendente — aparece na UI e na API com o motivo, sem dados */
export function indicadorPendente(
  id: string,
  nome: string,
  motivo: string,
  fonte: string,
  fonteUrl: string,
): IndicadorExibicao {
  return {
    id,
    nome,
    unidade: "",
    periodicidade: "anual",
    valor: NaN,
    valorFormatado: "",
    periodo: "",
    periodoFormatado: "",
    variacaoPct: null,
    serie: [],
    fonte,
    fonteUrl,
    coletadoEm: "",
    indisponivelMotivo: motivo,
  };
}
