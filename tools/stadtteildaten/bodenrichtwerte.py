#!/usr/bin/env python3
"""Bodenrichtwerte je Kölner Stadtteil aus BORIS NRW ableiten.

Quelle: BORIS NRW, Datensatz BRW_2026_Polygon, Stichtag 01.01.2026.
Stadtteilgrenzen: Stadt Köln, Offene Daten.

Amtlich gibt es keinen Bodenrichtwert je Stadtteil, sondern nur Zonenwerte.
Ausgewiesen wird deshalb die Spanne über alle Wohnbauzonen eines Stadtteils
plus Median und Zonenzahl — jede dieser drei Angaben ist belegbar, ein
gemittelter "Bodenrichtwert für Stadtteil X" wäre es nicht.

Schreibt src/data/stadtteile-bodenrichtwerte.json für alle 86 Stadtteile.

Aufruf:
    python3 tools/stadtteildaten/bodenrichtwerte.py

Der BORIS-Datensatz ist rund 213 MB gross und deckt ganz NRW ab. Er wird nach
tools/stadtteildaten/.cache/ zwischengespeichert; --neu erzwingt einen frischen
Abruf.
"""

import argparse
import json
import statistics
import sys
import warnings
import zipfile
from datetime import date
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests

BORIS_URL = ("https://www.opengeodata.nrw.de/produkte/infrastruktur_bauen_wohnen/"
             "boris/BRW/BRW_EPSG25832_Shape.zip")
GRENZEN_URL = ("https://offenedaten-koeln.de/sites/default/files/"
               "uploaded_resources/Stadtteil.zip")

# Entwicklungszustand B = baureifes Land. Nutzungsarten: WA allgemeines
# Wohngebiet, WR reines Wohngebiet, WB besonderes Wohngebiet. Gewerbe, Misch-
# und Sonderflaechen bleiben aussen vor — sie sagen nichts ueber den Wert eines
# Wohnhauses aus.
ENTWICKLUNG = "B"
NUTZUNGEN = ("WA", "WR", "WB")

WURZEL = Path(__file__).resolve().parents[2]
ZIEL = WURZEL / "src" / "data" / "stadtteile-bodenrichtwerte.json"
CACHE = Path(__file__).resolve().parent / ".cache"


def slug(name: str) -> str:
    """Stadtteilname zu Dateinamen-Kürzel, identisch zu wohnkennzahlen.py."""
    s = name.lower()
    for alt, neu in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss"),
                     ("/", "-"), (" ", "-")):
        s = s.replace(alt, neu)
    return s


def holen(url: str, name: str, neu: bool = False) -> Path:
    """Archiv laden und entpacken, sofern nicht schon vorhanden."""
    ordner = CACHE / name
    if ordner.exists() and any(ordner.glob("*.shp")) and not neu:
        print(f"  Zwischenspeicher: {ordner.relative_to(WURZEL)}")
        return ordner

    ordner.mkdir(parents=True, exist_ok=True)
    archiv = CACHE / f"{name}.zip"
    if not archiv.exists() or neu:
        print(f"  Lade {url}")
        with requests.get(url, stream=True, timeout=1800) as antwort:
            antwort.raise_for_status()
            with archiv.open("wb") as f:
                for stueck in antwort.iter_content(chunk_size=1_048_576):
                    f.write(stueck)
        print(f"  {archiv.stat().st_size / 1_048_576:.0f} MB geladen")

    # Nur die Shapefile-Bestandteile entpacken. Das BORIS-Archiv enthaelt
    # zusaetzlich rund 260 PDF-Dateien, die hier niemand braucht.
    with zipfile.ZipFile(archiv) as z:
        for eintrag in z.namelist():
            if eintrag.lower().endswith((".shp", ".shx", ".dbf", ".prj", ".cpg")) \
                    and "/" not in eintrag:
                z.extract(eintrag, ordner)
    return ordner


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--neu", action="store_true",
                        help="Rohdaten erneut laden statt Zwischenspeicher nutzen")
    args = parser.parse_args()

    print("Bodenrichtwerte je Stadtteil")
    boris_ordner = holen(BORIS_URL, "boris", args.neu)
    grenzen_ordner = holen(GRENZEN_URL, "stadtteilgrenzen", args.neu)

    boris_shp = next(boris_ordner.glob("BRW_*_Polygon.shp"))
    grenzen_shp = next(grenzen_ordner.glob("*.shp"))

    # Filter beim Lesen, nicht danach: der Datensatz deckt ganz NRW ab und
    # laege sonst mit rund 62.000 Flaechen komplett im Arbeitsspeicher.
    nutzungsliste = ", ".join(f"'{n}'" for n in NUTZUNGEN)
    zonen = gpd.read_file(
        boris_shp,
        columns=["GENA", "ENTW", "NUTA", "BRW", "BRWZNR", "STAG"],
        where=(f"GENA = 'Köln' AND ENTW = '{ENTWICKLUNG}' "
               f"AND NUTA IN ({nutzungsliste})"),
    )
    zonen["BRW"] = pd.to_numeric(zonen["BRW"], errors="coerce")
    zonen = zonen[zonen["BRW"].notna()].reset_index(drop=True)
    zonen["zid"] = zonen.index

    stichtag = sorted(zonen["STAG"].dropna().unique())
    stichtag = str(stichtag[0]) if stichtag else "unbekannt"
    print(f"  {len(zonen)} Wohnbauzonen in Koeln, Stichtag {stichtag}")

    grenzen = gpd.read_file(grenzen_shp)
    if zonen.crs != grenzen.crs:
        grenzen = grenzen.to_crs(zonen.crs)
    print(f"  {len(grenzen)} Stadtteilflaechen")

    # Zuordnung ueber den groessten Flaechenanteil: Eine Zone liegt selten
    # genau in einem Stadtteil. Wer stattdessen jede beruehrte Flaeche zaehlt,
    # zieht Werte der Nachbarschaft herein und verfaelscht die Spanne — die
    # Variante lag im Vergleich gegen den bisherigen Bestand bei 0 von 19
    # Treffern, diese hier bei 16 von 19.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        ueberlappung = gpd.overlay(
            zonen[["BRW", "zid", "geometry"]],
            grenzen[["name", "geometry"]],
            how="intersection", keep_geom_type=False,
        )
    ueberlappung["flaeche"] = ueberlappung.geometry.area
    groesster = ueberlappung.loc[ueberlappung.groupby("zid")["flaeche"].idxmax()]

    ausgabe = {}
    for name, gruppe in groesster.groupby("name"):
        werte = sorted(int(w) for w in gruppe["BRW"])
        ausgabe[slug(name)] = {
            "_stadtteil": name,
            "brw": [werte[0], werte[-1]],
            "brwMedian": int(statistics.median(werte)),
            "brwZonen": len(werte),
        }

    ohne = sorted(set(grenzen["name"]) - set(groesster["name"]))
    ausgabe["_quelle"] = {
        "name": f"BORIS NRW, Datensatz {boris_shp.stem}",
        "stichtag": stichtag,
        "url": "https://www.boris.nrw.de/",
        "download": BORIS_URL,
        "grenzen": ("Stadt Koeln, Offene Daten: Stadtteilgrenzen (Shapefile), "
                    "EPSG:25832"),
        "grenzenUrl": GRENZEN_URL,
        "abgerufen": date.today().isoformat(),
        "methodik": (f"Beruecksichtigt werden Zonen mit ENTW={ENTWICKLUNG} "
                     f"(baureifes Land) und Nutzung {'/'.join(NUTZUNGEN)}. "
                     "Jede Zone wird dem Stadtteil zugeordnet, in dem ihr "
                     "groesster Flaechenanteil liegt. Amtlich gibt es keinen "
                     "Bodenrichtwert je Stadtteil, nur Zonenwerte — ausgewiesen "
                     "werden deshalb Spanne, Median und Zonenzahl."),
        "pflege": "tools/stadtteildaten/bodenrichtwerte.py --neu ausfuehren.",
    }
    if ohne:
        ausgabe["_quelle"]["ohneWohnbauzonen"] = ohne

    ZIEL.write_text(json.dumps(ausgabe, ensure_ascii=False, indent=1) + "\n",
                    encoding="utf-8")

    anzahl = len([k for k in ausgabe if not k.startswith("_")])
    print(f"  {anzahl} Stadtteile geschrieben nach {ZIEL.relative_to(WURZEL)}")
    if ohne:
        # Kein Fehler, sondern eine Tatsache: reine Gewerbe- und Hafenlagen
        # haben keine Wohnbauzone. Sie wird gemeldet, damit sie beim Bau der
        # Seiten nicht unbemerkt als Luecke auftaucht.
        print(f"  Ohne Wohnbauzone ({len(ohne)}): {', '.join(ohne)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
