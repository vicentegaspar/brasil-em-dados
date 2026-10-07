// Teste de integridade do registro único — o "balance check" do projeto:
// nenhum descritor entra com metadado faltando e nenhum id usado por páginas
// ou API pode sumir sem quebrar este teste.

import { describe, expect, it } from "vitest";
import { descritores } from "../src/lib/registro";

describe("registro único de indicadores", () => {
  it("ids únicos", () => {
    const ids = descritores().map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo descritor tem metadados completos (nome, unidade, fonte, licença, casas, janela, grupo)", () => {
    for (const d of descritores()) {
      expect(d.id, "id vazio").not.toBe("");
      expect(d.nome.length, d.id).toBeGreaterThan(0);
      expect(d.unidade.length, d.id).toBeGreaterThan(0);
      expect(d.fonte.length, d.id).toBeGreaterThan(0);
      expect(d.fonteUrl.startsWith("https://"), `${d.id}: fonteUrl`).toBe(true);
      expect(["verde", "amarelo", "vermelho"], `${d.id}: licença`).toContain(d.licenca);
      expect(d.casas, `${d.id}: casas`).toBeGreaterThanOrEqual(0);
      expect(d.janelaSerie, `${d.id}: janelaSerie`).toBeGreaterThan(0);
      expect(d.grupo.length, d.id).toBeGreaterThan(0);
      expect(typeof d.coletar, d.id).toBe("function");
    }
  });

  it("ids usados por /graficos, home e API v1 existem no registro", () => {
    const ids = new Set(descritores().map((d) => d.id));
    for (const id of [
      "bcb-selic",
      "bcb-cambio",
      "bcb-ipca-mensal",
      "sidra-desocupacao",
      "sidra-informalidade",
      "sidra-pib",
      "sidra-populacao",
      "sidra-ipca-12m",
      "ons-carga",
      "derivado-pib-per-capita",
      "derivado-juros-reais",
    ]) {
      expect(ids.has(id), `id ausente no registro: ${id}`).toBe(true);
    }
  });
});
