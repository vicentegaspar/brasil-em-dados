// REGISTRO ÚNICO de indicadores nacionais (Brasil) — fonte da verdade para
// coletores, páginas e API. Adicionar um descritor aqui o expõe de uma vez em:
// /api/v1/serie, /api/v1/indicadores, /api/indicadores.json, /graficos e na home.
// World Bank (multi-país) tem registro próprio em worldbank.ts (INDICADORES_WB).

import type { Env } from "./cache";
import type { IndicadorExibicao, MetaIndicador } from "./model";
import {
  getCambio,
  getIpcaMensal,
  getSelicMeta,
  CAMBIO_META,
  IPCA_MENSAL_META,
  SELIC_META,
} from "./coletores/bcb";
import {
  getDesocupacaoBrasil,
  getInformalidadeBrasil,
  getIpcaAcum12m,
  getPibBrasil,
  getPopulacaoBrasil,
  DESOCUPACAO_META,
  INFORMALIDADE_META,
  IPCA_12M_META,
  PIB_META,
  POPULACAO_META,
} from "./coletores/sidra";
import { getCargaEnergia, CARGA_META } from "./coletores/ons";
import {
  getJurosReais,
  getPibPerCapitaBrasil,
  JUROS_REAIS_META,
  PIB_PER_CAPITA_META,
} from "./coletores/derivados";

export type DescriptorIndicador = MetaIndicador & {
  /** Grupo na UI de seleção de séries (/graficos) */
  grupo: string;
  coletar: (env: Env) => Promise<IndicadorExibicao>;
};

const DESCRITORES: DescriptorIndicador[] = [
  { ...SELIC_META, grupo: "BCB SGS (Brasil)", coletar: getSelicMeta },
  { ...CAMBIO_META, grupo: "BCB SGS (Brasil)", coletar: getCambio },
  { ...IPCA_MENSAL_META, grupo: "BCB SGS (Brasil)", coletar: getIpcaMensal },
  { ...DESOCUPACAO_META, grupo: "IBGE (Brasil)", coletar: getDesocupacaoBrasil },
  { ...INFORMALIDADE_META, grupo: "IBGE (Brasil)", coletar: getInformalidadeBrasil },
  { ...PIB_META, grupo: "IBGE (Brasil)", coletar: getPibBrasil },
  { ...POPULACAO_META, grupo: "IBGE (Brasil)", coletar: getPopulacaoBrasil },
  { ...IPCA_12M_META, grupo: "IBGE (Brasil)", coletar: getIpcaAcum12m },
  {
    ...CARGA_META,
    grupo: "ONS (Brasil)",
    coletar: async (env) => (await getCargaEnergia(env)).total,
  },
  {
    ...PIB_PER_CAPITA_META,
    grupo: "Derivados (Brasil)",
    coletar: getPibPerCapitaBrasil,
  },
  {
    ...JUROS_REAIS_META,
    grupo: "Derivados (Brasil)",
    coletar: getJurosReais,
  },
];

const REGISTRO: ReadonlyMap<string, DescriptorIndicador> = new Map(
  DESCRITORES.map((d) => [d.id, d]),
);

export function descritorPorId(id: string): DescriptorIndicador | undefined {
  return REGISTRO.get(id);
}

export function descritores(): DescriptorIndicador[] {
  return DESCRITORES;
}
