import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarJson, cachedJson, cachedTexto, cachedValor } from "../src/lib/cache";
import { fetchStub, kvMock, kvQuebrado } from "./helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cache-aside em KV", () => {
  it("primeira chamada busca na rede e grava no KV; segunda vem do cache", async () => {
    vi.stubGlobal("fetch", fetchStub([{ url: "https://exemplo.test/api", corpo: '{"ok":true}' }]));
    const kv = kvMock();
    const dado1 = await cachedJson({ CACHE: kv }, "k:v1", "https://exemplo.test/api", 60);
    expect(dado1).toEqual({ ok: true });
    const dado2 = await cachedJson({ CACHE: kv }, "k:v1", "https://exemplo.test/api", 60);
    expect(dado2).toEqual({ ok: true });
    expect(vi.mocked(fetch).mock.calls.length).toBe(1);
  });

  it("KV quebrado não derruba o coletor (degrada para rede)", async () => {
    vi.stubGlobal("fetch", fetchStub([{ url: "https://exemplo.test/api", corpo: '{"ok":2}' }]));
    const dado = await cachedJson({ CACHE: kvQuebrado() }, "k:v1", "https://exemplo.test/api", 60);
    expect(dado).toEqual({ ok: 2 });
  });

  it("sem KV (fora do Workers), busca direta na fonte", async () => {
    vi.stubGlobal("fetch", fetchStub([{ url: "https://exemplo.test/api", corpo: '{"ok":3}' }]));
    const dado = await cachedJson({}, "k:v1", "https://exemplo.test/api", 60);
    expect(dado).toEqual({ ok: 3 });
  });

  it("HTTP != 200 lança erro com status", async () => {
    const stub = (async () => new Response("nope", { status: 429 })) as unknown as typeof globalThis.fetch;
    vi.stubGlobal("fetch", stub);
    await expect(buscarJson("https://exemplo.test/api")).rejects.toThrow("429");
  });

  it("cachedTexto cacheia CSV; cachedValor cacheia resultado computado", async () => {
    vi.stubGlobal("fetch", fetchStub([{ url: "https://exemplo.test/csv", corpo: "a;b\n1;2" }]));
    const kv = kvMock();
    const t1 = await cachedTexto({ CACHE: kv }, "csv:v1", "https://exemplo.test/csv", 60);
    expect(t1).toBe("a;b\n1;2");
    const v1 = await cachedValor({ CACHE: kv }, "calc:v1", 60, async () => ({ total: 42 }));
    expect(v1).toEqual({ total: 42 });
    let chamadas = 0;
    const v2 = await cachedValor({ CACHE: kv }, "calc:v1", 60, async () => {
      chamadas++;
      return { total: 0 };
    });
    expect(v2).toEqual({ total: 42 });
    expect(chamadas).toBe(0);
  });
});
