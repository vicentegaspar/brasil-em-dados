import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCambio,
  getCargaEnergia,
  getDesocupacaoBrasil,
  getInformalidadeBrasil,
  getIpcaMensal,
  getSelicMeta,
  getIndicadoresUf,
} from "../src/lib/collectors";
import { buscarJson } from "../src/lib/cache";
import { fixture, fetchStub, kvMock, kvQuebrado } from "./helpers";
import type { Env } from "../src/lib/model";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ROTAS = [
  { url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178", corpo: fixture("bcb_sgs_1178_range.json") },
  { url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1", corpo: fixture("bcb_sgs_1_range.json") },
  { url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433", corpo: fixture("bcb_sgs_433_range.json") },
  { url: "https://apisidra.ibge.gov.br/values/t/6381", corpo: fixture("ibge_1737_2265_N1.json") },
  { url: "https://apisidra.ibge.gov.br/values/t/4708/v/12466/p/last%205/n1/1", corpo: fixture("sidra_4708_12466_n1.json") },
  { url: "https://apisidra.ibge.gov.br/values/t/5938/v/37/p/last%205/n1/1", corpo: fixture("ibge_1737_2265_N1.json") },
];

describe("coletores com fetch e KV mockados (fixtures reais)", () => {
  it("Selic meta: última observação real = 13,65 % a.a.", async () => {
    vi.stubGlobal("fetch", fetchStub(ROTAS));
    const ind = await getSelicMeta({ CACHE: kvMock() } as unknown as Env);
    expect(ind.indisponivelMotivo).toBeUndefined();
    expect(ind.valor).toBeCloseTo(13.65);
    expect(ind.unidade).toBe("% a.a.");
    expect(ind.coletadoEm).not.toBe("");
    expect(ind.fonteUrl).toContain("bcb.gov.br");
  });

  it("câmbio PTAX: valor real acima de R$ 1", async () => {
    vi.stubGlobal("fetch", fetchStub(ROTAS));
    const ind = await getCambio({ CACHE: kvMock() } as unknown as Env);
    expect(ind.valor).toBeGreaterThan(1);
  });

  it("IPCA mensal: valores entre -5 e 15", async () => {
    vi.stubGlobal("fetch", fetchStub(ROTAS));
    const ind = await getIpcaMensal({ CACHE: kvMock() } as unknown as Env);
    expect(ind.valor).toBeGreaterThan(-5);
    expect(ind.valor).toBeLessThan(15);
  });

  it("coletor com fetch falhando vira indisponível com motivo (não derruba)", async () => {
    const falha = (async () => {
      throw new TypeError("network down");
    }) as unknown as typeof globalThis.fetch;
    vi.stubGlobal("fetch", falha);
    const ind = await getSelicMeta({ CACHE: kvQuebrado() } as unknown as Env);
    expect(ind.indisponivelMotivo).toContain("indisponível");
    expect(ind.serie).toEqual([]);
  });

  it("informalidade Brasil com fetch mockado usa a fixture real", async () => {
    vi.stubGlobal("fetch", fetchStub(ROTAS));
    const ind = await getInformalidadeBrasil({ CACHE: kvMock() } as unknown as Env);
    // série real (last 5: 2021–2025; 2021 = 39,6 é a primeira observação)
    expect(ind.serie[0]).toEqual({ periodo: "2021", valor: 39.6 });
    expect(ind.periodo).toBe("2025");
    expect(ind.periodicidade).toBe("anual");
  });

  it("UF drill-down (PE, código 26) — desocupação real 2022", async () => {
    const rotasUf = [
      { url: "https://apisidra.ibge.gov.br/values/t/5938/v/37", corpo: fixture("sidra_5938_37_uf.json") },
      { url: "https://apisidra.ibge.gov.br/values/t/5938/v/496", corpo: fixture("sidra_5938_496_uf.json") },
      { url: "https://apisidra.ibge.gov.br/values/t/4562", corpo: fixture("sidra_4562_4099_uf.json") },
      { url: "https://apisidra.ibge.gov.br/values/t/4708/v/12466/p/last%205/n3/26", corpo: fixture("sidra_4708_12466_uf.json") },
    ];
    vi.stubGlobal("fetch", fetchStub(rotasUf));
    const uf = await getIndicadoresUf({ CACHE: kvMock() } as unknown as Env, "PE");
    expect(uf).not.toBeNull();
    expect(uf!.uf.nome).toBe("Pernambuco");
    expect(uf!.desocupacao.indisponivelMotivo).toBeUndefined();
    expect(uf!.desocupacao.valor).toBeCloseTo(8.7); // PE 2025 real (SIDRA 4562)
  });

  it("UF desconhecida retorna null", async () => {
    expect(await getIndicadoresUf({} as unknown as Env, "XX")).toBeNull();
  });

  it("KV mock cacheia: segunda chamada não consulta a rede", async () => {
    vi.stubGlobal("fetch", fetchStub(ROTAS));
    const env = { CACHE: kvMock() } as unknown as Env;
    await getInformalidadeBrasil(env);
    const chamadas1 = vi.mocked(fetch).mock.calls.length;
    await getInformalidadeBrasil(env);
    expect(vi.mocked(fetch).mock.calls.length).toBe(chamadas1);
  });

  it("buscarJson lança com status != 200", async () => {
    const stub = (async () =>
      new Response('{"erro":true}', { status: 500 })) as unknown as typeof globalThis.fetch;
    vi.stubGlobal("fetch", stub);
    await expect(buscarJson("https://exemplo.test")).rejects.toThrow("HTTP 500");
  });
});

describe("coletor ONS carga", () => {
  it("total mensal com fixture real", async () => {
    vi.stubGlobal(
      "fetch",
      fetchStub([{ url: "https://ons-aws-prod-opendata.s3.amazonaws.com", corpo: fixture("ons_carga_mensal_sample.csv") }]),
    );
    const carga = await getCargaEnergia({ CACHE: kvMock() } as unknown as Env);
    expect(carga.total.indisponivelMotivo).toBeUndefined();
    expect(carga.total.valor).toBeGreaterThan(30000);
    expect(carga.total.serie.length).toBeLessThanOrEqual(12);
    expect(carga.porSubsistema.length).toBe(4);
  });
});

describe("coletor desocupação Brasil (SIDRA 6381)", () => {
  it("usa fixture apisidra 6381/4099 real: set/2026 = 5,3%", async () => {
    vi.stubGlobal(
      "fetch",
      fetchStub([{ url: "https://apisidra.ibge.gov.br/values/t/6381", corpo: fixture("sidra_6381_4099_n1.json") }]),
    );
    const ind = await getDesocupacaoBrasil({ CACHE: kvMock() } as unknown as Env);
    expect(ind.indisponivelMotivo).toBeUndefined();
    expect(ind.valor).toBeCloseTo(5.3);
    expect(ind.periodo).toBe("2026-08");
    expect(ind.periodoFormatado).toBe("ago/2026");
  });
});
