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
  type SidraLinha,
} from "./parsers";
import {
  formatarNumero,
  formatarPeriodoDiaria,
  formatarPeriodoMensal,
  normalizarPeriodo,
} from "./periodos";
import { ufPorSigla, UFS, type Uf } from "./localidades";

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

// ---------------- Novas séries Brasil (scorecards) ----------------

/** População residente estimada por ano (apisidra 6579, var 9324, N1) — anual. */
export function getPopulacaoBrasil(env: Env): Promise<IndicadorExibicao> {
  return comFonte(
    "ibge-sidra-6579-populacao",
    "População residente estimada",
    "habitantes",
    "anual",
    "IBGE — Estimativas de população (SIDRA 6579)",
    "https://sidra.ibge.gov.br/tabela/6579",
    0,
    async () => {
      const linhas = await sidra(env, "sidra:6579:v2", "6579", "9324", "last%205", "n1/1");
      return observacoesSidra(linhas, "9324", "1", "anual");
    },
  );
}

/** IPCA — acumulado em 12 meses (apisidra 1737, var 2265) — mensal. */
export function getIpcaAcum12m(env: Env): Promise<IndicadorExibicao> {
  return comFonte(
    "ibge-sidra-1737-ipca-12m",
    "IPCA — acumulado em 12 meses",
    "%",
    "mensal",
    "IBGE — IPCA (SIDRA 1737)",
    "https://sidra.ibge.gov.br/tabela/1737",
    2,
    async () => {
      const linhas = await sidra(env, "sidra:1737:2265:v2", "1737", "2265", "last%2013", "n1/1");
      return observacoesSidra(linhas, "2265", "1", "mensal");
    },
  );
}

/**
 * PIB per capita derivado do IBGE: PIB corrente (5938 var 37, R$) ÷ população
 * estimada (6579 var 9324, habitantes) para o mesmo ano. Fórmula documentada
 * na página /scorecards. Indisponível quando os dois anos não casam.
 */
export async function getPibPerCapitaBrasil(env: Env): Promise<IndicadorExibicao> {
  const fonte = "IBGE — derivado: PIB (SIDRA 5938) ÷ população estimada (SIDRA 6579)";
  const fonteUrl = "https://sidra.ibge.gov.br/tabela/5938";
  try {
    const [pib, pop] = await Promise.all([
      getPibBrasil(env),
      getPopulacaoBrasil(env),
    ]);
    if (pib.indisponivelMotivo || pop.indisponivelMotivo) {
      return indicadorPendente(
        "ibge-derivado-pib-per-capita",
        "PIB per capita (derivado)",
        `Componente indisponível: ${pib.indisponivelMotivo ?? pop.indisponivelMotivo}`,
        fonte,
        fonteUrl,
      );
    }
    const porAnoPib = new Map(pib.serie.map((o) => [o.periodo, o.valor]));
    const obs: Observacao[] = [];
    for (const o of pop.serie) {
      const pibAno = porAnoPib.get(o.periodo);
      if (pibAno && o.valor > 0) obs.push({ periodo: o.periodo, valor: pibAno / o.valor });
    }
    return montarIndicador(
      "ibge-derivado-pib-per-capita",
      "PIB per capita (derivado)",
      "R$",
      "anual",
      fonte,
      fonteUrl,
      obs,
      0,
    );
  } catch (e) {
    console.error(`coletor pib-per-capita: ${String(e)}`);
    return indicadorPendente("ibge-derivado-pib-per-capita", "PIB per capita (derivado)", `Cálculo indisponível (${String(e)}).`, fonte, fonteUrl);
  }
}

/** Juros reais ex-ante aproximado: Selic meta − IPCA acumulado 12 meses (p.p.). */
export async function getJurosReais(env: Env): Promise<IndicadorExibicao> {
  const fonte = "BCB (SGS 1178) − IBGE (SIDRA 1737) — derivado";
  const fonteUrl = "https://www3.bcb.gov.br/sgspub/";
  try {
    const [selic, ipca] = await Promise.all([getSelicMeta(env), getIpcaAcum12m(env)]);
    if (selic.indisponivelMotivo || ipca.indisponivelMotivo) {
      return indicadorPendente(
        "derivado-juros-reais",
        "Juros reais (Selic − IPCA 12m)",
        `Componente indisponível: ${selic.indisponivelMotivo ?? ipca.indisponivelMotivo}`,
        fonte,
        fonteUrl,
      );
    }
    const valor = selic.valor - ipca.valor;
    return {
      ...montarIndicador(
        "derivado-juros-reais",
        "Juros reais (Selic − IPCA 12m)",
        "p.p.",
        "diaria",
        fonte,
        fonteUrl,
        [{ periodo: selic.periodo, valor }],
        2,
      ),
      periodoFormatado: `${selic.periodoFormatado} (Selic) vs ${ipca.periodoFormatado} (IPCA)`,
    };
  } catch (e) {
    console.error(`coletor juros-reais: ${String(e)}`);
    return indicadorPendente("derivado-juros-reais", "Juros reais (Selic − IPCA 12m)", `Cálculo indisponível (${String(e)}).`, fonte, fonteUrl);
  }
}

// ---------------- Ranking das UFs (uma consulta por indicador, n3/all) ----------------

export type LinhaRankingUf = {
  sigla: string;
  nome: string;
  codigo: string;
  pib: number | null;
  pibParticipacao: number | null;
  pibPerCapita: number | null;
  desocupacao: number | null;
  informalidade: number | null;
  populacao: number | null;
  /** Ano de referência do PIB (pode diferir dos demais) */
  anoPib: string | null;
  anoPopulacao: string | null;
  anoDesocupacao: string | null;
};

export async function getRankingUf(env: Env): Promise<LinhaRankingUf[]> {
  const [pibL, partL, desocL, informalL, popL] = await Promise.all([
    cachedJson(env, "sidra:5938:37:all:v2", `${APISIDRA_BASE}/t/5938/v/37/p/last/n3/all`, 24 * 3600).then((j) => parseSidraValues(JSON.stringify(j))),
    cachedJson(env, "sidra:5938:496:all:v2", `${APISIDRA_BASE}/t/5938/v/496/p/last/n3/all`, 24 * 3600).then((j) => parseSidraValues(JSON.stringify(j))),
    cachedJson(env, "sidra:4562:4099:all:v2", `${APISIDRA_BASE}/t/4562/v/4099/p/last/n3/all`, 24 * 3600).then((j) => parseSidraValues(JSON.stringify(j))),
    cachedJson(env, "sidra:4708:12466:all:v2", `${APISIDRA_BASE}/t/4708/v/12466/p/last/n3/all`, 24 * 3600).then((j) => parseSidraValues(JSON.stringify(j))),
    cachedJson(env, "sidra:6579:9324:all:v2", `${APISIDRA_BASE}/t/6579/v/9324/p/last/n3/all`, 24 * 3600).then((j) => parseSidraValues(JSON.stringify(j))),
  ]);

  function serieUf(linhas: SidraLinha[], codigo: string): Observacao[] {
    // variável muda por tabela; extrai por D3C aceitando qualquer D1C
    const obs: Observacao[] = [];
    for (const l of linhas) {
      if (l["D3C"] !== codigo) continue;
      const valor = Number(l["V"]);
      if (!Number.isFinite(valor)) continue;
      obs.push({ periodo: normalizarPeriodo("anual", l["D2C"] ?? ""), valor });
    }
    return obs.sort((a, b) => a.periodo.localeCompare(b.periodo));
  }

  const out: LinhaRankingUf[] = [];
  for (const uf of UFS) {
    const cod = uf.codigo;
    const pibS = serieUf(pibL, cod);
    const partS = serieUf(partL, cod);
    const desocS = serieUf(desocL, cod);
    const informalS = serieUf(informalL, cod);
    const popS = serieUf(popL, cod);
    const ultimo = (s: Observacao[]) => (s.length ? s[s.length - 1] : null);
    const pibU = ultimo(pibS);
    const popU = ultimo(popS);
    out.push({
      sigla: uf.sigla,
      nome: uf.nome,
      codigo: cod,
      pib: pibU ? pibU.valor * 1000 : null, // Mil Reais -> Reais
      pibParticipacao: ultimo(partS)?.valor ?? null,
      pibPerCapita: pibU && popU && popU.valor > 0 ? (pibU.valor * 1000) / popU.valor : null,
      desocupacao: ultimo(desocS)?.valor ?? null,
      informalidade: ultimo(informalS)?.valor ?? null,
      populacao: popU?.valor ?? null,
      anoPib: pibU?.periodo ?? null,
      anoPopulacao: popU?.periodo ?? null,
      anoDesocupacao: ultimo(desocS)?.periodo ?? null,
    });
  }
  return out;
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
 * Coletor de BUILD: o zip anual é pesado para o runtime do Workers (limite de
 * CPU — error 1102 em produção). O script scripts/generate-empresas.ts baixa,
 * parseia e versiona o resultado em src/data/empresas.json (rode com
 * `npx tsx scripts/generate-empresas.ts` quando a CVM publicar o novo DFP).
 */
import empresasDados from "../data/empresas.json";

const BALANCOS_DADOS = empresasDados as unknown as Balancos;

export function getBalancos(_env: Env): Promise<Balancos> {
  return Promise.resolve(BALANCOS_DADOS);
}

export async function getBalancosSeguro(env: Env): Promise<Balancos | null> {
  try {
    return await getBalancos(env);
  } catch (e) {
    console.error(`coletor cvm: ${String(e)}`);
    return null;
  }
}
