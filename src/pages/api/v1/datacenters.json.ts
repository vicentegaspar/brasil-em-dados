// API v1 — pacote estático "data centers": tarifa de energia por UF (ANEEL),
// ICMS arrecadado por UF (CONFAZ/SIGDEF) e timeline IBS/CBS (LC 214/2025).
// GET /api/v1/datacenters.json — mesmo conteúdo da página /datacenters, com
// fonte, metodologia e licença. Documentado em docs/api.md.
import { pacoteDatacenters } from "../../../lib/datacenters";

export async function GET() {
  return new Response(JSON.stringify(pacoteDatacenters(), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}