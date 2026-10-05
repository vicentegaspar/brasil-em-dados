// Coletor World Bank Open Data API — comparação internacional de mercado.
// Fonte gratuita, sem chave, licença CC-BY 4.0 (atribuição).
// Endpoint: https://api.worldbank.org/v2/country/<ISO2;...>/indicator/<cod>?format=json
// Uma chamada por indicador cobre todos os países; cache KV de 24h (série anual).

import { cachedJson, type Env } from "./cache";
import type { IndicadorExibicao, Observacao } from "./model";
import { indicadorPendente } from "./model";
import {
  parseWorldBank,
  observacoesWorldBank,
  variacaoYoY,
  type LinhaWorldBank,
} from "./parsers-worldbank";
import { formatarNumero } from "./periodos";

export type CodPais = { iso2: string; iso3: string; nome: string };

/** Catálogo de países do painel comparativo. */
export const PAISES: CodPais[] = [
  { iso2: "BR", iso3: "BRA", nome: "Brasil" },
  { iso2: "US", iso3: "USA", nome: "Estados Unidos" },
  { iso2: "JP", iso3: "JPN", nome: "Japão" },
  { iso2: "AR", iso3: "ARG", nome: "Argentina" },
  { iso2: "MX", iso3: "MEX", nome: "México" },
  { iso2: "CL", iso3: "CHL", nome: "Chile" },
  { iso2: "DE", iso3: "DEU", nome: "Alemanha" },
  { iso2: "CN", iso3: "CHN", nome: "China" },
  { iso2: "IN", iso3: "IND", nome: "Índia" },
  { iso2: "KR", iso3: "KOR", nome: "Coreia do Sul" },
  { iso2: "PT", iso3: "PRT", nome: "Portugal" },
];

export type DefIndicadorWb = {
  codigo: string;
  nome: string;
  unidade: string;
  /** true = série em % (variação YoY é em pontos percentuais) */
  percentual: boolean;
  casas: number;
  fonteUrl: string;
};

/** Catálogo de indicadores de mercado do World Bank. */
export const INDICADORES_WB: DefIndicadorWb[] = [
  {
    codigo: "NY.GDP.MKTP.KD.ZG",
    nome: "Crescimento do PIB (% real anual)",
    unidade: "%",
    percentual: true,
    casas: 2,
    fonteUrl: "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG",
  },
  {
    codigo: "NY.GDP.PCAP.CD",
    nome: "PIB per capita (US$ correntes)",
    unidade: "US$",
    percentual: false,
    casas: 0,
    fonteUrl: "https://data.worldbank.org/indicator/NY.GDP.PCAP.CD",
  },
  {
    codigo: "SL.UEM.TOTL.ZS",
    nome: "Desemprego (% da força de trabalho, ILO)",
    unidade: "%",
    percentual: true,
    casas: 2,
    fonteUrl: "https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS",
  },
  {
    codigo: "FP.CPI.TOTL.ZG",
    nome: "Inflação (% anual, IPC)",
    unidade: "%",
    percentual: true,
    casas: 2,
    fonteUrl: "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
  },
  {
    codigo: "SP.POP.TOTL",
    nome: "População total",
    unidade: "hab",
    percentual: false,
    casas: 0,
    fonteUrl: "https://data.worldbank.org/indicator/SP.POP.TOTL",
  },
  {
    codigo: "GC.DOD.TOTL.GD.ZS",
    nome: "Dívida bruta do governo central (% do PIB)",
    unidade: "%",
    percentual: true,
    casas: 2,
    fonteUrl: "https://data.worldbank.org/indicator/GC.DOD.TOTL.GD.ZS",
  },
];

export function defWb(codigo: string): DefIndicadorWb | undefined {
  return INDICADORES_WB.find((d) => d.codigo === codigo);
}

const WB_BASE = "https://api.worldbank.org/v2/country/BR;US;JP;AR;MX;CL;DE;CN;IN;KR;PT/indicator";

function agora(): string {
  return new Date().toISOString();
}

function montar(
  def: DefIndicadorWb,
  cod: CodPais,
  obs: Observacao[],
): IndicadorExibicao {
  if (obs.length === 0) {
    return indicadorPendente(
      `wb-${def.codigo}-${cod.iso3}`,
      `${def.nome} — ${cod.nome}`,
      "World Bank não retornou dados para este país/indicador.",
      "World Bank Open Data (CC-BY 4.0)",
      def.fonteUrl,
    );
  }
  const ultima = obs[obs.length - 1];
  const yoy = variacaoYoY(obs, def.percentual);
  return {
    id: `wb-${def.codigo}-${cod.iso3}`,
    nome: `${def.nome} — ${cod.nome}`,
    unidade: def.unidade,
    periodicidade: "anual",
    valor: ultima.valor,
    valorFormatado: formatarNumero(ultima.valor, def.casas),
    periodo: ultima.periodo,
    periodoFormatado: ultima.periodo,
    variacaoPct: yoy ? yoy.valor : null,
    serie: obs.slice(-26),
    fonte: "World Bank Open Data (CC-BY 4.0)",
    fonteUrl: def.fonteUrl,
    coletadoEm: agora(),
  };
}

/**
 * Coleta UMA série do World Bank para todos os países do catálogo.
 * Retorna mapa iso3 -> IndicadorExibicao. Falha de rede: mapa vazio.
 */
export async function getSeriePaises(
  env: Env,
  codigo: string,
): Promise<Record<string, IndicadorExibicao>> {
  const def = defWb(codigo);
  if (!def) return {};
  try {
    const json = (await cachedJson(
      env,
      `wb:${codigo}:v2`,
      `${WB_BASE}/${codigo}?format=json&per_page=500&date=2000:2025`,
      24 * 3600,
    )) as unknown;
    const linhas = parseWorldBank(JSON.stringify(json)) as LinhaWorldBank[];
    const saida: Record<string, IndicadorExibicao> = {};
    for (const cod of PAISES) {
      saida[cod.iso3] = montar(def, cod, observacoesWorldBank(linhas, cod.iso3));
    }
    return saida;
  } catch (e) {
    console.error(`coletor worldbank ${codigo}: ${String(e)}`);
    return {};
  }
}

/** Todas as séries do catálogo, por indicador. */
export type PainelPaises = {
  porIndicador: Record<string, Record<string, IndicadorExibicao>>;
  erros: string[];
};

export async function getPainelPaises(env: Env, codigos?: string[]): Promise<PainelPaises> {
  const alvo = codigos?.length ? codigos : INDICADORES_WB.map((d) => d.codigo);
  const res = await Promise.allSettled(alvo.map((c) => getSeriePaises(env, c)));
  const saida: PainelPaises = { porIndicador: {}, erros: [] };
  for (let i = 0; i < alvo.length; i++) {
    const r = res[i];
    if (r.status === "fulfilled" && Object.keys(r.value).length > 0) {
      saida.porIndicador[alvo[i]] = r.value;
    } else {
      const motivo = r.status === "rejected" ? String(r.reason) : "fonte indisponível (nenhum país retornou dado)";
      saida.erros.push(`World Bank ${alvo[i]}: ${motivo}`);
    }
  }
  return saida;
}
