// Testes do parser World Bank (fixtures reais salvas de api.worldbank.org).

import { describe, expect, it } from "vitest";
import { parseWorldBank, observacoesWorldBank, variacaoYoY } from "../src/lib/parsers-worldbank";
import { fixture } from "./helpers";

describe("parseWorldBank", () => {
  it("lê resposta real (fixture) e ignora metadados", () => {
    const linhas = parseWorldBank(fixture("worldbank-sample.json"));
    expect(linhas.length).toBe(5);
    expect(linhas[0].countryiso3code).toBeTruthy();
    expect(typeof linhas[0].date).toBe("string");
  });

  it("lança em resposta sem linhas", () => {
    expect(() => parseWorldBank(JSON.stringify([{ page: 1, pages: 1 }, null]))).toThrow();
    expect(() => parseWorldBank(JSON.stringify({ erro: true }))).toThrow();
  });
});

describe("observacoesWorldBank", () => {
  it("filtra por país, descarta null e ordena por ano", () => {
    const linhas = parseWorldBank(fixture("worldbank-sample.json"));
    const bra = observacoesWorldBank(linhas, "BRA");
    expect(bra.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < bra.length; i++) {
      expect(bra[i].periodo > bra[i - 1].periodo).toBe(true);
      expect(Number.isFinite(bra[i].valor)).toBe(true);
    }
    // países fora do filtro viram série vazia
    expect(observacoesWorldBank(linhas, "ZZZ")).toEqual([]);
  });
});

describe("variacaoYoY", () => {
  it("série percentual: diferença em pontos percentuais", () => {
    expect(variacaoYoY([{ periodo: "2023", valor: 4.5 }, { periodo: "2024", valor: 3.0 }], true)).toEqual({
      valor: -1.5,
      tipo: "pp",
    });
  });

  it("série absoluta: variação % relativa", () => {
    expect(variacaoYoY([{ periodo: "2023", valor: 200 }, { periodo: "2024", valor: 220 }], false)).toEqual({
      valor: 10,
      tipo: "pct",
    });
  });

  it("menos de 2 pontos ou base 0 -> null", () => {
    expect(variacaoYoY([{ periodo: "2024", valor: 3 }], true)).toBeNull();
    expect(variacaoYoY([{ periodo: "2023", valor: 0 }, { periodo: "2024", valor: 3 }], false)).toBeNull();
  });
});
