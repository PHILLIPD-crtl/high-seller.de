#!/usr/bin/env python3
"""Kaufpreise für Eigentumswohnungen je Kölner Stadtteil aus dem
Grundstücksmarktbericht des Gutachterausschusses ziehen.

Quelle: Grundstücksmarktbericht 2026 für die Stadt Köln.
Es sind notarielle Kaufpreise, keine Angebotspreise — der Unterschied ist der
Grund, warum diese Zahlen auf der Website belastbar sind.

Ausgewiesen wird das arithmetische Mittel in Euro je m² Wohnfläche, getrennt
nach Neubau, Weiterverkauf (Bestand) und Umwandlung, jeweils mit Fallzahl.
Der Bericht führt nur Stadtteile mit mindestens drei auswertbaren Verträgen.

Schreibt src/data/stadtteile-kaufpreise.json.

Aufruf:
    python3 tools/stadtteildaten/kaufpreise.py
"""

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

import geopandas as gpd
import pdfplumber
import requests

PDF_URL = "https://www.gars.nrw/images/user/GA_K%C3%B6ln/GMB2026_Digitalversion.pdf"

# Der Bericht enthält zwei Preistabellen-Blöcke: einen für Häuser (mit Spalte
# Grundstücksfläche) und einen für Eigentumswohnungen (ohne). Gebraucht wird der
# Wohnungsblock. Erkannt wird er am fehlenden Wort "Grundstücks-", die
# Seitenzahlen wandern von Jahrgang zu Jahrgang.
KATEGORIEN = ("Neubau", "Weiterverkauf", "Umwandlung")

# Mittelwertzeile: Kaufpreis, Baujahr, Wohnfläche, Euro je m². Die letzte Zahl
# ist der gesuchte Wert. Die darauffolgende Zeile enthält die Spannen und wird
# bewusst übergangen — Spannen stehen im Bericht, gehören aber nicht auf die
# Seite.
MITTELWERT = re.compile(r"^[\d.]+\s+\d{4}\s+\d+\s+[\d.]+$")
KATEGORIEZEILE = re.compile(r"^▮\s*(" + "|".join(KATEGORIEN) + r")\s+(\d+)$")

WURZEL = Path(__file__).resolve().parents[2]
ZIEL = WURZEL / "src" / "data" / "stadtteile-kaufpreise.json"
CACHE = Path(__file__).resolve().parent / ".cache"
GRENZEN = CACHE / "stadtteilgrenzen"


def slug(name: str) -> str:
    """Stadtteilname zu Dateinamen-Kürzel, identisch zu den übrigen Skripten."""
    s = name.lower()
    for alt, neu in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss"),
                     ("/", "-"), (" ", "-")):
        s = s.replace(alt, neu)
    return s


def pdf_laden(neu: bool = False) -> Path:
    pfad = CACHE / "grundstuecksmarktbericht.pdf"
    if pfad.exists() and not neu:
        print(f"  Zwischenspeicher: {pfad.relative_to(WURZEL)}")
        return pfad
    pfad.parent.mkdir(parents=True, exist_ok=True)
    print(f"  Lade {PDF_URL}")
    antwort = requests.get(PDF_URL, timeout=600)
    antwort.raise_for_status()
    pfad.write_bytes(antwort.content)
    print(f"  {len(antwort.content) / 1_048_576:.1f} MB geladen")
    return pfad


def wohnungsseiten(pdf) -> list[int]:
    """Seitenzahlen des Wohnungsblocks (1-basiert).

    Der Blockanfang wird über die Bezirksüberschrift gefunden; Folgeseiten
    tragen keine eigene Überschrift und werden bis zur nächsten Überschrift
    fremder Art mitgenommen.
    """
    start = ende = None
    for i, seite in enumerate(pdf.pages, 1):
        t = seite.extract_text() or ""
        if "Preistabelle Stadtbezirk" not in t:
            continue
        if "Grundstücks-" in t:
            continue
        if start is None:
            start = i
        ende = i
    if start is None:
        raise SystemExit("Wohnungsblock im Bericht nicht gefunden — Aufbau geaendert?")
    # Der letzte Bezirk belegt ebenfalls Folgeseiten; großzügig zwei dazu und
    # auf bekannte Stadtteilnamen abgleichen, statt eine feste Zahl zu raten.
    return list(range(start, min(ende + 3, len(pdf.pages)) + 1))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--neu", action="store_true",
                        help="Bericht erneut laden statt Zwischenspeicher nutzen")
    args = parser.parse_args()

    print("Kaufpreise je Stadtteil")

    grenzen_shp = next(GRENZEN.glob("*.shp"), None)
    if grenzen_shp is None:
        raise SystemExit("Stadtteilgrenzen fehlen — zuerst bodenrichtwerte.py ausfuehren.")
    namen = set(gpd.read_file(grenzen_shp)["name"])

    pfad = pdf_laden(args.neu)
    daten: dict[str, dict] = {}

    with pdfplumber.open(pfad) as pdf:
        seiten = wohnungsseiten(pdf)
        print(f"  Wohnungsblock: Seiten {seiten[0]}-{seiten[-1]}")
        for nummer in seiten:
            zeilen = [z.strip() for z in (pdf.pages[nummer - 1].extract_text() or "").split("\n")]
            stadtteil = None
            mittelwerte = None
            for zeile in zeilen:
                if zeile in namen:
                    stadtteil = zeile
                    daten.setdefault(stadtteil, {})
                    mittelwerte = None
                    continue
                if MITTELWERT.match(zeile):
                    mittelwerte = zeile
                    continue
                treffer = KATEGORIEZEILE.match(zeile)
                if treffer and stadtteil and mittelwerte:
                    kategorie, faelle = treffer.group(1), int(treffer.group(2))
                    euro = int(mittelwerte.split()[-1].replace(".", ""))
                    daten[stadtteil][kategorie] = {"eurProM2": euro, "faelle": faelle}
                    mittelwerte = None

    ausgabe = {}
    for name, werte in sorted(daten.items()):
        if not werte:
            continue
        eintrag = {"_stadtteil": name}
        eintrag.update(werte)
        ausgabe[slug(name)] = eintrag

    ohne = sorted(namen - set(daten) | {n for n, w in daten.items() if not w})
    ausgabe["_quelle"] = {
        "name": ("Grundstuecksmarktbericht 2026 fuer die Stadt Koeln, "
                 "Gutachterausschuss fuer Grundstueckswerte"),
        "url": PDF_URL,
        "abgerufen": date.today().isoformat(),
        "hinweis": ("Notarielle Kaufpreise, keine Angebotspreise. Arithmetisches "
                    "Mittel Euro je m2 Wohnflaeche fuer Eigentumswohnungen. Der "
                    "Bericht fuehrt nur Stadtteile mit mindestens drei "
                    "auswertbaren Vertraegen; fehlende Stadtteile sind daher "
                    "kein Datenfehler."),
        "kategorien": {
            "Neubau": "Erstverkauf neu errichteter Wohnungen",
            "Weiterverkauf": "Wiederverkauf aus dem Bestand",
            "Umwandlung": "erstmaliger Verkauf nach Aufteilung in Wohneigentum",
        },
        "pflege": ("tools/stadtteildaten/kaufpreise.py --neu ausfuehren. Bei "
                   "einem neuen Jahrgang die PDF-Adresse oben anpassen."),
    }
    if ohne:
        ausgabe["_quelle"]["ohneWerte"] = ohne

    ZIEL.write_text(json.dumps(ausgabe, ensure_ascii=False, indent=1) + "\n",
                    encoding="utf-8")

    anzahl = len([k for k in ausgabe if not k.startswith("_")])
    print(f"  {anzahl} Stadtteile geschrieben nach {ZIEL.relative_to(WURZEL)}")
    if ohne:
        print(f"  Ohne Werte ({len(ohne)}): zu wenige Vertraege im Berichtsjahr")
        print(f"    {', '.join(ohne)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
