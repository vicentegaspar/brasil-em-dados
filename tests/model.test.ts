import { describe, expect, it } from "vitest";
import { indicadorPendente, type Observacao } from "../src/lib/model";

describe("modelo canônico", () => {
  it("indicador pendente carrega motivo, sem dados e sem valor", () => {
    const p = indicadorPendente("x", "X", "Fonte fora do ar.", "F", "https://f");
    expect(p.indisponivelMotivo).toBe("Fonte fora do ar.");
    expect(p.serie).toEqual([]);
    expect(Number.isNaN(p.valor)).toBe(true);
    expect(p.coletadoEm).toBe("");
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
