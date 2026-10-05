# API pública v1

Sem chave, open data, cacheada em KV. Documento vivo — endpoints versionados em `/api/v1/*`.

## GET /api/v1/indicadores

Lista os indicadores disponíveis com suas séries (últimas observações).

Resposta:

```json
{
  "versao": "v1",
  "atualizado_em": "2026-10-05T17:00:00.000Z",
  "licenca_dados": "dados de fontes públicas (IBGE, BCB, ONS) — ver docs/fontes.md",
  "indicadores": [
    {
      "id": "bcb-sgs-1178-selic-meta",
      "nome": "Taxa Selic definida pelo Copom",
      "unidade": "% a.a.",
      "periodicidade": "diaria",
      "fonte": "Banco Central do Brasil — SGS série 1178",
      "fonte_url": "https://www3.bcb.gov.br/sgspub/",
      "licenca": "verde",
      "coletado_em": "2026-10-05T17:00:01.000Z",
      "localidade": { "nivel": "N1", "codigo": "1", "nome": "Brasil" },
      "observacoes": [{ "periodo": "2026-10-05", "valor": 13.65 }]
    }
  ]
}
```

Indicadores incluídos (Brasil, N1):

| id | nome | periodicidade |
|---|---|---|
| `bcb-sgs-1178-selic-meta` | Selic definida pelo Copom | diária |
| `bcb-sgs-1-cambio` | Dólar PTAX (compra) | diária |
| `bcb-sgs-433-ipca-mensal` | IPCA — variação mensal | mensal |
| `ibge-sidra-6381-desocupacao` | Desocupação (PNAD Contínua) | trimestral móvel |
| `ibge-sidra-4708-informalidade` | Informalidade (PNAD Contínua) | anual |
| `ibge-sidra-5938-pib` | PIB Brasil a preços correntes | anual |
| `ons-carga-mensal` | Carga de energia — total dos subsistemas | mensal |

Observações: formato canônico do período — `YYYY` anual, `YYYY-MM` mensal/trimestral móvel, `YYYY-MM-DD` diária. Indicador indisponível aparece com `observacoes: []` e o motivo é registrado no log e na UI.

## GET /api/v1/indicadores?formato=csv

Exporta todas as observações como CSV (`indicador,localidade,periodo,valor`).

## GET /api/v1/serie

Série individual por indicador/localidade, usada pela página `/graficos`.

```
GET /api/v1/serie?id=wb-FP.CPI.TOTL.ZG-BRA&inicio=2020&fim=2025
```

`id` aceitos:

| padrão | fonte | periodicidade |
|---|---|---|
| `wb-<codIndicador>-<ISO3>` (ex.: `wb-NY.GDP.MKTP.KD.ZG-BRA`) | World Bank Open Data (CC-BY 4.0) | anual |
| `bcb-selic` · `bcb-cambio` · `bcb-ipca-mensal` | BCB SGS 1178/1/433 | diária/mensal |
| `sidra-desocupacao` · `sidra-informalidade` · `sidra-pib` · `sidra-populacao` · `sidra-ipca-12m` | IBGE apisidra | var. |
| `ons-carga` | ONS (CC-BY) | mensal |

Parâmetros opcionais `inicio`/`fim` filtram por período no formato canônico
(`2015` para anual, `2015-03` para mensal — comparação lexicográfica).

Resposta:

```json
{
  "id": "wb-FP.CPI.TOTL.ZG-BRA",
  "nome": "Inflação (% anual, IPC) — Brasil",
  "unidade": "%",
  "periodicidade": "anual",
  "fonte": "World Bank Open Data (CC-BY 4.0)",
  "fonte_url": "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
  "licenca": "CC-BY 4.0",
  "coletado_em": "2026-10-05T17:00:00.000Z",
  "indisponivel": null,
  "observacoes": [{ "periodo": "2025", "valor": 5.01675279604836 }]
}
```

`id` desconhecido ou fonte fora do ar → `404` com `erro` e a lista de `ids_validos`.

## GET /api/indicadores.json (legado, mantido)

Compatibilidade do F1: população estimada + IPCA 12m (IBGE).

## Notas

- Idempotência e cache: o coletor roda por request com cache-aside no KV; TTL 6–24h por tipo de série. Não há cron ainda (fase futura — docs/fontes.md).
- Rate limit educado: uma única origem consulta as fontes públicas através do cache; não use a API como espelho dos datasets originais.
