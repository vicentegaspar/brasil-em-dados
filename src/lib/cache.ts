// Cache-aside em KV do Cloudflare Workers (cache de leitura da API do site).
// Sem KV disponível (fora do Workers / testes), busca direta na fonte.
//
// DECISÃO DE ARMAZENAMENTO (fase F2): as séries normalizadas vivem em KV
// (cache-aside com TTL por indicador) e não em D1. Motivos: a coleta é por
// request (cron é fase futura), o volume é pequeno e o KV já está na stack
// do F1. Migrar para D1/R2 está documentado como evolução em docs/fontes.md.

export type KVLike = {
  get(k: string): Promise<string | null>;
  put(k: string, v: string, opts: { expirationTtl: number }): Promise<void>;
};

export type Env = { CACHE?: KVLike } & Record<string, unknown>;

export const UA = "brasil-em-dados/0.1 (+https://github.com/vicentegaspar/brasil-em-dados)";

export async function buscarTexto(url: string, timeoutMs = 15000): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.text();
}

export async function buscarJson(url: string, timeoutMs = 15000): Promise<unknown> {
  const txt = await buscarTexto(url, timeoutMs);
  return JSON.parse(txt);
}

/** Cache-aside: HIT -> KV; MISS -> fonte + put com TTL (best-effort). */
export async function cachedJson(
  env: Env,
  key: string,
  url: string,
  ttlSeconds: number,
  timeoutMs = 15000,
): Promise<unknown> {
  const kv = env?.CACHE;
  if (kv) {
    try {
      const hit = await kv.get(key);
      if (hit) return JSON.parse(hit);
    } catch {
      // cache falho não pode derrubar a página
    }
  }
  const data = await buscarJson(url, timeoutMs);
  if (kv && data != null) {
    try {
      await kv.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds });
    } catch {
      // escrever no cache é best-effort
    }
  }
  return data;
}

/** Igual a cachedJson, para payloads de texto (CSV) que podem ser grandes. */
export async function cachedTexto(
  env: Env,
  key: string,
  url: string,
  ttlSeconds: number,
  timeoutMs = 30000,
): Promise<string> {
  const kv = env?.CACHE;
  if (kv) {
    try {
      const hit = await kv.get(key);
      if (hit) return hit;
    } catch {
      // ignore
    }
  }
  const txt = await buscarTexto(url, timeoutMs);
  if (kv) {
    try {
      await kv.put(key, txt, { expirationTtl: ttlSeconds });
    } catch {
      // ignore
    }
  }
  return txt;
}

/** Cache de resultado computado (ex.: balanços parseados do zip da CVM). */
export async function cachedValor<T>(
  env: Env,
  key: string,
  ttlSeconds: number,
  calcular: () => Promise<T>,
): Promise<T> {
  const kv = env?.CACHE;
  if (kv) {
    try {
      const hit = await kv.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch {
      // ignore
    }
  }
  const valor = await calcular();
  if (kv) {
    try {
      await kv.put(key, JSON.stringify(valor), { expirationTtl: ttlSeconds });
    } catch {
      // ignore
    }
  }
  return valor;
}
