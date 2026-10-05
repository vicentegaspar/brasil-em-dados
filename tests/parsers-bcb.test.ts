import { describe, expect, it } from "vitest";
import { parseBcbSgs } from "../src/lib/parsers";
import { fixture } from "./helpers";

describe("parser BCB SGS (respostas reais de api.bcb.gov.br)", () => {
  it("Selic meta diária (SGS 1178) — valores reais", () => {
    const obs = parseBcbSgs(fixture("bcb_sgs_1178_range.json"));
    expect(obs.length).toBeGreaterThan(0);
    // dados reais capturados em 05/10/2026: Selic meta 13,65% a.a.
    expect(obs[obs.length - 1].valor).toBeCloseTo(13.65);
    expect(obs[obs.length - 1].periodo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(obs).toEqual([...obs].sort((a, b) => a.periodo.localeCompare(b.periodo)));
  });

  it("câmbio PTAX (SGS 1) — 4 casas decimais", () => {
    const obs = parseBcbSgs(fixture("bcb_sgs_1_range.json"));
    expect(obs.length).toBeGreaterThan(0);
    for (const o of obs) expect(o.valor).toBeGreaterThan(1);
  });

  it("IPCA mensal (SGS 433) pode ter valores negativos", () => {
    const obs = parseBcbSgs(fixture("bcb_sgs_433_range.json"));
    expect(obs.length).toBeGreaterThan(0);
  });

  it("ignora valores não numéricos e mantém ordem", () => {
    const obs = parseBcbSgs('[{"data":"01/10/2026","valor":"-"},{"data":"02/10/2026","valor":"13.75"},{"data":"01/10/2026","valor":"13.60"}]');
    expect(obs).toEqual([
      { periodo: "2026-10-01", valor: 13.6 },
      { periodo: "2026-10-02", valor: 13.75 },
    ]);
  });
});
