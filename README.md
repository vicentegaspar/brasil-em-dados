# 🇧🇷 Brasil em Dados

Painel público e open source de estatísticas do Brasil — juros, câmbio,
inflação, emprego, PIB, energia e balanços de listadas — para explorar,
comparar e decidir onde viver, investir e empreender.

**O núcleo é um motor de coleta e análise de dados**: cada fonte primária tem
um coletor que normaliza tudo em um modelo canônico de séries
(`fonte → localidade → período → valor`) sempre com fonte, período de
referência e data de coleta.

## Stack

- [Astro](https://astro.build) (SSR) + adaptador Cloudflare
- Cloudflare Workers/Pages + KV (cache de leitura das fontes públicas)
- Bindings do Workers via `cloudflare:workers` (Astro v7 removeu `Astro.locals.runtime`)
- Coletores: BCB SGS, IBGE SIDRA/apisidra, ONS (dados abertos), CVM (DFP), World Bank Open Data (CC-BY 4.0)

## Como funciona

- Coleta **por request com cache-aside em KV** (TTL 6–24h por tipo de série):
  as fontes públicas quase nunca são chamadas por visita. Cron agendado é
  fase futura (ver `docs/fontes.md`).
- Indicadores aparecem sempre com **período de referência e fonte**. Fonte
  fora do ar → indicador indisponível com motivo — **nunca número inventado**.
- Licenças por fonte com semáforo (verde/amarelo/vermelho) em `docs/fontes.md`.
  Datasets B3 (curva DI) não são usados — exigem licença de redistribuição.
- Nenhum dado pessoal é coletado. Sem cookies de rastreamento.

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:4321
npm run check      # typecheck (astro check)
npm test           # vitest (parsers/coletores testados contra fixtures reais)
npm run build      # build de produção
```

O KV `CACHE` é resolvido em dev via `platformProxy` do `wrangler.jsonc`
(estado local em `.wrangler/`). Para o KV remoto, crie um namespace
(`npx wrangler kv namespace create CACHE`) e preencha o `id` no
`wrangler.jsonc`.

## Páginas e API

- `GET /` — painel Brasil (Selic, câmbio, IPCA, desocupação, informalidade, PIB, carga de energia)
- `GET /graficos` — gráficos interativos com múltiplas curvas e filtro de período (Chart.js self-hosted)
- `GET /paises` — comparação internacional: 11 países × 6 indicadores de mercado (World Bank)
- `GET /estados` — ranking ordenável das 27 UFs (PIB, PIB per capita derivado, desocupação, informalidade, população)
- `GET /estado/<sigla>` — drill-down por UF (PIB, participação, desocupação, informalidade)
- `GET /scorecards` — índices de investimento com definição/fonte e índice composto com fórmula visível
- `GET /impostos` — tabelas de alíquotas básicas Brasil × EUA (IRPF, IRPJ/CSLL/PIS-Cofins, federal income tax, corporate tax) com fonte e vigência
- `GET /empresas` — balanços de 15 listadas (DRE consolidada da CVM)
- `GET /api/v1/indicadores` — API v1 (JSON, séries completas; `?formato=csv` exporta CSV) — docs em `docs/api.md`
- `GET /api/v1/serie?id=...&inicio=&fim=` — série individual por indicador/localidade (World Bank, BCB, SIDRA, ONS, derivados) — docs em `docs/api.md`
- `GET /api/v1/impostos.json` — dataset de impostos básicos (Brasil × EUA) — docs em `docs/api.md`
- `GET /api/indicadores.json` — endpoint legado do F1, servido pelo registro único (todos os indicadores nacionais)

## Roadmap

- Cron de coleta (Workers Cron Triggers / GitHub Actions)
- PIB municipal no drill-down (já coletado via SIDRA 5938 N6)
- Emprego formal (CAGED/RAIS) e finanças públicas (Siconfi) — fontes pendentes, ver `docs/fontes.md`
- Export Parquet/R2 de datasets completos

## Licença

MIT — veja [LICENSE](LICENSE). Dados públicos de fontes oficiais; atribuição
à fonte original em cada indicador.
