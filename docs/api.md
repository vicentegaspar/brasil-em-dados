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
      "id": "bcb-selic",
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

Indicadores incluídos (Brasil, N1) — do registro único (`src/lib/registro.ts`;
o mesmo descritor alimenta `/api/v1/serie`, `/api/v1/indicadores`,
`/api/indicadores.json`, `/graficos` e a home):

| id | nome | periodicidade |
|---|---|---|
| `bcb-selic` | Selic definida pelo Copom | diária |
| `bcb-cambio` | Dólar PTAX (compra) | diária |
| `bcb-ipca-mensal` | IPCA — variação mensal | mensal |
| `sidra-desocupacao` | Desocupação (PNAD Contínua) | trimestral móvel |
| `sidra-informalidade` | Informalidade (PNAD Contínua) | anual |
| `sidra-pib` | PIB Brasil a preços correntes (R$ bi) | anual |
| `sidra-populacao` | População residente estimada | anual |
| `sidra-ipca-12m` | IPCA — acumulado em 12 meses | mensal |
| `ons-carga` | Carga de energia — total dos subsistemas | mensal |
| `derivado-pib-per-capita` | PIB per capita (derivado, R$) | anual |
| `derivado-juros-reais` | Juros reais (Selic − IPCA 12m, p.p.) | diária |

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
| `derivado-pib-per-capita` · `derivado-juros-reais` | derivados (ver tabela acima) | anual/diária |

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

## GET /api/v1/impostos.json

Dataset estático de referência com as alíquotas básicas de imposto — Brasil
(IRPF pessoa física, tributos de empresas no lucro real) e EUA (federal income
tax single filer 2026, corporate tax). Mesmas tabelas da página `/impostos`,
com fonte, vigência e licença por tabela. Não é série temporal.

## GET /api/v1/datacenters.json

Pacote estático "onde instalar data centers" — mesmos dados da página
`/datacenters`, com fonte, metodologia e licença por bloco:

- `tarifaEnergia.ufs` — tarifa por UF (ANEEL, tarifas homologadas): `residencial`
  (B1 convencional), `comercial` (B3 convencional) e `industrial` (A4 Verde fora
  ponta, componente de energia) em R$/kWh, média entre distribuidoras da UF;
  `nDistribuidoras` e `vigencia` por UF. ODbL. Gerado por `scripts/generate-tarifas.ts`.
- `icms.ufs` — ICMS arrecadado por UF (CONFAZ/SIGDEF, Boletim de Arrecadação):
  `ultimoMes` + valor, e `anoBase` completo + total anual. CC-BY. Gerado por
  `scripts/generate_icms.py`. **Lacuna**: a API do dados.gov.br exige autenticação
  gov.br desde 2026; o último boletim com acesso direto é 12/08/2025 — meses
  seguintes ficam pendentes (exibidos como "—", nunca zero).
- `reformaTributaria.timeline` — IBS/CBS (LC 214/2025): ano-teste 2026 (IBS 0,1% +
  CBS 0,9%, compensáveis), CBS cheia 2027, transição ICMS→IBS 2029-2032, IBS pleno
  2033. Alíquota única nacional — não existe alíquota por estado.
- `metroQuadrado` — status `indisponivel`: FipeZap+ é PDF mensal sem API/CSV;
  nada inventado, coluna exibida como "—".

## GET /api/indicadores.json (legado, mantido)

Servido pelo registro único: mesmos indicadores de `/api/v1/indicadores`, no
formato antigo do F1 (`valor` como string formatada, `periodo` formatado,
`serie` de observações) + metadados (`valor_numerico`, `periodo_canonico`,
`licenca`, `indisponivel`). `erros` lista indicadores indisponíveis no momento.

## Notas

- Idempotência e cache: o coletor roda por request com cache-aside no KV; TTL 6–24h por tipo de série. Não há cron ainda (fase futura — docs/fontes.md).
- Rate limit educado: uma única origem consulta as fontes públicas através do cache; não use a API como espelho dos datasets originais.
