#!/usr/bin/env python
"""Gera src/data/icms-uf.json a partir do Boletim CONFAZ de Arrecadação dos
Tributos Estaduais (SIGDEF), planilha mensal XLS publicada pelo CONFAZ.

Fonte: https://www.confaz.fazenda.gov.br/boletim-de-arrecadacao-dos-tributos-estaduais
Arquivo mensal no formato https://www.confaz.fazenda.gov.br/<ddmmaaaa>.xls
(último verificado com acesso direto: 20250812.xls — extração 19/09/2025;
dados de 01/1997 a 08/2025 "com pendências", e o portal dados.gov.br passou a
exigir autenticação gov.br para a API — lacuna documentada em docs/fontes.md).

Uso:
  1. curl -o /tmp/boletim.xls https://www.confaz.fazenda.gov.br/20250812.xls
  2. pip install xlrd
  3. python scripts/generate_icms.py /tmp/boletim.xls

Metodologia: por UF usa-se a última referência mensal com va_icms_total > 0
(no arquivo, UFs reportam com defasagens diferentes) e o somatório do ano
calendário completo mais recente (12 meses com valor) como "ICMS anual".
Nada é inventado: UF sem valor fica sem valor.
"""
import sys
import json
from collections import defaultdict
from pathlib import Path

import xlrd

UF_SIGLAS = {
    "RO": "RO", "AC": "AC", "AM": "AM", "RR": "RR", "PA": "PA", "AP": "AP",
    "TO": "TO", "MA": "MA", "PI": "PI", "CE": "CE", "RN": "RN", "PB": "PB",
    "PE": "PE", "AL": "AL", "SE": "SE", "BA": "BA", "MG": "MG", "ES": "ES",
    "RJ": "RJ", "SP": "SP", "PR": "PR", "SC": "SC", "RS": "RS", "MS": "MS",
    "MT": "MT", "GO": "GO", "DF": "DF",
}

NOMES = {
    "RO": "Rondônia", "AC": "Acre", "AM": "Amazonas", "RR": "Roraima",
    "PA": "Pará", "AP": "Amapá", "TO": "Tocantins", "MA": "Maranhão",
    "PI": "Piauí", "CE": "Ceará", "RN": "Rio Grande do Norte", "PB": "Paraíba",
    "PE": "Pernambuco", "AL": "Alagoas", "SE": "Sergipe", "BA": "Bahia",
    "MG": "Minas Gerais", "ES": "Espírito Santo", "RJ": "Rio de Janeiro",
    "SP": "São Paulo", "PR": "Paraná", "SC": "Santa Catarina",
    "RS": "Rio Grande do Sul", "MS": "Mato Grosso do Sul", "MT": "Mato Grosso",
    "GO": "Goiás", "DF": "Distrito Federal",
}


def main() -> None:
    if len(sys.argv) != 2:
        print("uso: generate_icms.py <boletim.xls>")
        sys.exit(1)
    wb = xlrd.open_workbook(sys.argv[1])
    sh = wb.sheet_by_name("arrecadacao POR SETOR")

    serie: dict[str, dict[int, float]] = defaultdict(dict)  # uf -> periodo -> R$
    for r in range(2, sh.nrows):
        p = sh.cell_value(r, 2)
        uf = sh.cell_value(r, 1)
        v = sh.cell_value(r, 22)  # va_icms_total
        if isinstance(p, float) and isinstance(v, float) and v > 0 and uf in UF_SIGLAS:
            serie[uf][int(p)] = float(v)

    ufs: dict[str, dict] = {}
    for uf, valores in serie.items():
        if not valores:
            continue
        ultimo = max(valores)
        ano = ultimo // 100
        # ano calendário completo mais recente (12 meses com valor)
        anos_completos = sorted(
            (a for a in set(p // 100 for p in valores)
             if all((a * 100 + m) in valores for m in range(1, 13))),
            reverse=True,
        )
        ano_base = anos_completos[0] if anos_completos else None
        anual = sum(valores[ano_base * 100 + m] for m in range(1, 13)) if ano_base is not None else None
        ufs[uf] = {
            "sigla": uf,
            "nome": NOMES[uf],
            "ultimoMes": f"{ano}-{ultimo % 100:02d}",
            "icmsUltimoMes": round(valores[ultimo], 2),
            "anoBase": ano_base,
            "icmsAnoBase": round(anual, 2) if anual is not None else None,
            "nMesesAnoBase": 12 if ano_base else None,
        }

    dataset = {
        "fonte": "CONFAZ/SIGDEF — Boletim de Arrecadação dos Tributos Estaduais (ICMS)",
        "fonteUrl": "https://www.confaz.fazenda.gov.br/boletim-de-arrecadacao-dos-tributos-estaduais",
        "licenca": "Creative Commons Attribution (dados.gov.br)",
        "unidade": "R$",
        "metodologia": (
            "Planilha mensal SIGDEF do CONFAZ. Por UF: último mês com va_icms_total > 0 "
            "(as UFs reportam com defasagens distintas — o arquivo traz 'pendências') e "
            "somatório do ano calendário completo mais recente (12 meses com valor). "
            "Meses sem valor na fonte ficam fora; UF sem valor fica sem valor."
        ),
        "extracaoArquivo": None,
        "ufsWithoutData": sorted(set(UF_SIGLAS) - set(ufs)),
        "ufs": dict(sorted(ufs.items())),
    }

    # data de extração escrita no cabeçalho da planilha (linha 0, col 0)
    cab = sh.cell_value(0, 0)
    if isinstance(cab, str) and "Extração" in cab:
        dataset["extracaoArquivo"] = cab.split("\n")[0].strip()

    saida = Path(__file__).resolve().parent.parent / "src" / "data" / "icms-uf.json"
    saida.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"UFs com dados: {len(ufs)}; sem dados: {dataset['ufsWithoutData']}")
    for uf in sorted(ufs):
        u = ufs[uf]
        print(uf, u["ultimoMes"], f"{u['icmsUltimoMes']/1e9:.3f} bi/mês",
              u["anoBase"], f"{(u['icmsAnoBase'] or 0)/1e9:.1f} bi/ano")


if __name__ == "__main__":
    main()