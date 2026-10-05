// Coletores: cada fonte primária tem uma função que busca a resposta bruta,
// passa pelo parser puro (src/lib/parsers.ts) e produz IndicadorExibicao
// com fonte, período de referência e data de coleta. Falha de fonte não é
// zero — vira indicador indisponível com o motivo.

import { cachedJson, cachedTexto, cachedValor, type Env } from "./cache";
import type { IndicadorExibicao, Observacao, Periodicidade } from "./model";
import { indicadorPendente } from "./model";
import {
  parseBcbSgs,
  parseSidraValues,
  observacoesSidra,
  parseOnsCargaMensal,
  totalCargaMensal,
  parseCvmDreCsv,
  EMPRESAS_CATALOGO,
  type BalancoEmpresa,
  type OnsCargaMes,
} from "./parsers";
import { formatarNumero, formatarPeriodoDiaria, formatarPeriodoMensal } from "./periodos";
import { ufPorSigla, type Uf } from "./localidades";

const BCB_BASE = "https://api.bcb.gov.br/dados/serie";
const APISIDRA_BASE = "https://apisidra.ibge.gov.br/values";
const ONS_CARGA_URL =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/carga_energia_me/CARGA_MENSAL.csv";
const CVM_DFP_URL = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/Dados/dfp_cia_aberta_2025.zip";

function agora(): string {
  return new Date().toISOString();
}

/** Constrói IndicadorExibicao a partir da série (última observação + variação). */
function montarIndicador(
  id: string,
  nome: string,
  unidade: string,
  periodicidade: Periodicidade,
  fonte: string,
  fonteUrl: string,
  obs: Observacao[],
  casas: number,
): IndicadorExibicao {
  if (obs.length === 0) {
    return indicadorPendente(id, nome, "Fonte não retornou dados válidos.", fonte, fonteUrl);
  }
  const ultima = obs[obs.length - 1];
  const penultima = obs[obs.length - 2] ?? null;
  const fmtPeriodo =
    periodicidade === "mensal" || periodicidade === "trimestral-movel"
      ? formatarPeriodoMensal
      : periodicidade === "diaria"
        ? formatarPeriodoDiaria
        : (p: string) => p;
  const variacaoPct =
    penultima && penultima.valor !== 0
      ? ((ultima.valor - penultima.valor) / penultima.valor) * 100
      : null;
  return {
    id,
    nome,
    unidade,
    periodicidade,
    valor: ultima.valor,
    valorFormatado: formatarNumero(ultima.valor, casas),
    periodo: ultima.periodo,
    periodoFormatado: fmtPeriodo(ultima.periodo),
    variacaoPct,
    serie: obs.slice(-12),
    fonte,
    fonteUrl,
    coletadoEm: agora(),
  };
}

async function comFonte(
  id: string,
  nome: string,
  unidade: string,
  periodicidade: Periodicidade,
  fonte: string,
  fonteUrl: string,
  casas: number,
  buscar: () => Promise<Observacao[]>,
): Promise<IndicadorExibicao> {
  try {
    const obs = await buscar();
    return montarIndicador(id, nome, unidade, periodicidade, fonte, fonteUrl, obs, casas);
  } catch (e) {
    console.error(`coletor ${id}: ${String(e)}`);
    return indicadorPendente(id, nome, `Fonte indisponível (${String(e)}).`, fonte, fonteUrl);
  }
}

// ---------------- BCB SGS ----------------

/** Selic definida pelo Copom (SGS 1178), % a.a. */
export function getSelicMeta(env: Env): Promise<IndicadorExibicao> {
  return comFonte(
    "bcb-sgs-1178-selic-meta",
    "Taxa Selic definida pelo Copom",
    "% a.a.",
    "diaria",
    "Banco Central do Brasil — SGS série 1178",
    "https://www3.bcb.gov.br/sgspub/",
    2,
    async () => {
      const json = await cachedJson(
        env,
        "bcb:1178:v1",
        `${BCB_BASE}/bcdata.sgs.1178/dados/ultimos/2?formato=json`,
        6 * 3600,
      ) as unknown[];
      return parseBcbSgs(JSON.stringify(json));
    },
  );
}

/** Câmbio: PTAX dólar compra (SGS 1). */
export function getCambio(env: Env): Promise<IndicadorExibicao> {
  return comFonte(
    "bcb-sgs-1-cambio",
    "Dólar — PTAX (compra)",
    "R$/US$",
    "diaria",
    "Banco Central do Brasil — SGS série 1",
    "https://www3.bcb.gov.br/sgspub/",
    4,
    async () => {
      const json = await cachedJson(
        env,
        "bcb:1:v1",
        `${BCB_BASE}/bcdata.sgs.1/dados/ultimos/2?formato=json`,
        6 * 3600,
      ) as unknown[];
      return parseBcbSgs(JSON.stringify(json));
    },
  );
}

/** IPCA mensal (SGS 433), % no mês. */
export function getIpcaMensal(env: Env): Promise<IndicadorExibicao> {
  return comFonte(
    "bcb-sgs-433-ipca-mensal",
    "IPCA — variação mensal",
    "%",
    "mensal",
    "IBGE/BCB — SGS série 433 (IPCA mensal)",
    "https://www3.bcb.gov.br/sgspub/",
    2,
    async () => {
      const json = await cachedJson(
        env,
        "bcb:433:v1",
        `${BCB_BASE}/bcdata.sgs.433/dados/ultimos/2?formato=json`,
        12 * 3600,
      ) as unknown[];
      return parseBcbSgs(JSON.stringify(json), "mensal");
    },
  );
}

// ---------------- IBGE SIDRA (apisidra values) ----------------

async function sidra(
  env: Env,
  key: string,
  tabela: string,
  variavel: string,
  periodo: string,
  nivel: string,
): Promise<ReturnType<typeof parseSidraValues>> {
  const url = `${APISIDRA_BASE}/t/${tabela}/v/${variavel}/p/${periodo}/${nivel}`;
  const json = await cachedJson(env, key, url, 24 * 3600);
  return parseSidraValues(JSON.stringify(json));
}

/** Taxa de desocupação Brasil (SIDRA 6381, var 4099) — trimestral móvel. */
export function getDesocupacaoBrasil(env: Env): Promise<IndicadorExibicao> {
  return comFonte(
    "ibge-sidra-6381-desocupacao",
    "Taxa de desocupação (PNAD Contínua)",
    "%",
    "trimestral-movel",
    "IBGE — PNAD Contínua (SIDRA 6381)",
    "https://sidra.ibge.gov.br/tabela/6381",
    1,
    async () => {
      const linhas = await sidra(env, "sidra:6381:v1", "6381", "4099", "last%2024", "n1/1");
      return observacoesSidra(linhas, "4099", "1", "trimestral-movel");
    },
  );
}

/** Taxa de informalidade Brasil (SIDRA 4708, var 12466) — anual. */
export function getInformalidadeBrasil(env: Env): Promise<IndicadorExibicao> {
  return comFonte(
    "ibge-sidra-4708-informalidade",
    "Taxa de informalidade (PNAD Contínua)",
    "%",
    "anual",
    "IBGE — PNAD Contínua (SIDRA 4708)",
    "https://sidra.ibge.gov.br/tabela/4708",
    1,
    async () => {
      const linhas = await sidra(env, "sidra:4708:v1", "4708", "12466", "last%205", "n1/1");
      return observacoesSidra(linhas, "12466", "1", "anual");
    },
  );
}

/** PIB a preços correntes Brasil (SIDRA 5938, var 37) — anual, Mil Reais. */
export function getPibBrasil(env: Env): Promise<IndicadorExibicao> {
  return comFonte(
    "ibge-sidra-5938-pib",
    "PIB — Brasil a preços correntes",
    "R$ bi",
    "anual",
    "IBGE — PIB dos Municípios (SIDRA 5938)",
    "https://sidra.ibge.gov.br/tabela/5938",
    0,
    async () => {
      const linhas = await sidra(env, "sidra:5938:v1", "5938", "37", "last%205", "n1/1");
      return observacoesSidra(linhas, "37", "1", "anual").map((o) => ({
        periodo: o.periodo,
        valor: o.valor * 1000, // Mil Reais -> Reais
      }));
    },
  );
}

// ---------------- UF (drill-down) ----------------

export type IndicadoresUf = {
  uf: Uf;
  pib: IndicadorExibicao;
  pibParticipacao: IndicadorExibicao;
  desocupacao: IndicadorExibicao;
  informalidade: IndicadorExibicao;
};

export async function getIndicadoresUf(env: Env, sigla: string): Promise<IndicadoresUf | null> {
  const uf = ufPorSigla(sigla);
  if (!uf) return null;
  // Brasil é N1; UF é N3 — o apisidra valida o nível por tabela
  const nivelLocal = uf.codigo === "1" ? "n1/1" : `n3/${uf.codigo}`;
  const codigoLocal = uf.codigo === "1" ? "1" : uf.codigo;
  const [pib, part, desoc, informal] = await Promise.all([
    comFonte(
      "ibge-sidra-5938-pib",
      "PIB a preços correntes",
      "R$ bi",
      "anual",
      "IBGE — PIB dos Municípios (SIDRA 5938)",
      "https://sidra.ibge.gov.br/tabela/5938",
      1,
      async () => {
        const linhas = await sidra(
          env,
          `sidra:5938:37:uf:${codigoLocal}:v1`,
          "5938",
          "37",
          "last%205",
          nivelLocal,
        );
        return observacoesSidra(linhas, "37", codigoLocal, "anual").map((o) => ({
          periodo: o.periodo,
          valor: o.valor * 1000,
        }));
      },
    ),
    comFonte(
      "ibge-sidra-5938-pib-participacao",
      "Participação no PIB do Brasil",
      "%",
      "anual",
      "IBGE — PIB dos Municípios (SIDRA 5938)",
      "https://sidra.ibge.gov.br/tabela/5938",
      2,
      async () => {
        const linhas = await sidra(
          env,
          `sidra:5938:496:uf:${codigoLocal}:v1`,
          "5938",
          "496",
          "last%205",
          nivelLocal,
        );
        return observacoesSidra(linhas, "496", codigoLocal, "anual");
      },
    ),
    comFonte(
      "ibge-sidra-4562-desocupacao",
      "Taxa de desocupação (média anual)",
      "%",
      "anual",
      "IBGE — PNAD Contínua (SIDRA 4562)",
      "https://sidra.ibge.gov.br/tabela/4562",
      1,
      async () => {
        const linhas = await sidra(
          env,
          `sidra:4562:uf:${codigoLocal}:v1`,
          "4562",
          "4099",
          "last%205",
          nivelLocal,
        );
        return observacoesSidra(linhas, "4099", codigoLocal, "anual");
      },
    ),
    comFonte(
      "ibge-sidra-4708-informalidade",
      "Taxa de informalidade",
      "%",
      "anual",
      "IBGE — PNAD Contínua (SIDRA 4708)",
      "https://sidra.ibge.gov.br/tabela/4708",
      1,
      async () => {
        const linhas = await sidra(
          env,
          `sidra:4708:uf:${codigoLocal}:v1`,
          "4708",
          "12466",
          "last%205",
          nivelLocal,
        );
        return observacoesSidra(linhas, "12466", codigoLocal, "anual");
      },
    ),
  ]);
  return { uf, pib, pibParticipacao: part, desocupacao: desoc, informalidade: informal };
}

// ---------------- Energia (ONS) ----------------

export type CargaEnergia = {
  total: IndicadorExibicao;
  porSubsistema: { mes: string; subsistema: string; mwmed: number }[];
};

export function getCargaEnergia(env: Env): Promise<CargaEnergia> {
  const fonte = "ONS — Dados Abertos (Carga Mensal, CC-BY)";
  const fonteUrl = "https://dados.ons.org.br/dataset/carga-mensal";
  return (async () => {
    try {
      const csv = await cachedTexto(env, "ons:carga:v1", ONS_CARGA_URL, 6 * 3600);
      const dados: OnsCargaMes[] = parseOnsCargaMensal(csv);
      const total = montarIndicador(
        "ons-carga-mensal",
        "Carga de energia — total dos subsistemas",
        "MWmed",
        "mensal",
        fonte,
        fonteUrl,
        totalCargaMensal(dados),
        0,
      );
      return { total, porSubsistema: dados.filter((d) => d.mes === total.periodo) };
    } catch (e) {
      console.error(`coletor ons: ${String(e)}`);
      return {
        total: indicadorPendente("ons-carga-mensal", "Carga de energia — total dos subsistemas", `Fonte indisponível (${String(e)}).`, fonte, fonteUrl),
        porSubsistema: [],
      };
    }
  })();
}

// ---------------- Empresas (CVM) ----------------

export type Balancos = { empresas: BalancoEmpresa[]; exercicioFonte: string };

/**
 * Balanços das listadas no catálogo, a partir do DFP da CVM (open data).
 * O zip é baixado e descompactado no runtime (fflate) e o resultado parseado
 * vai para o KV com TTL de 24h — o download não acontece a cada visita.
 */
export function getBalancos(env: Env): Promise<Balancos> {
  return cachedValor<Balancos>(env, "cvm:balancos:v1", 24 * 3600, async () => {
    const res = await fetch(CVM_DFP_URL, { headers: { "User-Agent": "brasil-em-dados/0.1" }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} no DFP da CVM (dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/Dados/)`);
    const { unzipSync } = await import("fflate");
    const zip = new Uint8Array(await res.arrayBuffer());
    const arquivos = unzipSync(zip);
    const dre = arquivos["dfp_cia_aberta_DRE_con_2025.csv"];
    if (!dre) throw new Error("CSV da DRE não encontrado no zip da CVM");
    const txt = new TextDecoder("latin1").decode(dre);
    const empresas = parseCvmDreCsv(txt, EMPRESAS_CATALOGO);
    if (empresas.length === 0) throw new Error("Empresas do catálogo não encontradas na DRE");
    return { empresas, exercicioFonte: "dfp_cia_aberta_2025.zip" };
  });
}

export async function getBalancosSeguro(env: Env): Promise<Balancos | null> {
  try {
    return await getBalancos(env);
  } catch (e) {
    console.error(`coletor cvm: ${String(e)}`);
    return null;
  }
}
