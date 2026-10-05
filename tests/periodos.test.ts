import { describe, expect, it } from "vitest";
import { formatarBilhoes, formatarNumero, formatarPeriodoDiaria, formatarPeriodoMensal, normalizarPeriodo, formatarVariacaoPct } from "../src/lib/periodos";

describe("formatadores de período", () => {
  it("mensal SIDRA '202508' -> 'ago/2025'", () => {
    expect(formatarPeriodoMensal("202508")).toBe("ago/2025");
  });
  it("mensal canônico '2025-08' -> 'ago/2025'", () => {
    expect(formatarPeriodoMensal("2025-08")).toBe("ago/2025");
  });
  it("diária BCB '05/10/2026' -> '05/out/2026'", () => {
    expect(formatarPeriodoDiaria("05/10/2026")).toBe("05/out/2026");
  });
  it("diária ISO '2026-10-05' -> '05/out/2026'", () => {
    expect(formatarPeriodoDiaria("2026-10-05")).toBe("05/out/2026");
  });
  it("anual passa como está", () => {
    expect(formatarPeriodoMensal("2025")).toBe("2025");
  });
  it("normaliza períodos por periodicidade", () => {
    expect(normalizarPeriodo("mensal", "202508")).toBe("2025-08");
    expect(normalizarPeriodo("mensal", "2026-10-31")).toBe("2026-10");
    expect(normalizarPeriodo("diaria", "05/10/2026")).toBe("2026-10-05");
    expect(normalizarPeriodo("anual", "2025")).toBe("2025");
  });
});

describe("formatadores de número (pt-BR)", () => {
  it("separadores de milhar e vírgula decimal", () => {
    expect(formatarNumero(1234567.891)).toBe("1.234.567,89");
    expect(formatarNumero(13.75)).toBe("13,75");
    expect(formatarNumero(-0.5)).toBe("-0,50");
    expect(formatarNumero(NaN)).toBe("");
  });
  it("bilhões", () => {
    expect(formatarBilhoes(497549000000)).toBe("497,5");
  });
  it("variação percentual com sinal", () => {
    expect(formatarVariacaoPct(1.234)).toBe("+1,23%");
    expect(formatarVariacaoPct(-1.234)).toBe("-1,23%");
  });
});
