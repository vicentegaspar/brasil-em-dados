// API v1 — série de um indicador por localidade, com filtro de período.
// GET /api/v1/serie?id=wb-NY.GDP.PCAP.CD-USA&inicio=2015&fim=2024
// ids suportados:
//   wb-<codIndicador>-<ISO3>   (World Bank, anual)
//   bcb-selic | bcb-cambio | bcb-ipca-mensal (BCB SGS)
//   sidra-desocupacao | sidra-informalidade | sidra-pib | sidra-ipca-12m | sidra-populacao | ons-carga
import type { Env, IndicadorExibicao } from "../../../lib/model";
import type { Observacao } from "../../../lib/model";
import {
  getCambio,
  getCargaEnergia,
  getDesocupacaoBrasil,
  getInformalidadeBrasil,
  getIpcaAcum12m,
  getIpcaMensal,
  getPopulacaoBrasil,
  getPibBrasil,
  getSelicMeta,
} from "../../../lib/collectors";
import { getSeriePaises, PAISES } from "../../../lib/worldbank";
import { env } from "cloudflare:workers";

export const prerender = false;

const E = env as unknown as Env;

const BCB_IDS: Record<string, { sgs: string; nome: string; unidade: string }> = {
  "bcb-selic": { sgs: "1178", nome: "Taxa Selic definida pelo Copom", unidade: "% a.a." },
  "bcb-cambio": { sgs: "1", nome: "Dólar — PTAX (compra)", unidade: "R$/US$" },
  "bcb-ipca-mensal": { sgs: "433", nome: "IPCA — variação mensal", unidade: "%" },
};

const SIDRA_IDS: Record<string, () => Promise<IndicadorExibicao>> = {
  "sidra-desocupacao": () => getDesocupacaoBrasil(E),
  "sidra-informalidade": () => getInformalidadeBrasil(E),
  "sidra-pib": () => getPibBrasil(E),
  "sidra-populacao": () => getPopulacaoBrasil(E),
  "sidra-ipca-12m": () => getIpcaAcum12m(E),
};

export async function GET({ url }: { url: URL }) {
  const id = url.searchParams.get("id") ?? "";
  const inicio = url.searchParams.get("inicio") ?? "";
  const fim = url.searchParams.get("fim") ?? "";

  let ind: IndicadorExibicao | null = null;
  const wb = /^wb-(.+)-([A-Z]{3})$/.exec(id);
  try {
    if (wb) {
      const mapa = await getSeriePaises(E, wb[1]);
      ind = mapa[wb[2]] ?? null;
    } else if (id === "bcb-selic") ind = await getSelicMeta(E);
    else if (id === "bcb-cambio") ind = await getCambio(E);
    else if (id === "bcb-ipca-mensal") ind = await getIpcaMensal(E);
    else if (id === "ons-carga") ind = (await getCargaEnergia(E)).total;
    else if (SIDRA_IDS[id]) ind = await SIDRA_IDS[id]();
  } catch (e) {
    console.error(`api/serie ${id}: ${String(e)}`);
  }

  if (!ind) {
    return new Response(
      JSON.stringify({ erro: `id desconhecido ou fonte indisponível: ${id}`, ids_validos: { wb: "wb-<cod>-<ISO3>", bcb: Object.keys(BCB_IDS), sidra: Object.keys(SIDRA_IDS), ons: "ons-carga", paises: PAISES.map((p) => p.iso3) } }),
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
        licenca: id.startsWith("wb-") ? "CC-BY 4.0" : "verde",
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
