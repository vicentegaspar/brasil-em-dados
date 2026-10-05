import { describe, expect, it } from "vitest";
import { EMPRESAS_CATALOGO, parseCvmDreCsv, type BalancoEmpresa } from "../src/lib/parsers";
import { fixture } from "./helpers";

describe("parser CVM DRE (csv real do dfp_cia_aberta_2025.zip)", () => {
  const balancos: BalancoEmpresa[] = parseCvmDreCsv(
    fixture("cvm_dre_con_2025_sample.csv"),
    EMPRESAS_CATALOGO,
  );

  it("encontra as 3 empresas do catálogo", () => {
    const tickers = new Set(balancos.map((b) => b.ticker));
    expect([...tickers].sort()).toEqual(["BBAS3", "ITUB", "PETR"]);
  });

  it("PETR receita FY2025 real: R$ 497,549 bi (497.549.000 mil)", () => {
    const petr = balancos.find((b) => b.ticker === "PETR" && b.ano === 2025)!;
    expect(petr.receita).toBeCloseTo(497_549_000_000);
    expect(petr.nome).toContain("PETROBRAS");
  });

  it("ITUB receitas de intermediação FY2025 real: R$ 387,118 bi", () => {
    const itub = balancos.find((b) => b.ticker === "ITUB" && b.ano === 2025)!;
    expect(itub.receita).toBeCloseTo(387_118_000_000);
  });

  it("BBAS3 receitas FY2024 real: R$ 273,505 bi", () => {
    const bbas = balancos.find((b) => b.ticker === "BBAS3" && b.ano === 2024)!;
    expect(bbas.receita).toBeCloseTo(273_505_274_000);
  });

  it("prefere ÚLTIMO sobre PENÚLTIMO para o mesmo exercício", () => {
    const petr2024 = balancos.find((b) => b.ticker === "PETR" && b.ano === 2024)!;
    expect(petr2024.receita).toBeCloseTo(490_829_000_000);
  });

  it("empresas ordenadas por ano decrescente", () => {
    const anos = balancos.map((b) => b.ano);
    for (let i = 1; i < anos.length; i++) expect(anos[i - 1]).toBeGreaterThanOrEqual(anos[i]);
  });

  it("catálogo cobre PETR, ITUB e BBAS3 com CNPJs reais", () => {
    expect(EMPRESAS_CATALOGO.map((e) => e.ticker).sort()).toEqual(["BBAS3", "ITUB", "PETR"]);
    for (const e of EMPRESAS_CATALOGO) {
      expect(e.cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
    }
  });
});
