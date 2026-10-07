import { describe, expect, it } from "vitest";
import {
  indicadorPendente,
  montarIndicador,
  type MetaIndicador,
  type Observacao,
} from "../src/lib/model";

const META: MetaIndicador = {
  id: "x-teste",
  nome: "X de teste",
  unidade: "%",
  periodicidade: "anual",
  fonte: "Fonte de teste",
  fonteUrl: "https://fonte.test",
  licenca: "verde",
  casas: 2,
  janelaSerie: 3,
};

describe("modelo canônico", () => {
  it("indicador pendente carrega motivo, sem dados e sem valor", () => {
    const p = indicadorPendente(META, "Fonte fora do ar.");
    expect(p.indisponivelMotivo).toBe("Fonte fora do ar.");
    expect(p.serie).toEqual([]);
    expect(Number.isNaN(p.valor)).toBe(true);
    expect(p.coletadoEm).toBe("");
    expect(p.fonte).toBe(META.fonte);
    expect(p.id).toBe(META.id);
  });

  it("observações têm período canônico e valor numérico", () => {
    const obs: Observacao[] = [
      { periodo: "2026-08", valor: 5.3 },
      { periodo: "2026-09", valor: 5.1 },
    ];
    expect(obs.every((o) => Number.isFinite(o.valor))).toBe(true);
    expect(obs.map((o) => o.periodo)).toEqual(["2026-08", "2026-09"]);
  });
});

describe("montarIndicador (única, usada por todos os coletores)", () => {
  it("série vazia vira pendente com motivo", () => {
    const ind = montarIndicador(META, []);
    expect(ind.indisponivelMotivo).toBeTruthy();
    expect(ind.serie).toEqual([]);
  });

  it("última observação vira valor; variação % relativa entre as duas últimas", () => {
    const ind = montarIndicador(META, [
      { periodo: "2023", valor: 100 },
      { periodo: "2024", valor: 110 },
    ]);
    expect(ind.valor).toBe(110);
    expect(ind.variacaoPct).toBeCloseTo(10);
    expect(ind.periodo).toBe("2024");
  });

  it("variacaoTipo 'pp' dá diferença em pontos percentuais (séries já em %)", () => {
    const ind = montarIndicador(
      { ...META, variacaoTipo: "pp" },
      [
        { periodo: "2023", valor: 4.5 },
        { periodo: "2024", valor: 3.0 },
      ],
    );
    expect(ind.variacaoPct).toBeCloseTo(-1.5);
  });

  it("janelaSerie corta a série", () => {
    const obs = Array.from({ length: 13 }, (_, i) => ({ periodo: String(2010 + i), valor: i }));
    const ind = montarIndicador(META, obs);
    expect(ind.serie.length).toBe(META.janelaSerie);
    expect(ind.serie[ind.serie.length - 1].periodo).toBe("2022");
  });
});
