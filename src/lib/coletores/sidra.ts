// Coletor IBGE apisidra (values) — desocupação, informalidade, PIB, população
// e IPCA acumulado 12m; mais ranking das UFs e drill-down por UF.
// Conversões de escala ficam AQUI, em constantes nomeadas — nenhuma página
// reescala valores (os valores já saem na unidade exibida).

import { cachedJson, type Env } from "../cache";
import type { IndicadorExibicao, MetaIndicador, Observacao } from "../model";
import { parseSidraValues, observacoesSidra, type SidraLinha } from "../parsers";
import { comFonte } from "./util";
import { ufPorSigla, UFS, type Uf } from "../localidades";
import { normalizarPeriodo } from "../periodos";

const APISIDRA_BASE = "https://apisidra.ibge.gov.br/values";
const TTL_DIA = 24 * 3600;

// Escala: apisidra entrega valores monetários em Mil Reais.
const MIL_REAIS_EM_UM_REAL = 1_000;
const MIL_REAIS_EM_UM_BILHAO = 1_000_000; // 1 R$ bi = 10^9 R$ = 10^6 mil R$

async function sidra(
  env: Env,
  key: string,
  tabela: string,
  variavel: string,
  periodo: string,
  nivel: string,
): Promise<SidraLinha[]> {
  const url = `${APISIDRA_BASE}/t/${tabela}/v/${variavel}/p/${periodo}/${nivel}`;
  const json = await cachedJson(env, key, url, TTL_DIA);
  return parseSidraValues(json);
}

export const DESOCUPACAO_META: MetaIndicador = {
  id: "sidra-desocupacao",
  nome: "Taxa de desocupação (PNAD Contínua)",
  unidade: "%",
  periodicidade: "trimestral-movel",
  fonte: "IBGE — PNAD Contínua (SIDRA 6381)",
  fonteUrl: "https://sidra.ibge.gov.br/tabela/6381",
  licenca: "verde",
  casas: 1,
  janelaSerie: 12,
  variacaoTipo: "pp",
};

/** Taxa de desocupação Brasil (SIDRA 6381, var 4099) — trimestral móvel. */
export const getDesocupacaoBrasil = comFonte(
  DESOCUPACAO_META,
  async (env) => {
    const linhas = await sidra(env, "sidra:6381:v1", "6381", "4099", "last%2024", "n1/1");
    return observacoesSidra(linhas, "4099", "1", "trimestral-movel");
  },
);

export const INFORMALIDADE_META: MetaIndicador = {
  id: "sidra-informalidade",
  nome: "Taxa de informalidade (PNAD Contínua)",
  unidade: "%",
  periodicidade: "anual",
  fonte: "IBGE — PNAD Contínua (SIDRA 4708)",
  fonteUrl: "https://sidra.ibge.gov.br/tabela/4708",
  licenca: "verde",
  casas: 1,
  janelaSerie: 12,
  variacaoTipo: "pp",
};

/** Taxa de informalidade Brasil (SIDRA 4708, var 12466) — anual. */
export const getInformalidadeBrasil = comFonte(
  INFORMALIDADE_META,
  async (env) => {
    const linhas = await sidra(env, "sidra:4708:v1", "4708", "12466", "last%205", "n1/1");
    return observacoesSidra(linhas, "12466", "1", "anual");
  },
);

export const PIB_META: MetaIndicador = {
  id: "sidra-pib",
  nome: "PIB — Brasil a preços correntes",
  unidade: "R$ bi",
  periodicidade: "anual",
  fonte: "IBGE — PIB dos Municípios (SIDRA 5938)",
  fonteUrl: "https://sidra.ibge.gov.br/tabela/5938",
  licenca: "verde",
  casas: 1,
  janelaSerie: 12,
};

/** PIB a preços correntes Brasil (SIDRA 5938, var 37) — anual, já em R$ bi. */
export const getPibBrasil = comFonte(PIB_META, async (env) => {
  const linhas = await sidra(env, "sidra:5938:v1", "5938", "37", "last%205", "n1/1");
  return observacoesSidra(linhas, "37", "1", "anual").map((o) => ({
    periodo: o.periodo,
    valor: o.valor / MIL_REAIS_EM_UM_BILHAO, // Mil Reais -> R$ bi (conversão única)
  }));
});

export const POPULACAO_META: MetaIndicador = {
  id: "sidra-populacao",
  nome: "População residente estimada",
  unidade: "habitantes",
  periodicidade: "anual",
  fonte: "IBGE — Estimativas de população (SIDRA 6579)",
  fonteUrl: "https://sidra.ibge.gov.br/tabela/6579",
  licenca: "verde",
  casas: 0,
  janelaSerie: 12,
};

/** População residente estimada por ano (apisidra 6579, var 9324, N1) — anual. */
export const getPopulacaoBrasil = comFonte(POPULACAO_META, async (env) => {
  const linhas = await sidra(env, "sidra:6579:v2", "6579", "9324", "last%205", "n1/1");
  return observacoesSidra(linhas, "9324", "1", "anual");
});

export const IPCA_12M_META: MetaIndicador = {
  id: "sidra-ipca-12m",
  nome: "IPCA — acumulado em 12 meses",
  unidade: "%",
  periodicidade: "mensal",
  fonte: "IBGE — IPCA (SIDRA 1737)",
  fonteUrl: "https://sidra.ibge.gov.br/tabela/1737",
  licenca: "verde",
  casas: 2,
  janelaSerie: 12,
  variacaoTipo: "pp",
};

/** IPCA — acumulado em 12 meses (apisidra 1737, var 2265) — mensal. */
export const getIpcaAcum12m = comFonte(IPCA_12M_META, async (env) => {
  const linhas = await sidra(env, "sidra:1737:2265:v2", "1737", "2265", "last%2013", "n1/1");
  return observacoesSidra(linhas, "2265", "1", "mensal");
});

// ---------------- Ranking das UFs (uma consulta por indicador, n3/all) ----------------

export type LinhaRankingUf = {
  sigla: string;
  nome: string;
  codigo: string;
  /** PIB corrente em R$ bi (unidade de exibição — conversão feita aqui) */
  pib: number | null;
  pibParticipacao: number | null;
  /** R$ por habitante */
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
    cachedJson(env, "sidra:5938:37:all:v2", `${APISIDRA_BASE}/t/5938/v/37/p/last/n3/all`, TTL_DIA).then((j) => parseSidraValues(j)),
    cachedJson(env, "sidra:5938:496:all:v2", `${APISIDRA_BASE}/t/5938/v/496/p/last/n3/all`, TTL_DIA).then((j) => parseSidraValues(j)),
    cachedJson(env, "sidra:4562:4099:all:v2", `${APISIDRA_BASE}/t/4562/v/4099/p/last/n3/all`, TTL_DIA).then((j) => parseSidraValues(j)),
    cachedJson(env, "sidra:4708:12466:all:v2", `${APISIDRA_BASE}/t/4708/v/12466/p/last/n3/all`, TTL_DIA).then((j) => parseSidraValues(j)),
    cachedJson(env, "sidra:6579:9324:all:v2", `${APISIDRA_BASE}/t/6579/v/9324/p/last/n3/all`, TTL_DIA).then((j) => parseSidraValues(j)),
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
      pib: pibU ? pibU.valor / MIL_REAIS_EM_UM_BILHAO : null, // Mil Reais -> R$ bi
      pibParticipacao: ultimo(partS)?.valor ?? null,
      pibPerCapita:
        pibU && popU && popU.valor > 0
          ? (pibU.valor * MIL_REAIS_EM_UM_REAL) / popU.valor // Mil Reais -> R$
          : null,
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
      {
        id: "ibge-sidra-5938-pib",
        nome: "PIB a preços correntes",
        unidade: "R$ bi",
        periodicidade: "anual",
        fonte: "IBGE — PIB dos Municípios (SIDRA 5938)",
        fonteUrl: "https://sidra.ibge.gov.br/tabela/5938",
        licenca: "verde",
        casas: 1,
        janelaSerie: 12,
      },
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
          valor: o.valor / MIL_REAIS_EM_UM_BILHAO, // Mil Reais -> R$ bi
        }));
      },
    )(env),
    comFonte(
      {
        id: "ibge-sidra-5938-pib-participacao",
        nome: "Participação no PIB do Brasil",
        unidade: "%",
        periodicidade: "anual",
        fonte: "IBGE — PIB dos Municípios (SIDRA 5938)",
        fonteUrl: "https://sidra.ibge.gov.br/tabela/5938",
        licenca: "verde",
        casas: 2,
        janelaSerie: 12,
      },
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
    )(env),
    comFonte(
      {
        id: "ibge-sidra-4562-desocupacao",
        nome: "Taxa de desocupação (média anual)",
        unidade: "%",
        periodicidade: "anual",
        fonte: "IBGE — PNAD Contínua (SIDRA 4562)",
        fonteUrl: "https://sidra.ibge.gov.br/tabela/4562",
        licenca: "verde",
        casas: 1,
        janelaSerie: 12,
      },
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
    )(env),
    comFonte(
      {
        id: "ibge-sidra-4708-informalidade",
        nome: "Taxa de informalidade",
        unidade: "%",
        periodicidade: "anual",
        fonte: "IBGE — PNAD Contínua (SIDRA 4708)",
        fonteUrl: "https://sidra.ibge.gov.br/tabela/4708",
        licenca: "verde",
        casas: 1,
        janelaSerie: 12,
      },
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
    )(env),
  ]);
  return { uf, pib, pibParticipacao: part, desocupacao: desoc, informalidade: informal };
}
