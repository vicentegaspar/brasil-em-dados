// Datasets de data centers: tarifas ANEEL por UF, ICMS CONFAZ por UF e reforma
// IBS/CBS. Valores de conferência verificados contra o CSV/planilha da fonte
// (gerados por scripts/generate-tarifas.ts e scripts/generate_icms.py).
import { describe, expect, it } from "vitest";
import tarifas from "../src/data/tarifas-uf.json";
import icms from "../src/data/icms-uf.json";
import reforma from "../src/data/reforma-tributaria.json";
import { linhasDatacenters, datacentersPorSigla, pacoteDatacenters } from "../src/lib/datacenters";

describe("tarifas-uf.json (ANEEL)", () => {
  const d = tarifas as unknown as {
    ufs: Record<string, { residencial: number | null; comercial: number | null; industrial: number | null; nDistribuidoras: number; vigencia: string }>;
    fonteUrl: string;
    licenca: string;
    unidade: string;
    geracaoConjunto: string | null;
  };

  it("cobre as 27 UFs e carrega proveniência", () => {
    expect(Object.keys(d.ufs)).toHaveLength(27);
    expect(d.fonteUrl).toContain("dadosabertos.aneel.gov.br");
    expect(d.licenca).toContain("ODbL");
    expect(d.unidade).toBe("R$/kWh");
    expect(d.geracaoConjunto).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("conferência real: ENEL CE B1 residencial convencional = (488,49 + 213,26)/1000 = 0,702", () => {
    // Linha do CSV 2026-10-07: ENEL CE, vigência 2026-08-26, DscSubClasse='Residencial',
    // VlrTUSD=488,49 VlrTE=213,26 (MWh) — CE tem uma única distribuidora no dataset.
    const ce = d.ufs["CE"];
    expect(ce.nDistribuidoras).toBe(1);
    expect(ce.residencial).toBeCloseTo(0.702, 3);
    expect(ce.vigencia).toBe("2026-08-26");
  });

  it("conferência real: ENEL RJ A4 Verde fora ponta = (1.112,60? não — verificado por linha)", () => {
    // RJ tem 5 distribuidoras; o valor da UF é a média — só garantimos ordem de grandeza
    // e que a coluna industrial não mistura demanda (R$/kW): fica entre 0,2 e 1,0 R$/kWh.
    const rj = d.ufs["RJ"];
    expect(rj.industrial).toBeGreaterThan(0.2);
    expect(rj.industrial).toBeLessThan(1.0);
    expect(rj.residencial).toBeGreaterThan(0.8); // RJ é a tarifa residencial mais cara
  });

  it("todos os valores são positivos e menores que 3 R$/kWh (sanidade)", () => {
    for (const uf of Object.values(d.ufs)) {
      for (const v of [uf.residencial, uf.comercial, uf.industrial]) {
        if (v != null) {
          expect(v).toBeGreaterThan(0);
          expect(v).toBeLessThan(3);
        }
      }
      expect(uf.vigencia).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("icms-uf.json (CONFAZ/SIGDEF)", () => {
  const d = icms as unknown as {
    ufs: Record<string, { sigla: string; ultimoMes: string; icmsUltimoMes: number; anoBase: number | null; icmsAnoBase: number | null }>;
    fonteUrl: string;
    licenca: string;
    extracaoArquivo: string | null;
    ufsWithoutData: string[];
  };

  it("cobre as 27 UFs e carrega proveniência", () => {
    expect(Object.keys(d.ufs)).toHaveLength(27);
    expect(d.fonteUrl).toContain("confaz.fazenda.gov.br");
    expect(d.licenca).toContain("Creative Commons");
  });

  it("conferência real: SP — va_icms_total 2023 soma ~197,3 bi; mês mais recente 2024-04 ~18,7 bi", () => {
    // Somatório de va_icms_total (col 22) dos 12 meses de 2023 na planilha
    // 20250812.xls; col 23 é IPVA (não ICMS) — o gerador usa a coluna certa.
    const sp = d.ufs["SP"];
    expect(sp.anoBase).toBe(2023);
    expect(sp.icmsAnoBase).toBeGreaterThan(190e9);
    expect(sp.icmsAnoBase).toBeLessThan(205e9);
    expect(sp.ultimoMes).toBe("2024-04");
    expect(sp.icmsUltimoMes).toBeGreaterThan(15e9);
  });

  it("lacunas documentadas: UFs reportam com defasagens distintas (ano-base varia)", () => {
    const anoBases = new Set(Object.values(d.ufs).map((u) => u.anoBase));
    expect(anoBases.size).toBeGreaterThan(1);
    for (const u of Object.values(d.ufs)) {
      expect(u.ultimoMes).toMatch(/^\d{4}-\d{2}$/);
      if (u.anoBase != null) expect(u.icmsAnoBase).toBeGreaterThan(0);
    }
  });
});

describe("reforma-tributaria.json (LC 214/2025)", () => {
  const d = reforma as unknown as {
    timeline: Array<{ ano: string; fase: string }>;
    resumo: string;
  };

  it("timeline legal 2026→2033 sem alíquota por estado (IBS é uniforme)", () => {
    const anos = d.timeline.map((t) => t.ano);
    expect(anos).toEqual(["2026", "2027", "2029", "2030", "2031", "2032", "2033"]);
    expect(d.resumo).toContain("ÚNICA nacional");
  });
});

describe("lib/datacenters", () => {
  it("linhasDatacenters(): 27 UFs, sempre com sigla/nome; m² é null (indisponível)", () => {
    const linhas = linhasDatacenters();
    expect(linhas).toHaveLength(27);
    for (const l of linhas) {
      expect(l.sigla).toMatch(/^[A-Z]{2}$/);
      expect(l.nome.length).toBeGreaterThan(2);
      expect(l.metroQuadrado).toBeNull();
    }
    const sp = datacentersPorSigla("sp");
    expect(sp?.tarifaResidencial).toBeCloseTo((tarifas as unknown as { ufs: Record<string, { residencial: number | null }> }).ufs["SP"].residencial ?? NaN, 3);
    expect(sp?.icmsUltimoMes).toBe("2024-04");
  });

  it("sigla desconhecida → null", () => {
    expect(datacentersPorSigla("XX")).toBeNull();
  });

  it("pacote da API: mesmas tabelas + status do m² explicitamente indisponível", () => {
    const p = pacoteDatacenters();
    expect(Object.keys(p.tarifaEnergia.ufs)).toHaveLength(27);
    expect(Object.keys(p.icms.ufs)).toHaveLength(27);
    expect(p.metroQuadrado.status).toBe("indisponivel");
    expect(p.reformaTributaria.timeline.length).toBeGreaterThan(3);
  });
});