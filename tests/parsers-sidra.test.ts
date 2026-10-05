import { describe, expect, it } from "vitest";
import { nomesLocalidadesSidra, observacoesSidra, parseSidraValues } from "../src/lib/parsers";
import { fixture } from "./helpers";

describe("parser apisidra (respostas reais de apisidra.ibge.gov.br)", () => {
  it("desocupação UF (4562/4099, n3/all) — Rondônia 2022 = 4,2", () => {
    const linhas = parseSidraValues(fixture("sidra_4562_4099_uf.json"));
    const obs = observacoesSidra(linhas, "4099", "11", "anual");
    const o2022 = obs.find((o) => o.periodo === "2022");
    expect(o2022?.valor).toBeCloseTo(4.2);
  });

  it("informalidade Brasil (4708/12466) — série real (last 5: 2021–2025)", () => {
    const linhas = parseSidraValues(fixture("sidra_4708_12466_n1.json"));
    const obs = observacoesSidra(linhas, "12466", "1", "anual");
    expect(obs.length).toBeGreaterThan(0);
    // dado real capturado: 2021 = 39,6% (primeira de 5 observações)
    expect(obs[0]).toEqual({ periodo: "2021", valor: 39.6 });
  });

  it("informalidade UF — grande disparidade N/NE x S/SE", () => {
    const linhas = parseSidraValues(fixture("sidra_4708_12466_uf.json"));
    const ro = observacoesSidra(linhas, "12466", "11", "anual");
    const ac = observacoesSidra(linhas, "12466", "12", "anual");
    const sc = observacoesSidra(linhas, "12466", "42", "anual");
    expect(ro.length).toBeGreaterThan(0);
    expect(ac[ac.length - 1].valor).toBeGreaterThan(45);
    expect(sc[sc.length - 1].valor).toBeLessThan(40);
  });

  it("PIB UF (5938/37) — valores em Mil Reais, SP >> RR", () => {
    const linhas = parseSidraValues(fixture("sidra_5938_37_uf.json"));
    const sp = observacoesSidra(linhas, "37", "35", "anual");
    const rr = observacoesSidra(linhas, "37", "14", "anual");
    const ultimoSp = sp[sp.length - 1];
    const ultimoRr = rr[rr.length - 1];
    expect(ultimoSp.valor).toBeGreaterThan(2_000_000_000); // Mil Reais
    expect(ultimoSp.valor).toBeGreaterThan(ultimoRr.valor * 100);
  });

  it("participação no PIB (5938/496) soma ~100% entre as UFs", () => {
    const linhas = parseSidraValues(fixture("sidra_5938_496_uf.json"));
    const nomes = nomesLocalidadesSidra(linhas);
    expect(nomes.size).toBe(27);
    const ultimoAno = "2023";
    let soma = 0;
    for (const [codigo] of nomes) {
      const obs = observacoesSidra(linhas, "496", codigo, "anual");
      const o = obs.find((x) => x.periodo === ultimoAno);
      if (o) soma += o.valor;
    }
    expect(soma).toBeCloseTo(100, 0);
  });

  it("PIB municipal (5938/37, n6) — Salvador real", () => {
    const linhas = parseSidraValues(fixture("sidra_5938_37_mun.json"));
    const obs = observacoesSidra(linhas, "37", "2927408", "anual");
    expect(obs.length).toBeGreaterThan(0);
    // valores reais capturados: Salvador 2022 = 68.764.218 e 2023 = 76.698.777 Mil Reais
    expect(obs[0].valor).toBeCloseTo(68764218);
    expect(obs[obs.length - 1].valor).toBeCloseTo(76698777);
  });

  it("ignora linhas de outra variável ou localidade", () => {
    const linhas = [
      { D1C: "37", D2C: "2022", D3C: "11", V: "1" },
      { D1C: "553", D2C: "2022", D3C: "11", V: "9" },
      { D1C: "37", D2C: "2022", D3C: "12", V: "2" },
      { D1C: "37", D2C: "2022", D3C: "11", V: "-" },
    ];
    const obs = observacoesSidra(linhas as never, "37", "11", "anual");
    expect(obs).toEqual([{ periodo: "2022", valor: 1 }]);
  });
});
