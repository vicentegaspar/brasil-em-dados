// Indicadores derivados — calculados a partir de duas séries primárias do
// registro. A fórmula fica documentada na fonte e na página /scorecards.
// Componente indisponível => derivado indisponível (nunca parcial/inventado).

import type { Env } from "../cache";
import { indicadorPendente, montarIndicador, type MetaIndicador, type Observacao } from "../model";
import { getIpcaAcum12m, getPibBrasil, getPopulacaoBrasil } from "./sidra";
import { getSelicMeta } from "./bcb";

// 1 R$ bi = 10^9 R$ — o PIB coletado está em R$ bi (unidade de exibição)
const REAIS_EM_UM_BILHAO = 1_000_000_000;

export const PIB_PER_CAPITA_META: MetaIndicador = {
  id: "derivado-pib-per-capita",
  nome: "PIB per capita (derivado)",
  unidade: "R$",
  periodicidade: "anual",
  fonte: "IBGE — derivado: PIB (SIDRA 5938) ÷ população estimada (SIDRA 6579)",
  fonteUrl: "https://sidra.ibge.gov.br/tabela/5938",
  licenca: "verde",
  casas: 0,
  janelaSerie: 12,
};

export const JUROS_REAIS_META: MetaIndicador = {
  id: "derivado-juros-reais",
  nome: "Juros reais (Selic − IPCA 12m)",
  unidade: "p.p.",
  periodicidade: "diaria",
  fonte: "BCB (SGS 1178) − IBGE (SIDRA 1737) — derivado",
  fonteUrl: "https://www3.bcb.gov.br/sgspub/",
  licenca: "verde",
  casas: 2,
  janelaSerie: 12,
  variacaoTipo: "pp",
};

/**
 * PIB per capita derivado do IBGE: PIB corrente (5938 var 37, R$ bi) ÷ população
 * estimada (6579 var 9324, habitantes) para o mesmo ano. Fórmula documentada
 * na página /scorecards. Indisponível quando os dois anos não casam.
 */
export async function getPibPerCapitaBrasil(env: Env): Promise<ReturnType<typeof montarIndicador>> {
  try {
    const [pib, pop] = await Promise.all([
      getPibBrasil(env),
      getPopulacaoBrasil(env),
    ]);
    if (pib.indisponivelMotivo || pop.indisponivelMotivo) {
      return indicadorPendente(
        PIB_PER_CAPITA_META,
        `Componente indisponível: ${pib.indisponivelMotivo ?? pop.indisponivelMotivo}`,
      );
    }
    const porAnoPib = new Map(pib.serie.map((o) => [o.periodo, o.valor]));
    const obs: Observacao[] = [];
    for (const o of pop.serie) {
      const pibBilhoes = porAnoPib.get(o.periodo);
      if (pibBilhoes && o.valor > 0) {
        obs.push({ periodo: o.periodo, valor: (pibBilhoes * REAIS_EM_UM_BILHAO) / o.valor });
      }
    }
    return montarIndicador(PIB_PER_CAPITA_META, obs);
  } catch (e) {
    console.error(`coletor pib-per-capita: ${String(e)}`);
    return indicadorPendente(PIB_PER_CAPITA_META, `Cálculo indisponível (${String(e)}).`);
  }
}

/** Juros reais ex-ante aproximado: Selic meta − IPCA acumulado 12 meses (p.p.). */
export async function getJurosReais(env: Env): Promise<ReturnType<typeof montarIndicador>> {
  try {
    const [selic, ipca] = await Promise.all([getSelicMeta(env), getIpcaAcum12m(env)]);
    if (selic.indisponivelMotivo || ipca.indisponivelMotivo) {
      return indicadorPendente(
        JUROS_REAIS_META,
        `Componente indisponível: ${selic.indisponivelMotivo ?? ipca.indisponivelMotivo}`,
      );
    }
    const valor = selic.valor - ipca.valor;
    return {
      ...montarIndicador(JUROS_REAIS_META, [{ periodo: selic.periodo, valor }]),
      periodoFormatado: `${selic.periodoFormatado} (Selic) vs ${ipca.periodoFormatado} (IPCA)`,
    };
  } catch (e) {
    console.error(`coletor juros-reais: ${String(e)}`);
    return indicadorPendente(JUROS_REAIS_META, `Cálculo indisponível (${String(e)}).`);
  }
}
