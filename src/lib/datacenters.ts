// Dados estaduais para avaliação de "onde instalar data centers" — leitura dos
// datasets estáticos versionados (mesmo regime do impostos.json): tarifa de
// energia por UF (ANEEL), ICMS arrecadado por UF (CONFAZ/SIGDEF) e timeline
// IBS/CBS (LC 214/2025). m² médio por capital (FipeZap) não tem API pública —
// a coluna fica oficialmente indisponível (nada inventado).
import tarifasUf from "../data/tarifas-uf.json";
import icmsUf from "../data/icms-uf.json";
import reforma from "../data/reforma-tributaria.json";
import { UFS } from "./localidades";

export type TarifaUf = {
  sigla: string;
  residencial: number | null;
  comercial: number | null;
  industrial: number | null;
  nDistribuidoras: number;
  vigencia: string;
};

export type IcmsUf = {
  sigla: string;
  nome: string;
  ultimoMes: string;
  icmsUltimoMes: number;
  anoBase: number | null;
  icmsAnoBase: number | null;
  nMesesAnoBase: number | null;
};

export type LinhaDatacenter = {
  sigla: string;
  nome: string;
  tarifaResidencial: number | null;
  tarifaComercial: number | null;
  tarifaIndustrial: number | null;
  nDistribuidoras: number;
  vigenciaTarifa: string;
  icmsUltimoMes: string | null;
  icmsUltimoMesBi: number | null;
  icmsAnoBase: number | null;
  icmsAnoBaseBi: number | null;
  icmsAnoReferencia: number | null;
  /** Metros quadrados médios de venda na capital — indisponível (FipeZap sem API). */
  metroQuadrado: null;
};

const tarifas = (tarifasUf as unknown as { ufs: Record<string, TarifaUf>; geradoEm: string; geracaoConjunto: string | null }).ufs;
const icms = (icmsUf as unknown as { ufs: Record<string, IcmsUf> }).ufs;

export const TARIFAS_META = tarifasUf as unknown as {
  fonte: string;
  fonteUrl: string;
  licenca: string;
  unidade: string;
  metodologia: string;
  geradoEm: string;
  geracaoConjunto: string | null;
};

export const ICMS_META = icmsUf as unknown as {
  fonte: string;
  fonteUrl: string;
  licenca: string;
  unidade: string;
  metodologia: string;
  extracaoArquivo: string | null;
};

export const REFORMA = reforma as unknown as {
  fonte: string;
  fonteUrl: string;
  atualizadoEm: string;
  resumo: string;
  timeline: Array<{ ano: string; fase: string; detalhe: string }>;
  notasPorUf: string;
};

/** Linha por UF (27 UFs sempre presentes; colunas sem fonte = null → "—"). */
export function linhasDatacenters(): LinhaDatacenter[] {
  return UFS.map((uf) => {
    const t = tarifas[uf.sigla] ?? null;
    const i = icms[uf.sigla] ?? null;
    return {
      sigla: uf.sigla,
      nome: uf.nome,
      tarifaResidencial: t?.residencial ?? null,
      tarifaComercial: t?.comercial ?? null,
      tarifaIndustrial: t?.industrial ?? null,
      nDistribuidoras: t?.nDistribuidoras ?? 0,
      vigenciaTarifa: t?.vigencia ?? "",
      icmsUltimoMes: i?.ultimoMes ?? null,
      icmsUltimoMesBi: i ? i.icmsUltimoMes / 1e9 : null,
      icmsAnoBase: i?.anoBase ?? null,
      icmsAnoBaseBi: i?.icmsAnoBase != null ? i.icmsAnoBase / 1e9 : null,
      icmsAnoReferencia: i?.anoBase ?? null,
      metroQuadrado: null,
    };
  });
}

export function datacentersPorSigla(sigla: string): LinhaDatacenter | null {
  return linhasDatacenters().find((l) => l.sigla === sigla.toUpperCase()) ?? null;
}

/** Pacote para /api/v1/datacenters.json — estático e versionado. */
export function pacoteDatacenters() {
  return {
    geradoEm: TARIFAS_META.geradoEm,
    tarifaEnergia: {
      ...TARIFAS_META,
      ufs: tarifas,
    },
    icms: {
      ...ICMS_META,
      ufs: icms,
    },
    reformaTributaria: REFORMA,
    metroQuadrado: {
      fonte: "FipeZap+ (Fundação FIPE/ZAP)",
      fonteUrl: "https://www.fipe.org.br/pt-br/indexos/aspi/fipezap-plus",
      status: "indisponivel",
      motivo: "Publicação mensal em PDF sem API ou CSV estruturado — coluna não exibida até haver extração confiável (nada inventado).",
    },
  };
}