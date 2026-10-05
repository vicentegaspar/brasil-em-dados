// API v1 versionada: lista de indicadores disponíveis + séries completas.
// ?formato=csv exporta as observações como CSV.
// Documentação: docs/api.md

import type { Env } from "../../../lib/cache";
import {
  getCambio,
  getCargaEnergia,
  getDesocupacaoBrasil,
  getInformalidadeBrasil,
  getIpcaMensal,
  getPibBrasil,
  getSelicMeta,
} from "../../../lib/collectors";
import type { IndicadorExibicao } from "../../../lib/model";
import { env } from "cloudflare:workers";

export const prerender = false;

type PayloadIndicador = {
  id: string;
  nome: string;
  unidade: string;
  periodicidade: string;
  fonte: string;
  fonte_url: string;
  licenca: string;
  coletado_em: string;
  localidade: { nivel: string; codigo: string; nome: string };
  observacoes: { periodo: string; valor: number }[];
};

const BRASIL_LOCALIDADE = { nivel: "N1", codigo: "1", nome: "Brasil" };

function paraPayload(ind: IndicadorExibicao): PayloadIndicador {
  return {
    id: ind.id,
    nome: ind.nome,
    unidade: ind.unidade,
    periodicidade: ind.periodicidade,
    fonte: ind.fonte,
    fonte_url: ind.fonteUrl,
    licenca: "verde",
    coletado_em: ind.coletadoEm,
    localidade: BRASIL_LOCALIDADE,
    observacoes: ind.serie.map((o) => ({ periodo: o.periodo, valor: o.valor })),
  };
}

async function coletarTodos(e: Env): Promise<PayloadIndicador[]> {
  const [selic, cambio, ipca, desoc, informal, pib, carga] = await Promise.all([
    getSelicMeta(e),
    getCambio(e),
    getIpcaMensal(e),
    getDesocupacaoBrasil(e),
    getInformalidadeBrasil(e),
    getPibBrasil(e),
    getCargaEnergia(e),
  ]);
  return [selic, cambio, ipca, desoc, informal, pib, carga.total].map(paraPayload);
}

function paraCsv(indicadores: PayloadIndicador[]): string {
  const linhas = ["indicador,localidade,periodo,valor"];
  for (const ind of indicadores) {
    for (const o of ind.observacoes) {
      const nome = ind.nome.includes(",") ? `"${ind.nome}"` : ind.nome;
      linhas.push(`${nome},${ind.localidade.nome},${o.periodo},${o.valor}`);
    }
  }
  return linhas.join("\n");
}

export async function GET({ url }: { url: URL }) {
  const res = await coletarTodos(env as unknown as Env);
  const formato = url.searchParams.get("formato");
  if (formato === "csv") {
    return new Response(paraCsv(res), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="indicadores.csv"',
      },
    });
  }
  return new Response(
    JSON.stringify(
      {
        versao: "v1",
        atualizado_em: new Date().toISOString(),
        licenca_dados: "dados de fontes públicas (IBGE, BCB, ONS) — ver docs/fontes.md",
        indicadores: res,
      },
      null,
      2,
    ),
    { headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
}
