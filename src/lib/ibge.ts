// Acesso à API v3 do IBGE (SIDRA) com cache em KV.
// O IBGE nunca é chamado a cada visita: resultado vai para o KV com TTL.
// Sem KV (ex.: fora do Workers), busca direta e degrada com elegância.

// Interface mínima do KV do Workers (evita depender de @cloudflare/workers-types).
type KVLike = {
  get(k: string): Promise<string | null>;
  put(k: string, v: string, opts: { expirationTtl: number }): Promise<void>;
};

export type Env = { CACHE?: KVLike } & Record<string, unknown>;

export type Serie = Record<string, string>;

export type Indicador = {
  chave: string;
  nome: string;
  unidade: string;
  valor: string;
  periodo: string;
  variacao?: number | null;
  serie: { periodo: string; valor: number }[];
  fonte: string;
};

const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v3/agregados";
const UA = "brasil-em-dados/0.1 (+https://github.com/vicentegaspar/brasil-em-dados)";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`IBGE ${res.status} em ${url}`);
  return res.json();
}

// Cache-aside: HIT -> KV; MISS -> IBGE + put com TTL.
async function cachedJson(env: Env, key: string, url: string, ttlSeconds: number): Promise<unknown> {
  const kv = env.CACHE;
  if (kv) {
    try {
      const hit = await kv.get(key);
      if (hit) return JSON.parse(hit);
    } catch {
      // cache falho não pode derrubar a página
    }
  }
  const data = await fetchJson(url);
  if (kv && data != null) {
    try {
      await kv.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds });
    } catch {
      // escrever no cache é best-effort
    }
  }
  return data;
}

type SidraResposta = {
  resultados: {
    classificacoes: unknown[];
    series: { localidade: { nome: string }; serie: Serie }[];
  }[];
};

function serieLocalidadeBrasil(data: unknown): Serie {
  const arr = data as SidraResposta[];
  const serie =
    arr?.[0]?.resultados?.[0]?.series?.find((s) => s.localidade.nome === "Brasil")?.serie ??
    arr?.[0]?.resultados?.[0]?.series?.[0]?.serie;
  if (!serie) throw new Error("Série Brasil não encontrada na resposta do IBGE");
  return serie;
}

function serieParaPontos(s: Serie): { periodo: string; valor: number }[] {
  return Object.entries(s)
    .map(([periodo, valor]) => ({ periodo, valor: Number(valor) }))
    .filter((p) => Number.isFinite(p.valor))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
}

function formatarPeriodoMensal(p: string): string {
  const ano = p.slice(0, 4);
  const mes = Number(p.slice(4, 6));
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[mes - 1] ?? mes}/${ano}`;
}

// População residente estimada — agregado 6579, variável 9324, Brasil (N1).
export async function getPopulacao(env: Env): Promise<Indicador> {
  const data = await cachedJson(
    env,
    "pop:v1",
    `${IBGE_BASE}/6579/periodos/2000-2099/variaveis/9324?localidades=N1[all]`,
    6 * 3600,
  );
  const serie = serieParaPontos(serieLocalidadeBrasil(data));
  const ultima = serie[serie.length - 1];
  const penultima = serie[serie.length - 2];
  const variacao = penultima ? ((ultima.valor - penultima.valor) / penultima.valor) * 100 : null;
  return {
    chave: "populacao",
    nome: "População residente estimada",
    unidade: "habitantes",
    valor: ultima.valor.toLocaleString("pt-BR"),
    periodo: ultima.periodo,
    variacao,
    serie,
    fonte: "IBGE — Estimativas de população (SIDRA 6579)",
  };
}

// IPCA — variação acumulada em 12 meses, índice geral — agregado 1737, variável 2265.
export async function getIpca12m(env: Env): Promise<Indicador> {
  const data = await cachedJson(
    env,
    "ipca12m:v1",
    `${IBGE_BASE}/1737/periodos/-24/variaveis/2265?localidades=N1[all]`,
    12 * 3600,
  );
  const serie = serieParaPontos(serieLocalidadeBrasil(data));
  const ultima = serie[serie.length - 1];
  const penultima = serie[serie.length - 2];
  return {
    chave: "ipca12m",
    nome: "IPCA — acumulado em 12 meses",
    unidade: "%",
    valor: ultima.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
    periodo: formatarPeriodoMensal(ultima.periodo),
    variacao: penultima ? ultima.valor - penultima.valor : null,
    serie,
    fonte: "IBGE — IPCA (SIDRA 1737)",
  };
}

export async function getIndicadores(env: Env): Promise<{ indicadores: Indicador[]; erros: string[] }> {
  const resultados = await Promise.allSettled([getPopulacao(env), getIpca12m(env)]);
  const indicadores: Indicador[] = [];
  const erros: string[] = [];
  for (const r of resultados) {
    if (r.status === "fulfilled") indicadores.push(r.value);
    else erros.push(String(r.reason));
  }
  return { indicadores, erros };
}
