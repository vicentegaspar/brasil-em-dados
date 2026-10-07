// API v1 — série de um indicador por localidade, com filtro de período.
// GET /api/v1/serie?id=wb-NY.GDP.PCAP.CD-USA&inicio=2015&fim=2024
// ids aceitos: os do REGISTRO ÚNICO (registro.ts) + séries World Bank no
// formato wb-<codIndicador>-<ISO3> (registro próprio em worldbank.ts).
import type { Env, IndicadorExibicao, Observacao } from "../../../lib/model";
import { getSeriePaises, PAISES } from "../../../lib/worldbank";
import { descritores, descritorPorId } from "../../../lib/registro";
import { env } from "cloudflare:workers";

export const prerender = false;

const E = env as unknown as Env;

export async function GET({ url }: { url: URL }) {
  const id = url.searchParams.get("id") ?? "";
  const inicio = url.searchParams.get("inicio") ?? "";
  const fim = url.searchParams.get("fim") ?? "";

  let ind: IndicadorExibicao | null = null;
  const desc = descritorPorId(id);
  const wb = /^wb-(.+)-([A-Z]{3})$/.exec(id);
  try {
    if (desc) {
      ind = await desc.coletar(E);
    } else if (wb) {
      const mapa = await getSeriePaises(E, wb[1]);
      ind = mapa[wb[2]] ?? null;
    }
  } catch (e) {
    console.error(`api/serie ${id}: ${String(e)}`);
  }

  if (!ind) {
    return new Response(
      JSON.stringify(
        {
          erro: `id desconhecido ou fonte indisponível: ${id}`,
          ids_validos: {
            nacionais: descritores().map((d) => d.id),
            wb: "wb-<cod>-<ISO3>",
            paises: PAISES.map((p) => p.iso3),
          },
        },
        null,
        2,
      ),
      { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
  }

  const filtrado: Observacao[] = ind.serie.filter((o) => {
    if (inicio && o.periodo < inicio) return false;
    if (fim && o.periodo > fim) return false;
    return true;
  });

  return new Response(
    JSON.stringify(
      {
        id: ind.id,
        nome: ind.nome,
        unidade: ind.unidade,
        periodicidade: ind.periodicidade,
        fonte: ind.fonte,
        fonte_url: ind.fonteUrl,
        licenca: desc?.licenca ?? (id.startsWith("wb-") ? "CC-BY 4.0" : "verde"),
        coletado_em: ind.coletadoEm,
        indisponivel: ind.indisponivelMotivo ?? null,
        observacoes: filtrado,
      },
      null,
      2,
    ),
    { headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
}
