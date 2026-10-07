# Fontes de dados e licenças

Cada fonte primária tem um semáforo de licença e um status de implementação.
**Verde** = uso livre com atribuição · **Amarelo** = uso com restrições/citação ·
**Vermelho** = não usar (licença exigida para redistribuição).

## Tabela de fontes

| Fonte | Dados | Licença | Coletor | Status |
|---|---|---|---|---|
| IBGE SIDRA / apisidra | população (6579/9324), IPCA 12m (1737/2265), desocupação (6381, 4562 UF), informalidade (4708), PIB UF/município (5938 var 37/496) | Verde (uso livre com atribuição) | `src/lib/coletores/` | ✅ ativo |
| BCB SGS (`api.bcb.gov.br`) | Selic meta diária (1178), câmbio PTAX compra (1), IPCA mensal (433) | Verde | `src/lib/coletores/` | ✅ ativo |
| ONS — Dados Abertos | Carga mensal de energia por subsistema (`CARGA_MENSAL.csv`, CC-BY) | Verde (CC-BY) | `src/lib/coletores/` | ✅ ativo |
| World Bank Open Data (API v2) | PIB crescimento real, PIB per capita, desemprego ILO, inflação IPC, população, dívida gov. central — BR/US/JP/AR/MX/CL/DE/CN/IN/KR/PT (2000–2025) | Verde (CC-BY 4.0, atribuição) | `src/lib/worldbank.ts` + `src/lib/parsers-worldbank.ts` | ✅ ativo (comparadores internacionais, `/paises`, `/scorecards`) |
| CVM — Dados Abertos | DFP zip anual → DRE consolidada (receita, lucro) de 15 listadas (PETR4, VALE3, ITUB4, BBDC4, BBAS3, ABEV3, WEGE3, JBSS3, SUZB3, BRFS3, NTCO3, MGLU3, GGBR4, RENT3, B3SA3) | Verde (open data; redistribuímos apenas números-síntese com citação) | `src/lib/coletores/` | ✅ ativo |
| ANEEL — Dados Abertos | tarifas homologadas das distribuidoras (TE+TUSD por classe/subgrupo, semanal desde 2010) → tarifa por UF residencial/comercial/industrial | Verde (ODbL) | `scripts/generate-tarifas.ts` → `src/data/tarifas-uf.json` | ✅ ativo (dataset estático; página `/datacenters`, `/estado/[sigla]` e `/api/v1/datacenters.json`) |
| CONFAZ — Boletim de Arrecadação dos Tributos Estaduais (SIGDEF) | ICMS arrecadado por UF/mês (1997→2025-08) | Verde (CC-BY via dados.gov.br) | `scripts/generate_icms.py` → `src/data/icms-uf.json` | ✅ ativo com **lacuna documentada**: portal dados.gov.br exige autenticação gov.br para API desde 2026; último boletim com acesso direto ao XLS no site do CONFAZ: `20250812.xls` (extração 19/09/2025, "com pendências"); meses seguintes exibidos como "—" |
| EPE — Balanço Energético Nacional (BEN) | matriz energética, consumo | Amarelo (reproduzir apenas números-síntese com citação explícita; não re-hospedar o PDF) | — | ⏳ pendente (parser de PDF planejado para rodar fora do Workers, via CI) |
| ANP — bilhete/semanário de combustíveis | preços de combustíveis | Verde | — | ⏳ pendente |
| Tesouro — Siconfi (`apidatalake.tesouro.gov.br`) | FINBRA/orçamento municipal | Verde | — | ❌ pendente: API respondeu **404** nos testes (out/2026); monitorar retorno da API |
| Novo CAGED / RAIS (gov.br) | emprego formal, vínculos | Verde | — | ❌ pendente: API/dados abertos do CAGED indisponíveis na rede de testes (`apicaged.mte.gov.br` não resolveu DNS); downloads completos são pesados (milhares de arquivos .7z) — coletor a implementar em fase futura |
| B3 (curva DI, Ibovespa, volume) | juros futuros | **Vermelho** — a B3 exige licença para redistribuição de seus datasets | — | ⛔ **decisão: não implementar coletor direto.** Substitutos sem custo licenciatório: Selic/PTAX via BCB SGS (verdes). A curva DI (DI1) só poderia entrar via acordo de licença ou proxy comunitário (brapi.dev) opcional configurado pelo próprio usuário — nunca embutida no projeto |
| brapi.dev | cotações/indicadores de listadas | Amarelo (termos próprios) | — | ⏳ opcional, documentado mas não embutido (exige chave do usuário no futuro) |

## Detalhes técnicos das fontes ativas

### BCB SGS
- Endpoint: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.<n>/dados?formato=json&dataInicial=dd/mm/yyyy&dataFinal=dd/mm/yyyy`
- **Pitfall:** `ultimos/N` só aceita N ≤ 10 ("A quantidade máxima de valores..."); use consulta por intervalo de datas.
- Valores com ponto decimal ("13.75"); datas `dd/mm/yyyy`.

### IBGE SIDRA
- A API v3 (`servicodados.ibge.gov.br/api/v3/...`) fica instável (500/502 esparsos) e algumas tabelas não aceitam `N2[all]`; usamos o endpoint **apisidra** (`https://apisidra.ibge.gov.br/values/...`) para as novas séries:
  - UF em apisidra é `n3` (N3 = Unidade da Federação; `n2` = Grande Região).
  - A primeira linha da resposta é o cabeçalho (nomes das colunas).
  - Valores ausentes vêm como `-`, `..` ou vazio — descartados.
- Tabelas: 6381 (desocupação Brasil, só N1, trimestral móvel — codificada como `YYYYMM`), 4562 (desocupação média anual por UF), 4708 var 12466 (informalidade, anual), 5938 var 37 (PIB corrente, Mil Reais; UF e município), var 496 (participação no PIB do Brasil — a var 553 "microrregião" retorna tudo `-`).

### ONS
- CSV real em `https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/carga_energia_me/CARGA_MENSAL.csv`, delimitador `;`, codificação UTF-8.
- Meses incompletos vêm com valor `0E-8` → filtrados (só valores > 0).

### CVM
- Zip anual: `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/Dados/dfp_cia_aberta_<ano>.zip`
- O zip do ano corrente contém apenas envios parciais; o coletor usa `dfp_cia_aberta_2025.zip` (exercícios 2024/2025 completos).
- CSV DRE consolidado com `;` e codificação latin-1; filtro por CNPJ; `ORDEM_EXERC` `ÚLTIMO` > `PENÚLTIMO`; escala `MIL` → valores multiplicados por 1000.
- Coleta em BUILD (`scripts/generate-empresas.ts` → `src/data/empresas.json` versionado): o zip excedia o limite de CPU do Workers em produção (error 1102).

### World Bank Open Data (API v2)
- Endpoint: `https://api.worldbank.org/v2/country/BR;US;JP;AR;MX;CL;DE;CN;IN;KR;PT/indicator/<codigo>?format=json&per_page=500&date=2000:2025`
- Uma chamada por indicador cobre os 11 países; resposta `[meta, linhas]` com `countryiso3code`, `date` (ano) e `value` (`null` = sem dado — descartado, nunca zero).
- Indicadores: `NY.GDP.MKTP.KD.ZG` (crescimento real), `NY.GDP.PCAP.CD` (PIB per capita), `SL.UEM.TOTL.ZS` (desemprego ILO), `FP.CPI.TOTL.ZG` (inflação IPC), `SP.POP.TOTL` (população), `GC.DOD.TOTL.GD.ZS` (dívida gov. central — cobertura esparse: nem todo país publica).
- Fixtures reais em `tests/fixtures/worldbank-<codigo>.json`. Licença CC-BY 4.0.

### CVM
- Catálogo com 15 listadas; CNPJs conferidos contra `CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv` (situação ATIVO), out/2026.
- Lucro consolidado do período: conta **3.11** no DRE corporativo e **3.09** no DRE de bancos/intermediação (Itaú, Bradesco, BB usam layout próprio — conf. DFP 2025).
- Ranking de UFs (`getRankingUf`): consultas únicas `n3/all` (5938/37, 5938/496, 4562/4099, 4708/12466, 6579/9324) — 27/27 UFs com valor, validado out/2026. PIB per capita derivado (PIB do ano ÷ população do mesmo ano; anos diferentes → indisponível).

### ANEEL — Tarifas homologadas (`/datacenters`)
- Dataset: `https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica` (CSV ~85 MiB, `;`, decimal `,`, ODbL, atualização semanal).
- O CSV **não tem coluna de UF**: o mapeamento distribuidora→UF é feito pelo CNPJ —
  recurso INDGER da ANEEL (`indger-dados-comerciais.csv`, `CodMunicipioIBGE` → 2 primeiros
  dígitos = código UF IBGE; maior contagem de municípios por CNPJ) e, para 12 CNPJs ausentes,
  consulta pública do CNPJ (cnpj.ws), verificada manualmente.
- Seleção (evitar inventar): `DscBaseTarifaria='Tarifa de Aplicação'`, bloco de vigência mais
  recente por CNPJ, `DscDetalhe='Não se aplica'` (linhas `SCEE` são crédito solar com TE
  negativa — não são a tarifa). B1 exige `DscSubClasse='Residencial'` (senão pega baixa renda/tarifa
  social). A4: modalidade **Verde, fora ponta, MWh** — componente de energia; a demanda é
  R$/kW (outra linha, não comparável em R$/kWh). Tarifa = (TE+TUSD)/1000.
- Armadilha de escala: B/A4 vêm em R$/MWh e A4 demanda em R$/kW — dividir por 1000 só a energia.

### CONFAZ/SIGDEF — Boletim de Arrecadação (`/datacenters`)
- Planilha mensal `https://www.confaz.fazenda.gov.br/<ddmmaaaa>.xls` (ex.: `20250812.xls`).
- XLS legado (OLE2) com 3 planilhas: `uf` (dimensão), `arrecadacao POR SETOR` (UF×mês,
  colunas por setor) e `arrecadação por CNAE`. **Coluna do ICMS é a 22 (`va_icms_total`)**;
  a coluna 23 é IPVA. Componentes por setor (col 6-21) somam mais que o total — o total
  é o valor declarado pela UF, use-o.
- Dados "com pendências": cada UF reporta com defasagem diferente (no arquivo de
  set/2025, último mês por UF variou de 2023-12 a 2025-08). Por isso o dataset carrega
  `ultimoMes` por UF e o ano calendário **completo** mais recente (12 meses com valor).
- Lacuna: API do dados.gov.br (CKAN) passou a exigir Bearer (perfil consumidor gov.br) —
  monitorar; novo boletim = rodar `scripts/generate_icms.py <arquivo.xls>`.

### Reforma tributária IBS/CBS e m² FipeZap (`/datacenters`)
- IBS/CBS: estático `src/data/reforma-tributaria.json` (LC 214/2025; fonte: Receita Federal).
  Não há alíquota por estado — IBS é uniforme; o dataset é timeline legal 2026→2033.
- m² médio (FipeZap+): publicação mensal em PDF, sem API/CSV — coluna oficialmente
  indisponível ("—") até existir extração confiável. Backlog: temperatura INMET, backhaul Anatel.

## Decisões de armazenamento e coleta
- **KV como store das séries normalizadas** (cache-aside com TTL por indicador) em vez de D1/R2: coleta por request, volume pequeno, stack já existente do F1. Migração para D1 (histórico consultável, agregações) e R2 (snapshots brutos parquet) fica documentada como evolução — o modelo canônico (`Observacao`) já é compatível.
- **Cron de coleta** (Workers Cron Triggers / GitHub Actions) é fase futura: hoje a coleta é por request com cache; o KV mantém as fontes públicas longe de sobrecarga (TTLs: 6h diárias, 12h mensais, 24h anuais/zip).
- Regra dura: **nenhum número inventado**. Fonte fora do ar → indicador exibido como indisponível com o motivo (nunca zero).
