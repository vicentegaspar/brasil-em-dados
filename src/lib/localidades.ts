// Localidades IBGE: Brasil (N1) e Unidades da Federação (códigos N3).
// Nomes oficiais como aparecem nas APIs SIDRA/apisidra.

export type Uf = {
  sigla: string;
  nome: string;
  /** Código IBGE N3 */
  codigo: string;
};

export const BRASIL: Uf = { sigla: "BR", nome: "Brasil", codigo: "1" };

export const UFS: Uf[] = [
  { sigla: "RO", nome: "Rondônia", codigo: "11" },
  { sigla: "AC", nome: "Acre", codigo: "12" },
  { sigla: "AM", nome: "Amazonas", codigo: "13" },
  { sigla: "RR", nome: "Roraima", codigo: "14" },
  { sigla: "PA", nome: "Pará", codigo: "15" },
  { sigla: "AP", nome: "Amapá", codigo: "16" },
  { sigla: "TO", nome: "Tocantins", codigo: "17" },
  { sigla: "MA", nome: "Maranhão", codigo: "21" },
  { sigla: "PI", nome: "Piauí", codigo: "22" },
  { sigla: "CE", nome: "Ceará", codigo: "23" },
  { sigla: "RN", nome: "Rio Grande do Norte", codigo: "24" },
  { sigla: "PB", nome: "Paraíba", codigo: "25" },
  { sigla: "PE", nome: "Pernambuco", codigo: "26" },
  { sigla: "AL", nome: "Alagoas", codigo: "27" },
  { sigla: "SE", nome: "Sergipe", codigo: "28" },
  { sigla: "BA", nome: "Bahia", codigo: "29" },
  { sigla: "MG", nome: "Minas Gerais", codigo: "31" },
  { sigla: "ES", nome: "Espírito Santo", codigo: "32" },
  { sigla: "RJ", nome: "Rio de Janeiro", codigo: "33" },
  { sigla: "SP", nome: "São Paulo", codigo: "35" },
  { sigla: "PR", nome: "Paraná", codigo: "41" },
  { sigla: "SC", nome: "Santa Catarina", codigo: "42" },
  { sigla: "RS", nome: "Rio Grande do Sul", codigo: "43" },
  { sigla: "MS", nome: "Mato Grosso do Sul", codigo: "50" },
  { sigla: "MT", nome: "Mato Grosso", codigo: "51" },
  { sigla: "GO", nome: "Goiás", codigo: "52" },
  { sigla: "DF", nome: "Distrito Federal", codigo: "53" },
];

/** Resposta do apisidra vem com nome como "Rondônia (11)"? Não — "Rondônia". */
export function ufPorSigla(sigla: string): Uf | null {
  const s = sigla.toUpperCase();
  if (s === "BR") return BRASIL;
  return UFS.find((u) => u.sigla === s) ?? null;
}

/** Encontra a UF pelo nome exibido nas respostas do SIDRA. */
export function ufPorNome(nome: string): Uf | null {
  return UFS.find((u) => u.nome === nome) ?? null;
}
