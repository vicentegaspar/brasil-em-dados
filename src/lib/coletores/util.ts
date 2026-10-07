// Utilitário comum dos coletores: tenta buscar a série e monta o IndicadorExibicao
// a partir dos metadados do descritor; falha de fonte NÃO é zero — vira indicador
// pendente com o motivo (regra de ouro: nunca inventar número).

import type { Env } from "../cache";
import {
  indicadorPendente,
  montarIndicador,
  type IndicadorExibicao,
  type MetaIndicador,
  type Observacao,
} from "../model";

/** Envolve um buscador de observações com try/catch + montagem única. */
export function comFonte(
  meta: MetaIndicador,
  buscar: (env: Env) => Promise<Observacao[]>,
): (env: Env) => Promise<IndicadorExibicao> {
  return async (env) => {
    try {
      return montarIndicador(meta, await buscar(env));
    } catch (e) {
      console.error(`coletor ${meta.id}: ${String(e)}`);
      return indicadorPendente(meta, `Fonte indisponível (${String(e)}).`);
    }
  };
}
