import { describe, expect, it } from "vitest";
import { parseOnsCargaMensal, totalCargaMensal } from "../src/lib/parsers";
import { fixture } from "./helpers";

describe("parser ONS carga mensal (CARGA_MENSAL.csv real, ';' delimitado)", () => {
  const dados = parseOnsCargaMensal(fixture("ons_carga_mensal_sample.csv"));

  it("descarta meses incompletos ('0E-8')", () => {
    for (const d of dados) expect(d.mwmed).toBeGreaterThan(0);
    const meses = new Set(dados.map((d) => d.mes));
    expect(meses.has("2026-10")).toBe(false);
  });

  it("tem os 4 subsistemas por mês", () => {
    const porMes = new Map<string, Set<string>>();
    for (const d of dados) {
      if (!porMes.has(d.mes)) porMes.set(d.mes, new Set());
      porMes.get(d.mes)!.add(d.subsistema);
    }
    for (const subs of porMes.values()) {
      expect(subs.size).toBe(4);
    }
  });

  it("total mensal soma os subsistemas e é ordenado", () => {
    const total = totalCargaMensal(dados);
    expect(total.length).toBeGreaterThan(0);
    const primeira = total[0];
    const somaPrimeiroMes = dados
      .filter((d) => d.mes === primeira.periodo)
      .reduce((s, d) => s + d.mwmed, 0);
    expect(primeira.valor).toBeCloseTo(somaPrimeiroMes, 0);
    // carga total do SIN em mês típico: dezenas de milhares de MWmed
    expect(primeira.valor).toBeGreaterThan(30000);
    expect(total).toEqual([...total].sort((a, b) => a.periodo.localeCompare(b.periodo)));
  });
});
