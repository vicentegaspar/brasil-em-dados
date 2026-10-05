// Parsers puros (funções sem rede) — testados contra respostas reais salvas
// em tests/fixtures/. Cada parser só entende o formato de uma fonte.

import type { Observacao, Periodicidade } from "./model";
import { normalizarPeriodo } from "./periodos";

/** SGS/BCB: [{"data":"03/11/2026","valor":"13.75"}, ...] */
export function parseBcbSgs(txt: string, periodicidade: Extract<Periodicidade, "diaria" | "mensal"> = "diaria"): Observacao[] {
  const dados = JSON.parse(txt) as { data: string; valor: string }[];
  if (!Array.isArray(dados)) throw new Error("BCB SGS: resposta não é um array");
  const obs: Observacao[] = [];
  for (const item of dados) {
    const valor = Number(item.valor);
    if (!Number.isFinite(valor)) continue; // '-' ou vazio
    const periodo = normalizarPeriodo(periodicidade, item.data);
    if (periodo === item.data && periodicidade === "diaria") continue; // data inesperada
    obs.push({ periodo, valor });
  }
  return obs.sort((a, b) => a.periodo.localeCompare(b.periodo));
}

/** apisidra (values): [{V:"Valor",...cabeçalho}, {NC:"3", ..., D2C:"2022", D3C:"11", D3N:"Rondônia", V:"1234"}] */
export type SidraLinha = Record<string, string>;

export function parseSidraValues(txt: string): SidraLinha[] {
  const bruto = JSON.parse(txt) as SidraLinha[];
  if (!Array.isArray(bruto) || bruto.length === 0) throw new Error("SIDRA: resposta vazia");
  return bruto.slice(1); // [0] é o cabeçalho
}

/**
 * Extrai observações das linhas apisidra para UMA localidade (por código D3C)
 * de UMA variável (D1C). Ignora valores não numéricos ("-", "..", SI).
 */
export function observacoesSidra(
  linhas: SidraLinha[],
  variavel: string,
  codigoLocalidade: string,
  periodicidade: Extract<Periodicidade, "anual" | "mensal" | "diaria" | "trimestral-movel">,
): Observacao[] {
  const obs: Observacao[] = [];
  for (const l of linhas) {
    if (l["D1C"] !== variavel) continue;
    if (l["D3C"] !== codigoLocalidade) continue;
    const valor = Number(l["V"]);
    if (!Number.isFinite(valor)) continue;
    // apisidra anual: D2C "2022"; mensal: "202508"
    obs.push({ periodo: normalizarPeriodo(periodicidade, l["D2C"]), valor });
  }
  return obs.sort((a, b) => a.periodo.localeCompare(b.periodo));
}

/** Nomes das localidades presentes nas linhas (D3C -> D3N). */
export function nomesLocalidadesSidra(linhas: SidraLinha[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const l of linhas) if (l["D3C"] && l["D3N"]) m.set(l["D3C"], l["D3N"]);
  return m;
}

/**
 * ONS Carga Mensal: CSV ";" com colunas
 * id_subsistema;nom_subsistema;din_instante;val_cargaenergiamwmed
 * Meses incompletos vêm com "0E-8" — descartados.
 */
export type OnsCargaMes = { mes: string; subsistema: string; mwmed: number };

export function parseOnsCargaMensal(txt: string): OnsCargaMes[] {
  const linhas = txt.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (linhas.length < 2) throw new Error("ONS: CSV vazio");
  const cab = linhas[0].split(";");
  const idx = (nome: string) => cab.indexOf(nome);
  const iSub = idx("nom_subsistema");
  const iData = idx("din_instante");
  const iVal = idx("val_cargaenergiamwmed");
  if (iSub < 0 || iData < 0 || iVal < 0) throw new Error("ONS: colunas inesperadas");
  const out: OnsCargaMes[] = [];
  for (const l of linhas.slice(1)) {
    const p = l.split(";");
    const val = Number(p[iVal]);
    if (!Number.isFinite(val) || val <= 0) continue; // mês incompleto (0E-8)
    out.push({
      mes: normalizarPeriodo("mensal", p[iData]),
      subsistema: p[iSub].trim(),
      mwmed: val,
    });
  }
  return out;
}

/** Soma por mês em MWmed (total Brasil = 4 subsistemas). */
export function totalCargaMensal(dados: OnsCargaMes[]): Observacao[] {
  const porMes = new Map<string, number>();
  for (const d of dados) porMes.set(d.mes, (porMes.get(d.mes) ?? 0) + d.mwmed);
  return [...porMes.entries()]
    .map(([periodo, valor]) => ({ periodo, valor }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
}

/**
 * CVM DFP — Demonstração do Resultado (csv ';', latin-1), ex.:
 * CNPJ_CIA;...;ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;...
 */
export type ContaDre = "receita" | "lucro_liquido";
export const CONTAS_DRE: Record<string, ContaDre> = {
  "3.01": "receita",
  "3.11.01.001": "lucro_liquido",
};

export type BalancoEmpresa = {
  ticker: string;
  cnpj: string;
  nome: string;
  /** Exercício fiscal (ano de DT_FIM_EXERC) */
  ano: number;
  receita: number | null;
  lucroLiquido: number | null;
  /** escala "MIL" -> valores já multiplicados por 1000 (R$) */
  escala: string;
};

export type EmpresaCatalogo = { ticker: string; cnpj: string; nome: string };

export const EMPRESAS_CATALOGO: EmpresaCatalogo[] = [
  { ticker: "PETR", cnpj: "33.000.167/0001-01", nome: "Petrobras (PETR4)" },
  { ticker: "ITUB", cnpj: "60.872.504/0001-23", nome: "Itaú Unibanco (ITUB4)" },
  { ticker: "BBAS3", cnpj: "00.000.000/0001-91", nome: "Banco do Brasil (BBAS3)" },
];

const ORDEM_PESO: Record<string, number> = { "ÚLTIMO": 2, "PENÚLTIMO": 1 };

export function parseCvmDreCsv(txt: string, catalogo: EmpresaCatalogo[]): BalancoEmpresa[] {
  const linhas = txt.split(/\r?\n/);
  if (linhas.length < 2) throw new Error("CVM: CSV vazio");
  const cab = linhas[0].split(";");
  const col = (nome: string) => cab.indexOf(nome);
  const iCnpj = col("CNPJ_CIA");
  const iDenom = col("DENOM_CIA");
  const iEscala = col("ESCALA_MOEDA");
  const iOrdem = col("ORDEM_EXERC");
  const iFim = col("DT_FIM_EXERC");
  const iConta = col("CD_CONTA");
  const iVal = col("VL_CONTA");
  if ([iCnpj, iDenom, iEscala, iOrdem, iFim, iConta, iVal].some((i) => i < 0)) {
    throw new Error("CVM: colunas inesperadas no CSV da DRE");
  }

  // melhor registro por (cnpj, conta, exercício): maior ORDEM e maior VERSAO
  type Rec = { ordem: number; versao: number; valor: number; denom: string; escala: string };
  const melhor = new Map<string, Rec>();
  for (const l of linhas.slice(1)) {
    const p = l.split(";");
    const conta = CONTAS_DRE[p[iConta]];
    if (!conta) continue;
    const fim = p[iFim];
    if (!/^\d{4}-12-31$/.test(fim)) continue; // só exercício fechado
    const cnpj = p[iCnpj];
    if (!catalogo.some((e) => e.cnpj === cnpj)) continue;
    const peso = ORDEM_PESO[p[iOrdem]] ?? 0;
    if (peso === 0) continue;
    const versao = Number(p[col("VERSAO")]) || 0;
    const val = Number(p[iVal]);
    if (!Number.isFinite(val)) continue;
    const key = `${cnpj}|${conta}|${fim}`;
    const atual = melhor.get(key);
    if (!atual || peso > atual.ordem || (peso === atual.ordem && versao > atual.versao)) {
      melhor.set(key, { ordem: peso, versao, valor: val, denom: p[iDenom], escala: p[iEscala] });
    }
  }

  const saida: BalancoEmpresa[] = [];
  const anosPorCnpj = new Map<string, Set<string>>();
  for (const key of melhor.keys()) {
    const [cnpj, , ano] = key.split("|");
    if (!anosPorCnpj.has(cnpj)) anosPorCnpj.set(cnpj, new Set());
    anosPorCnpj.get(cnpj)!.add(ano);
  }
  for (const e of catalogo) {
    const anos = anosPorCnpj.get(e.cnpj);
    if (!anos) continue;
    for (const fim of anos) {
      const ano = Number(fim.slice(0, 4));
      const escala = melhor.get(`${e.cnpj}|receita|${fim}`)?.escala ?? "";
      const mult = escala === "MIL" ? 1000 : escala === "UNI" ? 1 : 1;
      const rec = melhor.get(`${e.cnpj}|receita|${fim}`);
      const luc = melhor.get(`${e.cnpj}|lucro_liquido|${fim}`);
      saida.push({
        ticker: e.ticker,
        cnpj: e.cnpj,
        nome: rec?.denom ?? e.nome,
        ano,
        receita: rec ? rec.valor * mult : null,
        lucroLiquido: luc ? luc.valor * mult : null,
        escala: escala || "UNI",
      });
    }
  }
  return saida.sort((a, b) => b.ano - a.ano || a.ticker.localeCompare(b.ticker));
}
