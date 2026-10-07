# Plano de Refatoração — brasil-em-dados

> **STATUS: IMPLEMENTADO (2026-10-06).** Fases 1–5 aplicadas e o recurso de
> tributos básicos (Brasil × EUA) incluído (`/impostos` + `/api/v1/impostos.json`
> + `src/data/impostos.json`). Baseline pós-refactor: 62/62 testes,
> `astro check` 0 erros/0 warnings/0 hints, `astro build` verde.
> Verificado: `src/lib/registro.ts` (registro único), `src/lib/coletores/*`
> (coletores por fonte), `src/lib/ibge.ts` e `src/lib/collectors.ts` **removidos**.

> Gerado em 2026-10-06 a partir de auditoria do código (metodologia de auditoria
> de modelos financeiros — `audit-xls`: relatório primeiro, corrigir depois — e
> `clean-data-xls`: normalizar antes de estender). Baseline na data: **55/55
> testes passando**, `astro check` com **0 erros / 0 warnings / 6 hints**,
> working tree limpa.

## Metodologia

A auditoria seguiu três princípios dos skills de financial-services instalados:

1. **audit-xls (modelo)**: separar entrada/cálculo, checar inconsistência de
   fórmulas vizinhas, valores hardcoded ("overrides silenciosos"), conversão de
   unidade/escala (mil vs milhão vs bilhão) e relatório com severidade
   Crítico/Aviso/Info antes de mexer em qualquer coisa.
2. **clean-data-xls**: normalizar o modelo canônico (um tipo, um formato de
   período, uma unidade) ANTES de adicionar novas séries — nunca limpar
   transformando em hardcoded.
3. **xlsx-author / ib-check-deck**: insumo e cálculo separados; nenhum número
   entra no site sem fonte, período de referência e data de coleta (regra de
   ouro que o projeto já segue em `model.ts`).

## Achados da auditoria

| # | Arquivo | Local | Severidade | Categoria | Problema | Correção proposta |
|---|---|---|---|---|---|---|
| 1 | `src/lib/ibge.ts` | todo o arquivo | **Crítico** | Modelo duplicado | Pipeline antigo paralelo: próprio `cachedJson`, `KVLike`, `Env`, `formatarPeriodoMensal` e o tipo `Indicador` — tudo já existe em `cache.ts`/`periodos.ts`/`model.ts`. Só sobrevive por causa de `/api/indicadores.json.ts`. | Migrar o endpoint para o pipeline `IndicadorExibicao` e **deletar `ibge.ts`** |
| 2 | `src/lib/collectors.ts` | 586 linhas | **Crítico** | Monólito / inconsistência | BCB + SIDRA + ONS + CVM + derivados + ranking UF + drill-down UF num arquivo só; cada `comFonte(...)` com 9 argumentos posicionais (`id, nome, unidade, periodicidade, fonte, fonteUrl, casas, ...`) — fácil trocar a ordem sem erro de compilação | Fatiar por fonte e trocar argumentos posicionais por objeto-descritor (o padrão que `worldbank.ts` já usa com `INDICADORES_WB` e funciona bem) |
| 3 | `api/v1/serie.ts`, `graficos.astro`, `index.astro` | — | **Crítico** | IDs em 3 lugares | Cada id (`sidra-pib`, `bcb-selic`, `ons-carga`...) é mapeado à mão em três arquivos. Risco real de drift: indicador novo entra num lugar e esquece nos outros (derivados `pib-per-capita` e `juros-reais` já não são acessíveis pela API v1) | Um registro único (`src/lib/registro.ts`) — fonte da verdade para coletores, API e páginas |
| 4 | `collectors.ts` 232, 407, 455 | — | **Aviso** | Escala/unidade | `valor * 1000` (Mil Reais → R$) repetido em 3 lugares; PIB armazenado **em R$** com `unidade: "R$ bi"` — quem consome tem de saber reformatar (`formatarBilhoes`). É o bug de escala clássico que o audit-xls manda caçar | Guardar o valor na unidade canônica (R$) e declarar unidade de exibição + fator no descritor; formatação sai do metadado |
| 5 | `collectors.ts` / `worldbank.ts` | `montarIndicador` vs `montar` | Aviso | Duplicação | Duas funções quase idênticas montando `IndicadorExibicao` (última obs + variação + série curta) | Uma função em `model.ts`, usada por todos os coletores |
| 6 | `collectors.ts` 120, 141, 163 | `parseBcbSgs(JSON.stringify(json))` | Aviso | Round-trip artificial | Cache devolve objeto → serializa de volta pra string só porque o parser aceita string | Parsers tipados aceitarem objeto, ou cache retornar o texto bruto |
| 7 | `api/v1/serie.ts` 83 | `licenca: id.startsWith("wb-")` | Aviso | Metadado hardcoded | Licença deduzida do prefixo do id em vez de vir da série (`SerieIndicador` até tem o campo `licenca`, nunca usado) | Licença no descritor do indicador |
| 8 | `collectors.ts` 571-577 | `getBalancos(_env)` | Info | API enganosa | Assinatura recebe `env` e ignora; `cachedValor` importado e nunca usado | Assinatura sem `env`; remover import |
| 9 | `periodos.ts` 18-20 | `formatarPeriodoAnual` | Info | Código morto | "Identidade, mas valida" — valida e devolve a entrada mesmo inválida | Deletar ou validar de verdade |
| 10 | `collectors.ts` | `slice(-12)`, `slice(-26)`, `date=2000:2025` | Info | Constantes mágicas | Janela de série hardcoded em vários pontos | Constantes nomeadas / campo do descritor |

Pontos fortes a preservar (não quebrar no refactor):

- Parsers puros sem rede, testados contra fixtures reais em `tests/fixtures/`
  (17 fixtures de fontes oficiais) — é o mesmo padrão de auditoria "insight vs
  fórmula" dos skills financeiros; vale estender aos coletores e à API.
- Falha de fonte nunca vira zero: vira `indicadorPendente` com motivo.
- Separação parser (puro) / coletor (rede+cache) / página (render).

## Fases do refactor

Cada fase termina com `npm run test && npm run check && npm run build` verde e
pode ser um PR independente.

### Fase 1 — Registro único de indicadores (mata #2, #3, #7, #10)
- `src/lib/registro.ts`: um descritor por indicador
  `{ id, nome, unidade, unidadeExibicao, fatorEscala, periodicidade, fonte, fonteUrl, licenca, casas, cacheTtl, coletar(env) }`.
- BCB, SIDRA, ONS, World Bank e derivados se registram nele.
- `api/v1/serie.ts`, `graficos.astro` e `index.astro` passam a iterar o registro.
  Ganho imediato: derivados ficam expostos na API v1.
- Coletores por fonte: `lib/coletores/bcb.ts`, `sidra.ts`, `ons.ts`, `cvm.ts`,
  `derivados.ts` (ou manter `collectors.ts` fino só com o `comFonte`).

### Fase 2 — Matar o pipeline duplicado (mata #1, #5, #8)
- `/api/indicadores.json.ts` migrado para `IndicadorExibicao` (com `atualizado_em`
  e `erros` preservados no formato de resposta).
- `montarIndicador` única em `model.ts`; deletar `ibge.ts` inteiro e
  `formatarPeriodoAnual`.
- **Atenção**: `docs/api.md` documenta o formato atual do endpoint — atualizar
  no mesmo PR.

### Fase 3 — Unidade e escala explícitas (mata #4, #6)
- Valor canônico sempre em unidade base (R$, habitantes, %), com
  `unidadeExibicao` + fator no descritor; páginas param de chamar
  `formatarBilhoes` por conta própria.
- Parsers recebem objeto tipado (sem `JSON.stringify` de ida e volta).

### Fase 4 — Testes do registro e da camada API
- Teste que garante: todo descritor tem id único, licença, fonte e fixture de
  parser correspondente (o teste quebra se alguém adicionar indicador sem
  metadados — equivalente ao "balance check" do audit-xls).
- Testes de rota com `Env` fake de KV (o padrão já existe em `tests/helpers.ts`).

### Fase 5 — Higiene (#9 + hints do astro check)
- Deletar código morto, zerar os 6 hints.

## Novo recurso: tributos básicos Brasil × EUA

Série estática (não é time series): tabelas de alíquotas vigentes, versionadas
como dados de referência com fonte citada — mesmo regime de licença/proveniência
do resto do site.

### Brasil — IRPF (Receita Federal; Lei 15.270/2025; vigência 2026)

Tabela mensal (2026 — base inalterada desde 2015 + redutores novos):

| Base de cálculo (R$/mês) | Alíquota | Dedução |
|---|---|---|
| até 2.428,80 | isenta | — |
| 2.428,81 – 2.826,65 | 7,5% | R$ 182,16 |
| 2.826,66 – 3.751,05 | 15% | R$ 394,16 |
| 3.751,06 – 4.664,68 | 22,5% | R$ 675,49 |
| acima de 4.664,68 | 27,5% | R$ 908,73 |

Redutores 2026 (Lei 15.270/2025): renda até **R$ 5.000/mês → imposto zero**;
R$ 5.000,01–7.350 → redução `R$ 978,62 − 0,133145 × renda`; acima de R$ 7.350
sem redução. Anual (declaração 2027, ano-calendário 2026): isento até
R$ 28.467,20; 7,5% / 15% / 22,5% / 27,5% com deduções R$ 2.135,04 / 4.679,03 /
8.054,97 / 10.853,78; isenção anual efetiva até R$ 60 mil.

Empresas (regime de lucro real, vigentes): **IRPJ 15%** sobre lucro + adicional
**10%** sobre a parcela do lucro anual acima de R$ 240 mil; **CSLL 9%**;
**PIS/Pasep 0,65% + Cofins 7,6%** (regime cumulativo) ou **9,25%** combinados no
regime não cumulativo. Lucros e dividendos a PF a partir de 2026: retenção de
**10%** na fonte acima de R$ 50 mil/mês por pagador (tributação mínima da alta
renda: alíquota efetiva mínima progressiva até 10% para renda anual > R$ 600 mil).

### EUA — imposto de renda federal 2026 (IRS, Revenue Procedure 2025-32)

Pessoa física, arquivante *single* (7 faixas):

| Taxable income (US$) | Rate |
|---|---|
| 0 – 12.400 | 10% |
| 12.401 – 50.400 | 12% |
| 50.401 – 105.700 | 22% |
| 105.701 – 201.775 | 24% |
| 201.776 – 256.225 | 32% |
| 256.226 – 640.600 | 35% |
| acima de 640.600 | 37% |

(Married filing jointly: 10% até 24.800; 12% até 100.800; 22% até 211.400;
24% até 403.550; 32% até 512.450; 35% até 768.700; 37% acima.)
Empresas: **corporate tax flat de 21%** (TCJA, permanente).

### Como isso entra no site

1. `src/data/impostos.json` — dataset versionado com `fonte`, `fonteUrl`,
   `licenca` e `vigencia` por tabela (mesmo formato de proveniência de
   `empresas.json`). Fontes citadas: Receita Federal/Lei 15.270/2025,
   IRS Revenue Procedure 2025-32, Tax Foundation 2026 brackets.
2. Página `/impostos` (tabelas renderizadas de um único JSON, nada hardcoded
   no template).
3. `GET /api/v1/impostos.json` servindo o mesmo dataset (contrato igual ao
   `/api/v1/serie`: fonte + licença + vigência no payload).
4. Opcional, fase seguinte: séries de receita tributária % PIB do World Bank
   já existentes (`GC.DOD...` hoje é dívida; adicionar `GC.TAX.TOTL.GD.ZS`
   receita tributária) para dar a dimensão temporal ao lado das tabelas.

## Ordem de execução sugerida

1 → 2 → 3 → 4 → 5 (fases 1–2 dão o maior ganho e destravam as demais), e o
recurso de tributos pode andar em paralelo a partir da fase 3 (não depende do
refactor, mas só deve ser mergeado depois do registro único para não nascer
fora do padrão).
