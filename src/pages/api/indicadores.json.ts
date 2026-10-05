// Endpoint público JSON com os mesmos indicadores da home — útil para outros
// apps e para o próprio site buscar dados no cliente. Cacheado igual à home.
import { getIndicadores, type Env } from "../../lib/ibge";
import { env } from "cloudflare:workers";

export async function GET() {
  const { indicadores, erros } = await getIndicadores(env as unknown as Env);
  return new Response(JSON.stringify({ atualizado_em: new Date().toISOString(), indicadores, erros }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
