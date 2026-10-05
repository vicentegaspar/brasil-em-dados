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

## GET /api/indicadores.json (legado, mantido)

Compatibilidade do F1: população estimada + IPCA 12m (IBGE).

## Notas

- Idempotência e cache: o coletor roda por request com cache-aside no KV; TTL 6–24h por tipo de série. Não há cron ainda (fase futura — docs/fontes.md).
- Rate limit educado: uma única origem consulta as fontes públicas através do cache; não use a API como espelho dos datasets originais.
