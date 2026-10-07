// API v1 — dataset de impostos básicos (Brasil × EUA), estático e versionado.
// GET /api/v1/impostos.json — mesmas tabelas da página /impostos, com fonte,
// vigência e licença por tabela. Documentado em docs/api.md.
import impostosDados from "../../../data/impostos.json";

export async function GET() {
  return new Response(JSON.stringify(impostosDados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
