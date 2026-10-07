// Coletor ONS — carga mensal de energia por subsistema (CSV de dados abertos).

import { cachedTexto, type Env } from "../cache";
import { indicadorPendente, montarIndicador, type MetaIndicador } from "../model";
import { parseOnsCargaMensal, totalCargaMensal, type OnsCargaMes } from "../parsers";

const ONS_CARGA_URL =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/carga_energia_me/CARGA_MENSAL.csv";

export const CARGA_META: MetaIndicador = {
  id: "ons-carga",
  nome: "Carga de energia — total dos subsistemas",
  unidade: "MWmed",
  periodicidade: "mensal",
  fonte: "ONS — Dados Abertos (Carga Mensal, CC-BY)",
  fonteUrl: "https://dados.ons.org.br/dataset/carga-mensal",
  licenca: "verde",
  casas: 0,
  janelaSerie: 12,
};

export type CargaEnergia = {
  total: ReturnType<typeof montarIndicador>;
  porSubsistema: { mes: string; subsistema: string; mwmed: number }[];
};

export async function getCargaEnergia(env: Env): Promise<CargaEnergia> {
  try {
    const csv = await cachedTexto(env, "ons:carga:v1", ONS_CARGA_URL, 6 * 3600);
    const dados: OnsCargaMes[] = parseOnsCargaMensal(csv);
    const total = montarIndicador(CARGA_META, totalCargaMensal(dados));
    return { total, porSubsistema: dados.filter((d) => d.mes === total.periodo) };
  } catch (e) {
    console.error(`coletor ons: ${String(e)}`);
    return {
      total: indicadorPendente(CARGA_META, `Fonte indisponível (${String(e)}).`),
      porSubsistema: [],
    };
  }
}
