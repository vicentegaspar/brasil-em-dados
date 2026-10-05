// Coletor de BUILD — balanços das listadas via CVM open data.
// O zip anual do DFP é pesado demais para parsear no runtime do Workers
// (limite de CPU -> error 1102 em produção). Este script baixa, extrai e
// parseia a DRE localmente e escreve src/data/empresas.json, versionado em
// git. Rodar anualmente quando a CVM publicar o novo DFP:
//   npx tsx scripts/generate-empresas.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { parseCvmDreCsv, EMPRESAS_CATALOGO } from "../src/lib/parsers";

const ANO = new Date().getFullYear();

const CSV_ESPERADO = (ano: number) => `dfp_cia_aberta_DRE_con_${ano}.csv`;

// Tenta o exercício do ano corrente; DFP recém-publicado pode estar parcial
// (poucas empresas entregaram) — cai para o exercício anterior se o catálogo
// não estiver presente.
async function main() {
  for (const ano of [ANO, ANO - 1, ANO - 2]) {
    const url = `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/Dados/dfp_cia_aberta_${ano}.zip`;
    console.log(`Tentando ${url} ...`);
    const res = await fetch(url, {
      headers: { "User-Agent": "brasil-em-dados/0.1 (coletor de build)" },
    });
    if (!res.ok) {
      console.log(`HTTP ${res.status} — exercício ${ano} indisponível, tentando anterior`);
      continue;
    }
    const zip = new Uint8Array(await res.arrayBuffer());
    const arquivos = unzipSync(zip);
    const dre = arquivos[CSV_ESPERADO(ano)];
    if (!dre) throw new Error(`${CSV_ESPERADO(ano)} não encontrado no zip (arquivos: ${Object.keys(arquivos).join(", ")})`);
    const txt = new TextDecoder("latin1").decode(dre);
    const empresas = parseCvmDreCsv(txt, EMPRESAS_CATALOGO);
    if (empresas.length === 0) {
      console.log(`Catálogo ausente no exercício ${ano} (DFP parcial) — tentando anterior`);
      continue;
    }
    const out = {
      gerado_em: new Date().toISOString(),
      fonte: "CVM open data — DFP (dados.cvm.gov.br)",
      exercicioFonte: `dfp_cia_aberta_${ano}.zip`,
      empresas,
    };
    const destino = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/empresas.json");
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, JSON.stringify(out, null, 2) + "\n", "utf-8");
    console.log(`OK: ${empresas.length} empresas (exercício ${ano}) escritas em src/data/empresas.json`);
    return;
  }
  throw new Error("Nenhum exercício DFP da CVM com o catálogo completo nos últimos 3 anos");
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});