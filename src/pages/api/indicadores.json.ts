// Endpoint público JSON (legado do F1, agora servido pelo REGISTRO ÚNICO) —
// útil para outros apps e para o próprio site buscar dados no cliente.
// Formato compatível com o antigo pipeline (valor formatado como string),
// enriquecido com os metadados do registro. Documentado em docs/api.md.
import { descritores } from "../../lib/registro";
import type { Env } from "../../lib/model";
import { env } from "cloudflare:workers";

export async function GET() {
  const desc = descritores();
  const res = await Promise.allSettled(desc.map((d) => d.coletar(env as unknown as Env)));
  const indicadores: unknown[] = [];
  const erros: string[] = [];
  for (let i = 0; i < desc.length; i++) {
    const r = res[i];
    if (r.status === "rejected") {
      erros.push(`${desc[i].nome}: ${String(r.reason)}`);
      continue;
    }
    const ind = r.value;
    if (ind.indisponivelMotivo) {
      erros.push(`${ind.nome}: ${ind.indisponivelMotivo}`);
    }
    indicadores.push({
      chave: ind.id,
      nome: ind.nome,
      unidade: ind.unidade,
      valor: ind.valorFormatado,
      valor_numerico: Number.isNaN(ind.valor) ? null : ind.valor,
      periodo: ind.periodoFormatado,
      periodo_canonico: ind.periodo,
      variacao_pct: ind.variacaoPct,
      serie: ind.serie,
      fonte: ind.fonte,
      fonte_url: ind.fonteUrl,
      licenca: desc[i].licenca,
      coletado_em: ind.coletadoEm,
      indisponivel: ind.indisponivelMotivo ?? null,
    });
  }
  return new Response(
    JSON.stringify({ atualizado_em: new Date().toISOString(), indicadores, erros }, null, 2),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    },
  );
}
