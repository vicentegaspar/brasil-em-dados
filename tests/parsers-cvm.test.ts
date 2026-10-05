import { describe, expect, it } from "vitest";
import { EMPRESAS_CATALOGO, parseCvmDreCsv, type BalancoEmpresa } from "../src/lib/parsers";
import { fixture } from "./helpers";

describe("parser CVM DRE (csv real do dfp_cia_aberta_2025.zip)", () => {
  const balancos: BalancoEmpresa[] = parseCvmDreCsv(
    fixture("cvm_dre_con_2025_sample.csv"),
    EMPRESAS_CATALOGO,
  );

  it("catálogo cobre 15 empresas com CNPJs reais (conf. CAD CVM)", () => {
    expect(EMPRESAS_CATALOGO.length).toBeGreaterThanOrEqual(12);
    const tickers = EMPRESAS_CATALOGO.map((e) => e.ticker).sort();
    expect(tickers).toContain("PETR4");
    expect(tickers).toContain("ITUB4");
    expect(tickers).toContain("BBAS3");
    expect(tickers).toContain("VALE3");
    expect(tickers).toContain("BBDC4");
    expect(new Set(tickers).size).toBe(tickers.length);
    for (const e of EMPRESAS_CATALOGO) {
      expect(e.cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
    }
  });

  it("encontra as 3 empresas presentes no fixture", () => {
    const tickers = new Set(balancos.map((b) => b.ticker));
    expect([...tickers].sort()).toEqual(["BBAS3", "ITUB4", "PETR4"]);
  });

  it("PETR4 receita FY2025 real: R$ 497,549 bi (497.549.000 mil)", () => {
    const petr = balancos.find((b) => b.ticker === "PETR4" && b.ano === 2025)!;
    expect(petr.receita).toBeCloseTo(497_549_000_000);
    expect(petr.nome).toContain("PETROBRAS");
  });

  it("PETR4 lucro consolidado FY2025 real: R$ 110,605 bi (conta 3.11)", () => {
    const petr = balancos.find((b) => b.ticker === "PETR4" && b.ano === 2025)!;
    expect(petr.lucroLiquido).toBeCloseTo(110_605_000_000);
  });

  it("ITUB4 receitas de intermediação FY2025 real: R$ 387,118 bi e lucro via conta 3.09 (layout de banco)", () => {
    const itub = balancos.find((b) => b.ticker === "ITUB4" && b.ano === 2025)!;
    expect(itub.receita).toBeCloseTo(387_118_000_000);
    expect(itub.lucroLiquido).toBeCloseTo(45_849_000_000);
  });

  it("BBAS3 receitas FY2024 real: R$ 273,505 bi", () => {
    const bbas = balancos.find((b) => b.ticker === "BBAS3" && b.ano === 2024)!;
    expect(bbas.receita).toBeCloseTo(273_505_274_000);
  });

  it("prefere ÚLTIMO sobre PENÚLTIMO para o mesmo exercício", () => {
    const petr2024 = balancos.find((b) => b.ticker === "PETR4" && b.ano === 2024)!;
    expect(petr2024.receita).toBeCloseTo(490_829_000_000);
  });

  it("empresas ordenadas por ano decrescente", () => {
    const anos = balancos.map((b) => b.ano);
    for (let i = 1; i < anos.length; i++) expect(anos[i - 1]).toBeGreaterThanOrEqual(anos[i]);
  });
});
