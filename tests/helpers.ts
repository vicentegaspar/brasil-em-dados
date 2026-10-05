// Mocks de KV e de fetch para os testes de coletores.

import { vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { KVLike } from "../src/lib/cache";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

export function fixture(nome: string): string {
  return readFileSync(join(FIXTURES, nome), "utf-8");
}

/** KV fake em memória com o mesmo contrato do binding CACHE. */
export function kvMock(): KVLike {
  const store = new Map<string, string>();
  return {
    async get(k) {
      return store.get(k) ?? null;
    },
    async put(k, v) {
      store.set(k, v);
    },
  };
}

/** KV que sempre falha (rede/IO) — coletores devem degradar, não derrubar. */
export function kvQuebrado(): KVLike {
  return {
    async get() {
      throw new Error("KV fora do ar");
    },
    async put() {
      throw new Error("KV fora do ar");
    },
  };
}

type Rota = { url: string; corpo: string };

/** Stub de global.fetch com respostas fixas por URL (fixture). */
export function fetchStub(rotas: Rota[]): typeof globalThis.fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const rota = rotas.find((r) => url.startsWith(r.url));
    if (!rota) throw new Error(`fetch não mockado: ${url}`);
    return new Response(rota.corpo, { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof globalThis.fetch;
}
