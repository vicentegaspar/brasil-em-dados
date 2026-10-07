// Parsers do World Bank Open Data API (v2) — puros, testados contra fixtures.
// Formato: [meta, [{indicator:{id,value}, country:{id,value}, countryiso3code,
//          date:"2024", value: number|null, ...}, ...]]
// Linhas com value null = ano sem dado para o país — descartadas.
// Os parsers aceitam o texto bruto da fonte OU o objeto já parseado (cache).

import type { Observacao } from "./model";

export type LinhaWorldBank = {
  countryiso3code: string;
  country: { id: string; value: string };
  date: string;
  value: number | null;
};

export function parseWorldBank(dados: string | unknown): LinhaWorldBank[] {
  if (typeof dados === "string") dados = JSON.parse(dados) as unknown;
  const bruto = dados as unknown;
  if (!Array.isArray(bruto) || bruto.length < 2 || !Array.isArray(bruto[1])) {
    throw new Error("World Bank: resposta sem linhas (formato inesperado)");
  }
  return bruto[1] as LinhaWorldBank[];
}

/**
 * Série anual de um país (por ISO3), ordenada, com os valores não nulos.
 * O valor é usado como veio (percentuais como percentual, moedas como moeda).
 */
export function observacoesWorldBank(linhas: LinhaWorldBank[], iso3: string): Observacao[] {
  const obs: Observacao[] = [];
  for (const l of linhas) {
    if (l.countryiso3code !== iso3) continue;
    const ano = /^(\d{4})$/.exec(l.date);
    if (!ano || l.value == null || !Number.isFinite(l.value)) continue;
    obs.push({ periodo: ano[1], valor: l.value });
  }
  return obs.sort((a, b) => a.periodo.localeCompare(b.periodo));
}

/**
 * Variação anual (YoY) entre as duas últimas observações.
 * - séries em unidade absoluta (moeda, população): variação % = (v2-v1)/|v1| * 100
 * - séries em percentual (crescimento, desemprego, inflação, dívida): diferença
 *   em pontos percentuais (v2-v1).
 * `tipoPercentual` decide o cálculo. Retorna null se houver menos de 2 pontos
 * ou base 0.
 */
export function variacaoYoY(
  obs: Observacao[],
  tipoPercentual: boolean,
): { valor: number; tipo: "pp" | "pct" } | null {
  if (obs.length < 2) return null;
  const v2 = obs[obs.length - 1].valor;
  const v1 = obs[obs.length - 2].valor;
  if (!Number.isFinite(v1) || !Number.isFinite(v2) || v1 === 0) return null;
  if (tipoPercentual) return { valor: v2 - v1, tipo: "pp" };
  return { valor: ((v2 - v1) / Math.abs(v1)) * 100, tipo: "pct" };
}
