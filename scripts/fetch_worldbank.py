# Diagnóstico/coleta: World Bank Open Data API (2015-2025).
# A rede local quebra (502) em respostas maiores ou com o parâmetro page;
# coletamos por (indicador, grupo de 3 países, ano) — 3 linhas por resposta —
# e montamos [meta, linhas] reais. Salva fixtures em tests/fixtures/.
import urllib.request, json, time, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(RAIZ, "tests", "fixtures")
os.makedirs(FIX, exist_ok=True)

ISO2 = ["BR","US","JP","AR","MX","CL","DE","CN","IN","KR","PT"]
INDS = ["NY.GDP.MKTP.KD.ZG","NY.GDP.PCAP.CD","SL.UEM.TOTL.ZS","FP.CPI.TOTL.ZG","SP.POP.TOTL","GC.DOD.TOTL.GD.ZS"]
GRUPOS = [ISO2[i:i+3] for i in range(0, len(ISO2), 3)]
ANOS = [str(a) for a in range(2015, 2026)]

def baixar(ind):
    todas = []
    for g in GRUPOS:
        for ano in ANOS:
            url = f"https://api.worldbank.org/v2/country/{';'.join(g)}/indicator/{ind}?format=json&per_page=5&date={ano}"
            req = urllib.request.Request(url, headers={"User-Agent": "brasil-em-dados/0.1"})
            d = json.load(urllib.request.urlopen(req, timeout=45))
            batch = d[1] if len(d) > 1 and isinstance(d[1], list) else []
            todas.extend(batch)
            time.sleep(0.4)
    return todas

def main(max_min=90):
    t0 = time.time()
    while time.time() - t0 < max_min * 60:
        faltando = [i for i in INDS if not os.path.exists(os.path.join(FIX, f"worldbank-{i}.json"))]
        if not faltando: break
        for ind in faltando:
            try:
                todas = baixar(ind)
                assert todas, "nenhuma linha"
                iso3 = sorted({r["countryiso3code"] for r in todas})
                meta = {"page": 1, "pages": 1, "per_page": len(todas), "total": len(todas), "sourceid": "2", "countries": iso3}
                path = os.path.join(FIX, f"worldbank-{ind}.json")
                tmp = path + ".tmp"
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump([meta, todas], f, ensure_ascii=False)
                os.replace(tmp, path)
                print(f"OK {ind}: {len(todas)} linhas ({sum(1 for r in todas if r['value'] is not None)} validas)", flush=True)
            except Exception as e:
                print(f"falha {ind}: {str(e)[:80]}", flush=True)
            time.sleep(1)
    print("FALTANDO:", [i for i in INDS if not os.path.exists(os.path.join(FIX, f"worldbank-{i}.json"))] or "nenhum", flush=True)

if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 90)
