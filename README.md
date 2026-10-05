# 🇧🇷 Brasil em Dados

Painel público e open source de estatísticas do Brasil — população, economia e
indicadores macroeconômicos — para explorar, comparar e decidir onde viver,
investir e empreender.

## Stack

- [Astro](https://astro.build) (SSR) + adaptador Cloudflare
- Cloudflare Workers/Pages + KV (cache das respostas das APIs públicas)
- Fonte principal: **API IBGE / SIDRA** (servicodados.ibge.gov.br)

## Como funciona

- O site consulta a API v3 do IBGE **via servidor**, com **cache-aside em KV**:
  o IBGE quase nunca é chamado por visita (TTL de horas por indicador), o que
  respeita os termos de uso da fonte e mantém a resposta rápida.
- Indicadores aparecem sempre com **período de referência e fonte**. Dado
  ausente ou falho aparece como erro honesto — nunca como número inventado.
- Nenhum dado pessoal é coletado. Sem cookies de rastreamento.

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:4321
npm run check      # typecheck
npm run build      # build de produção
```

O KV `CACHE` é resolvido em dev via `platformProxy` do `wrangler.jsonc`
(estado local em `.wrangler/`). Para o KV remoto, crie um namespace
(`npx wrangler kv namespace create CACHE`) e preencha o `id` no
`wrangler.jsonc`.

## Endpoints

- `GET /` — painel (SSR)
- `GET /api/indicadores.json` — JSON público com os mesmos indicadores

## Roadmap

- Drill-down Brasil → estado → município (localidades IBGE)
- PIB municipal, IDHM, empresas, energia
- Scorecards comparativos ("vale a pena viver/investir aqui?")
- Gráficos interativos por indicador

## Licença

MIT — veja [LICENSE](LICENSE).
