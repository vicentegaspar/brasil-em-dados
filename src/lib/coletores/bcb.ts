// Coletor BCB SGS (api.bcb.gov.br) — Selic meta, câmbio PTAX e IPCA mensal.
// Cada série é um MetaIndicador + uma função de coleta; os metadados vivem
// aqui e são reaproveitados pelo registro único (registro.ts).

import { cachedJson } from "../cache";
import type { MetaIndicador } from "../model";
import { parseBcbSgs } from "../parsers";
import { comFonte } from "./util";

const BCB_BASE = "https://api.bcb.gov.br/dados/serie";

export const SELIC_META: MetaIndicador = {
  id: "bcb-selic",
  nome: "Taxa Selic definida pelo Copom",
  unidade: "% a.a.",
  periodicidade: "diaria",
  fonte: "Banco Central do Brasil — SGS série 1178",
  fonteUrl: "https://www3.bcb.gov.br/sgspub/",
  licenca: "verde",
  casas: 2,
  janelaSerie: 12,
};

/** Selic definida pelo Copom (SGS 1178), % a.a. */
export const getSelicMeta = comFonte(SELIC_META, async (env) => {
  const json = await cachedJson(
    env,
    "bcb:1178:v1",
    `${BCB_BASE}/bcdata.sgs.1178/dados/ultimos/2?formato=json`,
    6 * 3600,
  );
  return parseBcbSgs(json);
});

export const CAMBIO_META: MetaIndicador = {
  id: "bcb-cambio",
  nome: "Dólar — PTAX (compra)",
  unidade: "R$/US$",
  periodicidade: "diaria",
  fonte: "Banco Central do Brasil — SGS série 1",
  fonteUrl: "https://www3.bcb.gov.br/sgspub/",
  licenca: "verde",
  casas: 4,
  janelaSerie: 12,
};

/** Câmbio: PTAX dólar compra (SGS 1). */
export const getCambio = comFonte(CAMBIO_META, async (env) => {
  const json = await cachedJson(
    env,
    "bcb:1:v1",
    `${BCB_BASE}/bcdata.sgs.1/dados/ultimos/2?formato=json`,
    6 * 3600,
  );
  return parseBcbSgs(json);
});

export const IPCA_MENSAL_META: MetaIndicador = {
  id: "bcb-ipca-mensal",
  nome: "IPCA — variação mensal",
  unidade: "%",
  periodicidade: "mensal",
  fonte: "IBGE/BCB — SGS série 433 (IPCA mensal)",
  fonteUrl: "https://www3.bcb.gov.br/sgspub/",
  licenca: "verde",
  casas: 2,
  janelaSerie: 12,
  // série já é variação %: diferença entre meses = pontos percentuais
  variacaoTipo: "pp",
};

/** IPCA mensal (SGS 433), % no mês. */
export const getIpcaMensal = comFonte(IPCA_MENSAL_META, async (env) => {
  const json = await cachedJson(
    env,
    "bcb:433:v1",
    `${BCB_BASE}/bcdata.sgs.433/dados/ultimos/2?formato=json`,
    12 * 3600,
  );
  return parseBcbSgs(json, "mensal");
});
