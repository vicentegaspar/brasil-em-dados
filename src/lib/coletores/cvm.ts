// Coletor CVM — balanços (DRE consolidada) das listadas no catálogo.
// Coletor de BUILD: o zip anual é pesado para o runtime do Workers (limite de
// CPU — error 1102 em produção). O script scripts/generate-empresas.ts baixa,
// parseia e versiona o resultado em src/data/empresas.json (rode com
// `npx tsx scripts/generate-empresas.ts` quando a CVM publicar o novo DFP).

import empresasDados from "../../data/empresas.json";
import type { BalancoEmpresa } from "../parsers";

export type Balancos = { empresas: BalancoEmpresa[]; exercicioFonte: string };

const BALANCOS_DADOS = empresasDados as unknown as Balancos;

export function getBalancos(): Promise<Balancos> {
  return Promise.resolve(BALANCOS_DADOS);
}

export async function getBalancosSeguro(): Promise<Balancos | null> {
  try {
    return await getBalancos();
  } catch (e) {
    console.error(`coletor cvm: ${String(e)}`);
    return null;
  }
}
