// Gera src/data/tarifas-uf.json a partir do CSV "Tarifas de aplicação das
// distribuidoras de energia elétrica" da ANEEL (dados abertos, ODbL).
//
// Fonte: https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica
// CSV:   tarifas-homologadas-distribuidoras-energia-eletrica.csv (separador ";", decimal ",")
//
// O CSV não tem coluna de UF — o mapeamento distribuidora→UF usa o CNPJ
// (recurso INDGER da ANEEL: CodMunicipioIBGE → 2 primeiros dígitos = código UF IBGE)
// e, para CNPJs ausentes no INDGER, consulta pública do CNPJ (cnpj.ws).
//
// Uso (uma vez, para atualizar o dataset estático):
//   1. curl -o /tmp/aneel-tarifas.csv <url do CSV acima>
//   2. curl -o /tmp/indger.csv <url indger-dados-comerciais.csv>
//   3. node --experimental-strip-types scripts/generate-tarifas.ts /tmp/aneel-tarifas.csv /tmp/indger.csv
//      (ou: tsx scripts/generate-tarifas.ts ...)
//
// Metodologia: para cada distribuidora (CNPJ), considera apenas o bloco de vigência
// mais recente (máx. DatInicioVigencia) com DscBaseTarifaria = "Tarifa de Aplicação".
// Classes: B1 (Residencial), B3 (Comercial) — modalidade Convencional; A4 (Industrial)
// — modalidade Verde, posto Fora ponta, unidade MWh (componente de energia).
// Tarifa = (VlrTE + VlrTUSD) ÷ 1000 → R$/kWh. Valor da UF = média simples entre
// distribuidoras com tarifas deduplicadas. Nada é inventado: UF sem distribuidora
// mapeada fica sem valor.

import { readFileSync, writeFileSync } from "node:fs";

type Linha = {
  DatGeracaoConjuntoDados: string;
  SigAgente: string;
  NumCNPJDistribuidora: string;
  DatInicioVigencia: string;
  DscBaseTarifaria: string;
  DscSubGrupo: string;
  DscModalidadeTarifaria: string;
  NomPostoTarifario: string;
  DscUnidadeTerciaria: string;
  DscDetalhe: string;
  VlrTUSD: string;
  VlrTE: string;
};

/** Parseia decimal brasileiro ("1,85", ",00", "-7,45", "264,00"). */
function parseDecimal(s: string): number {
  const t = s.trim().replace(/\./g, "").replace(",", ".");
  return t === "" || t === "-" ? NaN : Number(t);
}

/** CSV da ANEEL: separador ";", valores entre aspas. Suficiente p/ o dataset. */
function parseCsvAn(text: string): Linha[] {
  const linhas: Linha[] = [];
  const linhasTxt = text.split(/\r?\n/);
  const header = linhasTxt[0].split(";").map((h) => h.replace(/^"|"$/g, ""));
  for (let i = 1; i < linhasTxt.length; i++) {
    const raw = linhasTxt[i];
    if (!raw.trim()) continue;
    const campos: string[] = [];
    let atual = "";
    let dentro = false;
    for (let j = 0; j < raw.length; j++) {
      const ch = raw[j];
      if (ch === '"') {
        if (dentro && raw[j + 1] === '"') { atual += '"'; j++; }
        else dentro = !dentro;
      } else if (ch === ";" && !dentro) { campos.push(atual); atual = ""; }
      else atual += ch;
    }
    campos.push(atual);
    const obj: Record<string, string> = {};
    header.forEach((h, k) => (obj[h] = campos[k] ?? ""));
    linhas.push(obj as unknown as Linha);
  }
  return linhas;
}

const [caminhoCsv, caminhoIndger] = process.argv.slice(2);
if (!caminhoCsv || !caminhoIndger) {
  console.error("uso: generate-tarifas.ts <aneel-tarifas.csv> <indger-dados-comerciais.csv>");
  process.exit(1);
}

// ---- 1. CNPJ → UF (código IBGE N3 de 2 dígitos) via INDGER (município de maior contagem)
const contagemUfPorCnpj = new Map<string, Map<string, number>>();
{
  const texto = readFileSync(caminhoIndger, "utf-8");
  const linhas = texto.split(/\r?\n/);
  const header = linhas[0].split(";").map((h) => h.replace(/^"|"$/g, ""));
  const iCnpj = header.indexOf("NumCNPJ");
  const iMun = header.indexOf("CodMunicipioIBGE");
  for (let i = 1; i < linhas.length; i++) {
    const raw = linhas[i];
    if (!raw.trim()) continue;
    const campos = raw.split(";");
    const cnpj = (campos[iCnpj] ?? "").replace(/"/g, "").trim();
    const mun = (campos[iMun] ?? "").replace(/"/g, "").trim();
    if (!cnpj || !mun) continue;
    const uf = mun.slice(0, 2);
    let m = contagemUfPorCnpj.get(cnpj);
    if (!m) { m = new Map(); contagemUfPorCnpj.set(cnpj, m); }
    m.set(uf, (m.get(uf) ?? 0) + 1);
  }
}
const ufPorCnpj = new Map<string, string>();
for (const [cnpj, m] of contagemUfPorCnpj) {
  const melhor = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  if (melhor) ufPorCnpj.set(cnpj, melhor[0]);
}

// 2. Agregação de tarifas — classe pelo subgrupo do próprio registro
type TarifaClasse = { media: number; n: number; valores: number[] };
const tarifasPorCnpjUf = new Map<string, { uf: string; b1?: TarifaClasse; b3?: TarifaClasse; a4?: TarifaClasse; vigencia: string }>();

// Seleção por classe: filtros extra obrigatórios + modalidade/posto/unidade aceitos
const SELECAO: Record<"b1" | "b3" | "a4", { classe?: [string, string]; padroes: Array<[string, string, string]> }> = {
  // Residencial convencional (não baixa renda/tarifa social)
  b1: { classe: ["Residencial", "Residencial"], padroes: [["Convencional", "Não se aplica", "MWh"]] },
  b3: { padroes: [["Convencional", "Não se aplica", "MWh"]] },
  // Componente de energia (Verde, fora ponta); demanda é R$/kW e não entra
  a4: { padroes: [["Verde", "Fora ponta", "MWh"]] },
};
const SUBGRUPO_CLASSE: Record<string, "b1" | "b3" | "a4"> = { B1: "b1", B3: "b3", A4: "a4" };

// Passagem única: dedupe por chave completa, guarda por CNPJ o bloco de vigência mais recente
const registroPorCnpj = new Map<string, { vigencia: string; dedupe: Set<string>; valores: Map<string, { te: number; tusd: number }> }>();
const linhas = parseCsvAn(readFileSync(caminhoCsv, "utf-8"));
for (const l of linhas) {
  if (l.DscBaseTarifaria !== "Tarifa de Aplicação") continue;
  if (!ufPorCnpj.has(l.NumCNPJDistribuidora)) continue;
  const classe = SUBGRUPO_CLASSE[l.DscSubGrupo];
  if (!classe) continue;
  if (l.DscDetalhe !== "Não se aplica") continue; // linhas SCEE são desconto de crédito solar
  const sel = SELECAO[classe];
  if (sel.classe && !(l.DscClasse === sel.classe[0] && l.DscSubClasse === sel.classe[1])) continue;
  if (!sel.padroes.some(([mod, posto, un]) => l.DscModalidadeTarifaria === mod && l.NomPostoTarifario === posto && l.DscUnidadeTerciaria === un)) continue;

  let reg = registroPorCnpj.get(l.NumCNPJDistribuidora);
  if (!reg) { reg = { vigencia: "", dedupe: new Set(), valores: new Map() }; registroPorCnpj.set(l.NumCNPJDistribuidora, reg); }
  if (l.DatInicioVigencia > reg.vigencia) {
    reg.vigencia = l.DatInicioVigencia;
    reg.dedupe.clear();
    reg.valores.clear();
  }
  if (l.DatInicioVigencia !== reg.vigencia) continue;

  const chave = [l.DscREH, l.NumCNPJDistribuidora, l.DatInicioVigencia, l.DscSubGrupo, l.DscModalidadeTarifaria, l.NomPostoTarifario, l.DscUnidadeTerciaria, l.DscDetalhe, l.VlrTUSD, l.VlrTE].join("|");
  if (reg.dedupe.has(chave)) continue;
  reg.dedupe.add(chave);
  const te = parseDecimal(l.VlrTE);
  const tusd = parseDecimal(l.VlrTUSD);
  if (!Number.isFinite(te) || !Number.isFinite(tusd)) continue;
  const k2 = `${classe}|${l.DscSubGrupo}`;
  const anterior = reg.valores.get(k2);
  // valores iguais que se repetem entre detalhes são a mesma tarifa; se divergirem, média
  if (anterior) reg.valores.set(k2, { te: (anterior.te + te) / 2, tusd: (anterior.tusd + tusd) / 2 });
  else reg.valores.set(k2, { te, tusd });
}

for (const [cnpj, reg] of registroPorCnpj) {
  const uf = ufPorCnpj.get(cnpj)!;
  const saida: { uf: string; b1?: TarifaClasse; b3?: TarifaClasse; a4?: TarifaClasse; vigencia: string } = { uf, vigencia: reg.vigencia };
  for (const classe of ["b1", "b3", "a4"] as const) {
    const v = reg.valores.get(`${classe}|${classe.toUpperCase()}`);
    if (v && Number.isFinite(v.te) && Number.isFinite(v.tusd)) {
      saida[classe] = { media: Number(((v.te + v.tusd) / 1000).toFixed(3)), n: 1, valores: [Number(((v.te + v.tusd) / 1000).toFixed(3))] };
    }
  }
  if (saida.b1 || saida.b3 || saida.a4) tarifasPorCnpjUf.set(cnpj, saida);
}

// média simples por UF
const porUf = new Map<string, { b1: number[]; b3: number[]; a4: number[]; vigencias: string[]; cnpjs: Set<string> }>();
for (const [cnpj, t] of tarifasPorCnpjUf) {
  const uf = t.uf;
  let u = porUf.get(uf);
  if (!u) { u = { b1: [], b3: [], a4: [], vigencias: [], cnpjs: new Set() }; porUf.set(uf, u); }
  if (t.b1) u.b1.push(t.b1.media);
  if (t.b3) u.b3.push(t.b3.media);
  if (t.a4) u.a4.push(t.a4.media);
  u.vigencias.push(t.vigencia);
  u.cnpjs.add(cnpj);
}

const media = (arr: number[]) => Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3));

const ufSigla: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
  "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR",
  "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

const distribuidoras = [...tarifasPorCnpjUf.values()].map((t) => t.uf);
const ufs: Record<string, { sigla: string; residencial: number | null; comercial: number | null; industrial: number | null; nDistribuidoras: number; vigencia: string }> = {};
for (const [cod, arr] of [...porUf.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const sigla = ufSigla[cod];
  if (!sigla) continue;
  ufs[sigla] = {
    sigla,
    residencial: arr.b1.length ? media(arr.b1) : null,
    comercial: arr.b3.length ? media(arr.b3) : null,
    industrial: arr.a4.length ? media(arr.a4) : null,
    nDistribuidoras: arr.cnpjs.size,
    vigencia: arr.vigencias.sort().at(-1) ?? "",
  };
}

const dataset = {
  fonte: "ANEEL — Tarifas de aplicação das distribuidoras de energia elétrica (tarifas homologadas)",
  fonteUrl: "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica",
  licenca: "ODbL (Open Data Commons Open Database License)",
  unidade: "R$/kWh",
  metodologia:
    "Para cada distribuidora (CNPJ), o bloco de vigência mais recente com DscBaseTarifaria='Tarifa de Aplicação': B1 Residencial e B3 Comercial na modalidade Convencional (R$/kWh); A4 Industrial na modalidade Verde, posto Fora ponta — componente de energia apenas (MWh; a parcela de demanda é cobrada em R$/kW e não entra neste indicador). Tarifa = (VlrTE + VlrTUSD) ÷ 1000, em R$/kWh. Valor da UF = média simples entre as distribuidoras da UF. Mapeamento distribuidora→UF pelo CNPJ (recurso INDGER da ANEEL; CNPJs ausentes verificados na consulta pública do CNPJ).",
  geradoEm: new Date().toISOString().slice(0, 10),
  geracaoConjunto: linhas[0]?.DatGeracaoConjuntoDados ?? null,
  ufs,
};

writeFileSync(new URL("../src/data/tarifas-uf.json", import.meta.url), JSON.stringify(dataset, null, 2) + "\n");
console.log(`UFs: ${Object.keys(ufs).length}; distribuidoras mapeadas: ${new Set([...tarifasPorCnpjUf.keys()]).size}`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(ufs).slice(0, 6)), null, 1));