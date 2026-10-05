# Plano de Implementação — Brasil em Dados

> Painel open source de estatísticas do Brasil: coletar, normalizar e expor
> dados públicos de fontes oficiais (governamentais e empresas listadas) para
> que qualquer pessoa avalie onde viver, investir e empreender.

## 1. Escopo (a ambição correta)

**O projeto é um motor de coleta e análise de dados, não só um site.** O site é
a vitrine; o núcleo é um pipeline open source que:

1. **Coleta** de fontes primárias (APIs, datasets abertos e relatórios oficiais),
2. **Normaliza** em um modelo único de "séries de indicadores"
   (`fonte → agregado → localidade → período → valor`),
3. **Versiona e audita** (snapshot bruto em R2 + metadados em D1),
4. **Expõe** via API pública e painel web com drill-down Brasil → estado → município.

Domínios de dados (por prioridade):

| Domínio | Indicadores | Fontes primárias |
|---|---|---|
| Demografia | população, estimativas, Censo 2022 | IBGE SIDRA (6579, Censo), localidades IBGE |
| Macroeconomia | PIB nacional/estadual/municipal, IPCA, IPCE, câmbio, Selic, expectativas (Focus) | IBGE SIDRA (5938/6784), BCB SGS (api.bcb.gov.br, ex.: 432 Selic), BCB API de Expectativas |
| Mercado de trabalho | taxa de desocupação, emprego formal (CAGED/RAIS), informalidade | IBGE PNAD Contínua (SIDRA 6381 etc.), Novo CAGED (dados abertos gov.br) |
| Energia | Balanço Energético Nacional (matriz, consumo), combustíveis, geração/carga | EPE (Relatório Síntese do BEN — PDF), ANP (bilhete/semanário de combustíveis), ONS (dados abertos), ANEEL |
| Empresas e balanços | balanços de listadas (Petrobras, bancos…), indicadores | CVM open data (dados.cvm.gov.br — DFP/ITR, empresas listadas) |
| Finanças públicas | orçamento municipal/estadual (FINBRA/Siconfi), transferências | Tesouro Nacional (Siconfi/apidatalake) |
| Mercados financeiros | curva de juros (DI), Ibovespa, volume B3 | BCB (curvas), B3 (dados públicos — **ver seção licenças**) |
| Crédito e bancos | taxas de crédito, inadimplência, balanços bancários | BCB SGS + relatórios (Relatório de Crédito, Balancetes) |

**Fora do escopo inicial (plugins futuros):** dados pagos/licenciados
(Serasa/Experian, Datafolha, MarketPay) — arquitetura de *data providers*
plugáveis com chaves do próprio usuário, nunca embutir no projeto.

## 2. Solução de problemas (os 4 grandes riscos)

### 2.1 Heterogeneidade das fontes (APIs JSON × PDFs × FTP)
- Camada de **adapters**: cada fonte tem um módulo `collectors/<fonte>.ts`
  que produz o modelo canônico. API boa (IBGE/BCB/CVM) = coletor HTTP.
- **Relatórios em PDF** (EPE/BEN, boletins): parser dedicado executado por
  script agendado (fora do Workers, rodando local/CI via GitHub Actions),
  com o resultado publicado como JSON normalizado no repositório/commit —
  o "relatório de referência" fica versionado em git e auditável.
- Regra de ouro: **nenhum número entra no site sem metadado de fonte, URL,
  data de coleta e período de referência**.

### 2.2 Sobrecarga das fontes públicas / rate limit
- Coleta **agendada** (Cron Triggers do Workers / GitHub Actions cron), nunca
  por visita. Frequência por tipo: diários 1×/dia; mensais 1×/dia; anuais 1×/semana.
- KV como cache de leitura para a API do site (já implementado na home).
- Raw snapshot em **R2** (parquet/JSON) → nunca re-coletar histórico; a coleta
  é incremental por período.

### 2.3 Dados defasados e "tempo real" honesto
- O site exibe sempre **período de referência + data de coleta**, nunca "ao vivo"
  quando o dado é mensal/anual. Componente "atualizado em X, referência Y".
- Falha de coleta ≠ zero: indicador fica "última coleta válida", com badge de idade.

### 2.4 Licenças de dados (crítico em open source)
- **Verde** (uso livre com atribuição): IBGE, BCB, Tesouro/Siconfi, PNAD/CAGED,
  CVM open data, ONS, ANP.
- **Amarelo** (uso com restrições/registro): relatórios EPE (reproduzir
  números-síntese com citação explícita, não re-hospedar o PDF).
- **Vermelho** (não usar): datasets B3 e provedores privados sem licença —
  a B3 exige licença para redistribuição; usar apenas dados derivados
  (ex.: curva DI via BCB) ou planejar acordo. Tabela de licenças mantida em
  `docs/fontes.md` com status por fonte.

## 3. Arquitetura alvo

```
[Collectors]  cron (Workers Cron + GitHub Actions p/ PDFs)
    ↓ normalização (modelo canônico de séries)
[D1] séries/indicadores + metadados · [R2] snapshots brutos · [KV] cache de leitura
    ↓
[API pública /api/v1/*]  (versionada, docs OpenAPI, sem chave)
    ↓
[Astro SSR + islands]  painel, drill-down N1→N2→N6, scorecards
```

- **modelo canônico**: `indicador(id, nome, unidade, fonte_id, agregado_sidra, periodicidade, licenca)` e `observacao(indicador_id, localidade_id, periodo, valor, coletado_em)`.
- **localidade**: tabela única com códigos IBGE (N1 Brasil, N2 UF, N6 município) — resolve o drill-down.
- **scorecards**: índices compostos com metodologia versionada (arquivo no repo + página explicando a fórmula); peso aberto e debatido em issues.

## 4. Fases

- **F1 (feito)** — Home com população e IPCA 12m (IBGE), cache KV, API JSON pública.
- **F2** — Modelo canônico + D1 + collectors BCB SGS (Selic, câmbio, Focus) e PNAD Contínua (desocupação, informalidade). Drill-down por UF.
- **F3** — PIB estadual/municipal (SIDRA 5938) + CAGED/RAIS (emprego formal) + FINBRA/Siconfi (finanças públicas). Scorecard regional v1.
- **F4** — Energia: parser do BEN (EPE) via GitHub Actions, ANP combustíveis, ONS geração/carga.
- **F5** — Balanços de listadas via CVM open data (Petrobras, bancos: P/L, receita, lucro, endividamento) + relatórios BCB (crédito, inadimplência).
- **F6** — B3/mercados: curva de juros (BCB), decisões de licença da B3 documentadas; brapi.dev como proxy comunitário opcional.
- **F7** — API v1 pública + OpenAPI + export CSV/Parquet + i18n (EN/ES).

Cada fase só mergeia na `main` com: coleção testada (curl real), `astro check` +
build verdes, e dado conferido contra a fonte original.

## 5. Possíveis melhorias (backlog)

- Comparação de municípios lado a lado ("vale a pena morar/investir").
- Alertas/assinatura (e-mail/RSS quando indicador muda).
- Widgets embedáveis (iframe/JS) para reuso dos painéis.
- Comunidade: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issues de "good first issue" para novos coletores (1 fonte = 1 PR = 1 coleção testada).
- Export de datasets completos (dump D1 → Parquet em R2) p/ ciência de dados.
- Histórico "machine-readable" do próprio site (série de coletas).

## 6. Definição de pronto (por fase)

1. Indicadores visíveis no painel com fonte, referência e data de coleta.
2. Coletor roda de ponta a ponta (cron ou script) e é idempotente.
3. Snapshot bruto persistido antes da normalização.
4. Verificação manual contra a fonte original (curl/SIDRA) documentada no PR.
