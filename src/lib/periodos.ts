// Formatadores de período e número (pt-BR), sem depender de Intl do runtime
// (funciona igual no Node dos testes e no Workers).

export const MESES_ABREV = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
] as const;

/** "202508" -> "ago/2025"; aceita "2025-08" também */
export function formatarPeriodoMensal(periodo: string): string {
  const m = /^(\d{4})-?(\d{2})$/.exec(periodo);
  if (!m) return periodo;
  const mes = Number(m[2]);
  return `${MESES_ABREV[mes - 1] ?? mes}/${m[1]}`;
}

/** "2025" -> "2025" (identidade, mas valida) */
export function formatarPeriodoAnual(periodo: string): string {
  return /^\d{4}$/.test(periodo) ? periodo : periodo;
}

/** "2026-10-05" -> "05/out/2026"; "05/10/2026" (BCB) -> "05/out/2026" */
export function formatarPeriodoDiaria(periodo: string): string {
  let a: string, me: string, d: string;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodo);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(periodo);
  if (iso) [a, me, d] = [iso[1], iso[2], iso[3]];
  else if (br) [d, me, a] = [br[1], br[2], br[3]];
  else return periodo;
  return `${d}/${MESES_ABREV[Number(me) - 1] ?? me}/${a}`;
}

/** Formato canônico de período a partir de datas das fontes */
export function normalizarPeriodo(
  periodicidade: "diaria" | "mensal" | "anual" | "trimestral-movel",
  bruto: string,
): string {
  if (periodicidade === "diaria" || periodicidade === "mensal" || periodicidade === "trimestral-movel") {
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(bruto); // BCB "05/10/2026"
    if (br) bruto = `${br[3]}-${br[2]}-${br[1]}`; // -> ISO "2026-10-05"
  }
  if (periodicidade === "mensal" || periodicidade === "trimestral-movel") {
    const br = /^(\d{4})(\d{2})$/.exec(bruto); // SIDRA "202508"
    if (br) return `${br[1]}-${br[2]}`;
    return bruto.slice(0, 7); // "2026-10-31" (ONS)
  }
  if (periodicidade === "diaria") {
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(bruto); // BCB "05/10/2026"
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    return bruto;
  }
  return bruto; // anual: "2025"
}

/** 1234567.89 -> "1.234.567,89"; 13.75 -> "13,75" */
export function formatarNumero(v: number, casasDecimais = 2): string {
  if (!Number.isFinite(v)) return "";
  const neg = v < 0 ? "-" : "";
  const fixado = Math.abs(v).toFixed(casasDecimais);
  const [inteiro, decimal] = fixado.split(".");
  const intComSeparador = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg}${intComSeparador}${decimal ? "," + decimal : ""}`;
}

/** Reais em bilhões: 497549000000 -> "497,5" */
export function formatarBilhoes(v: number): string {
  return formatarNumero(v / 1e9, 1);
}

export function formatarVariacaoPct(v: number): string {
  return `${v >= 0 ? "+" : "-"}${formatarNumero(Math.abs(v), 2)}%`;
}
