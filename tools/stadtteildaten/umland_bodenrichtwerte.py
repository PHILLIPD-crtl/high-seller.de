#!/usr/bin/env python3
"""Bodenrichtwerte der Umlandstaedte aus BORIS NRW ableiten.

Quelle: BORIS NRW, Datensatz BRW_2026_Polygon, Stichtag 01.01.2026.

Die Staedte stehen bereits als areaServed in den strukturierten Daten der
Website, hatten aber bisher keine eigene Seite.

WICHTIG - unterschiedliche Nutzungscodes je Gutachterausschuss:
Koeln differenziert die Wohnnutzung fein in WA (allgemeines Wohngebiet),
WR (reines Wohngebiet) und WB (besonderes Wohngebiet). Die Umlandstaedte
verwenden stattdessen den Sammelcode W. Wer nur auf WA/WR/WB filtert, bekommt
fuer Leverkusen und Bergisch Gladbach null Zonen, obwohl dort 378 bzw. 372
baureife Flaechen vorliegen. Deshalb deckt der Filter beide Schreibweisen ab.

Aufruf:
    python3 tools/stadtteildaten/umland_bodenrichtwerte.py
"""

import json
import statistics
import sys
from datetime import date
from pathlib import Path

import geopandas as gpd
import pandas as pd

# Gemeinden im 20-km-Radius um den Koelner Dom, bestimmt ueber die
# Zonenschwerpunkte des BORIS-Datensatzes (EPSG:25832, Dom bei 356800/5645400).
STAEDTE = ["Hürth", "Frechen", "Pulheim", "Brühl", "Wesseling",
           "Leverkusen", "Bergisch Gladbach",
           "Dormagen", "Monheim am Rhein", "Troisdorf",
           "Niederkassel", "Odenthal", "Rösrath", "Bergheim", "Langenfeld",
           "Bornheim", "Erftstadt", "Kerpen", "Leichlingen", "Burscheid",
           "Overath", "Kürten", "Lohmar",
           # 20-30 km: bewusst nur Orte des Speckguertels, KEINE eigenstaendigen
           # Grossstaedte wie Duesseldorf, Bonn, Wuppertal, Neuss, Solingen oder
           # Remscheid - dort ist ein Koelner Buero weder glaubwuerdig noch
           # konkurrenzfaehig, und schwache Seiten beschaedigen die starken.
           "Siegburg", "Sankt Augustin", "Hennef (Sieg)", "Alfter", "Swisttal",
           "Weilerswist", "Rommerskirchen", "Bedburg", "Wermelskirchen", "Hilden",
           "Lindlar", "Much", "Engelskirchen", "Wipperfürth", "Hückeswagen",
           "Zülpich", "Euskirchen", "Königswinter", "Haan", "Erkrath",
           "Grevenbroich", "Nörvenich", "Elsdorf", "Vettweiß", "Merzenich",
           "Neunkirchen-Seelscheid"]
NUTZUNGEN = ("W", "WA", "WR", "WB")

WURZEL = Path(__file__).resolve().parents[2]
ZIEL = WURZEL / "src" / "data" / "umland-bodenrichtwerte.json"
SHP = Path(__file__).resolve().parent / ".cache" / "boris" / "BRW_2026_Polygon.shp"


def main() -> int:
    if not SHP.exists():
        raise SystemExit("BORIS-Daten fehlen - zuerst bodenrichtwerte.py ausfuehren.")
    orte = ", ".join(f"'{s}'" for s in STAEDTE)
    nutz = ", ".join(f"'{n}'" for n in NUTZUNGEN)
    z = gpd.read_file(SHP, columns=["GENA", "ENTW", "NUTA", "BRW", "STAG"],
                      where=f"GENA IN ({orte}) AND ENTW = 'B' AND NUTA IN ({nutz})")
    z["BRW"] = pd.to_numeric(z["BRW"], errors="coerce")
    z = z[z["BRW"].notna()]

    stichtag = sorted(z["STAG"].dropna().unique())
    ausgabe = {}
    for stadt, gruppe in z.groupby("GENA"):
        werte = sorted(int(w) for w in gruppe["BRW"])
        ausgabe[stadt] = {
            "brw": [werte[0], werte[-1]],
            "brwMedian": int(statistics.median(werte)),
            "brwZonen": len(werte),
        }
        print(f"  {stadt:<20} {werte[0]:>5}-{werte[-1]:<5} EUR/m2  "
              f"Median {int(statistics.median(werte)):>5}  ({len(werte)} Zonen)")

    fehlt = sorted(set(STAEDTE) - set(ausgabe))
    ausgabe["_quelle"] = {
        "name": "BORIS NRW, Datensatz BRW_2026_Polygon",
        "stichtag": str(stichtag[0]) if stichtag else "unbekannt",
        "url": "https://www.boris.nrw.de/",
        "abgerufen": date.today().isoformat(),
        "methodik": (f"Wohnbauzonen (ENTW=B, Nutzung {'/'.join(NUTZUNGEN)}) je "
                     "Gemeinde. Ausgewiesen werden Spanne, Median und Zonenzahl - "
                     "amtlich gibt es keinen Einzelwert je Gemeinde."),
        "hinweis": ("Koeln differenziert WA/WR/WB, die Umlandstaedte nutzen den "
                    "Sammelcode W. Beide Schreibweisen muessen abgedeckt sein."),
        "pflege": "tools/stadtteildaten/umland_bodenrichtwerte.py",
    }
    if fehlt:
        ausgabe["_quelle"]["ohneWerte"] = fehlt

    ZIEL.write_text(json.dumps(ausgabe, ensure_ascii=False, indent=1) + "\n",
                    encoding="utf-8")
    print(f"\n{len(ausgabe)-1} Staedte nach {ZIEL.relative_to(WURZEL)}")
    if fehlt:
        print(f"  ohne Werte: {', '.join(fehlt)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
