#!/usr/bin/env python3
"""Wohnkennzahlen je Kölner Stadtteil aus dem Statistischen Datenkatalog ziehen.

Quelle: Stadt Köln, Amt für Stadtentwicklung und Statistik.
Lizenz: Datenlizenz Deutschland Namensnennung 2.0.

Schreibt src/data/stadtteile-wohnkennzahlen.json für alle 86 Stadtteile.

Aufruf:
    python3 tools/stadtteildaten/wohnkennzahlen.py

Die CSV wird nach tools/stadtteildaten/.cache/ zwischengespeichert. Für einen
frischen Abruf die Datei dort löschen oder --neu übergeben.
"""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

import pandas as pd
import requests

CSV_URL = (
    "https://offenedaten-koeln.de/sites/default/files/uploaded_resources/"
    "Stadt_K%C3%B6ln_Statistischer_Datenkatalog.csv"
)

# Merkmalskürzel des Katalogs. Diese Zuordnung ist die eigentliche Fachlogik der
# Datei — ein falsches Kürzel liefert stillschweigend plausible, aber falsche
# Zahlen. A0002A heißt NICHT Einwohner, sondern Nichtdeutsche; richtig ist A0025A.
MERKMALE = {
    "A0025A": "einwohner",
    "A0022S": "durchschnittsalter",
    "A0267A": "haushalte",
    "A0273P": "anteilEinpersonen",
    "A0275P": "anteilMitKindern",
    "B0025A": "wohnungen",
    "B0023S": "wohnflaecheJeWohnung",
    "B0022S": "wohnflaecheJeEinwohner",
    "B0009A": "neubauWohnungen",
    "B0026P": "anteilGefoerdert",
}

# Für die Gesamtstadt gibt es keine Neubauzahl auf derselben Ebene; sie bleibt
# außen vor, damit kein leeres Feld in die Datei wandert.
MERKMALE_GESAMTSTADT = {k: v for k, v in MERKMALE.items() if v != "neubauWohnungen"}

WURZEL = Path(__file__).resolve().parents[2]
ZIEL = WURZEL / "src" / "data" / "stadtteile-wohnkennzahlen.json"
CACHE = Path(__file__).resolve().parent / ".cache" / "datenkatalog.csv"


def slug(name: str) -> str:
    """Stadtteilname zu Dateinamen-Kürzel.

    Muss die Kürzel der bereits bestehenden Seiten treffen (suelz, muelheim,
    duennwald, hoehenhaus …), sonst verlieren die vorhandenen 20 Stadtteilseiten
    den Anschluss an ihre Daten.
    """
    s = name.lower()
    for alt, neu in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss"),
                     ("/", "-"), (" ", "-")):
        s = s.replace(alt, neu)
    return s


def csv_laden(neu: bool = False) -> Path:
    """CSV holen, sofern nicht schon im Zwischenspeicher."""
    if CACHE.exists() and not neu:
        print(f"  Zwischenspeicher: {CACHE.relative_to(WURZEL)}")
        return CACHE

    CACHE.parent.mkdir(parents=True, exist_ok=True)
    print(f"  Lade {CSV_URL}")
    antwort = requests.get(CSV_URL, timeout=180)
    antwort.raise_for_status()
    CACHE.write_bytes(antwort.content)
    print(f"  {len(antwort.content) / 1_048_576:.1f} MB geladen")
    return CACHE


def juengster_wert(zeilen: pd.DataFrame, spalte: str):
    """Jüngstes Jahr, für das dieses Merkmal einen Wert hat.

    Die Merkmale sind unterschiedlich weit fortgeschrieben — Wohnungsbestand
    endet oft ein Jahr früher als die Einwohnerzahl. Ein pauschales „neuestes
    Jahr" für alle Merkmale würde deshalb Felder leeren, die es noch gibt.
    """
    if spalte not in zeilen.columns:
        return None
    gefuellt = zeilen[zeilen[spalte].notna()]
    if gefuellt.empty:
        return None
    jung = gefuellt.loc[gefuellt["S_JAHR"].idxmax()]
    return {"wert": float(jung[spalte]), "jahr": int(jung["S_JAHR"])}


def kennzahlen(zeilen: pd.DataFrame, merkmale: dict) -> dict:
    ergebnis = {}
    for kuerzel, name in merkmale.items():
        wert = juengster_wert(zeilen, kuerzel)
        if wert is not None:
            ergebnis[name] = wert
    return ergebnis


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--neu", action="store_true",
                        help="CSV erneut laden statt Zwischenspeicher nutzen")
    args = parser.parse_args()

    print("Wohnkennzahlen je Stadtteil")
    pfad = csv_laden(args.neu)

    df = pd.read_csv(pfad, sep=";", encoding="utf-8-sig", decimal=",",
                     low_memory=False)

    # Ohne diesen Filter landen Bezirkszahlen auf der Stadtteilseite: Porz,
    # Mülheim, Nippes, Ehrenfeld, Lindenthal und Rodenkirchen sind zugleich
    # Stadtbezirksnamen. Rodenkirchen hätte sonst 58.536 statt 9.557 Wohnungen.
    stadtteile = df[df["RAUMEBENE"] == "Stadtteile"]
    bezirke = df[df["RAUMEBENE"] == "Stadtbezirke"]
    gesamt = df[df["RAUMEBENE"] == "Gesamtstadt"]

    ausgabe = {}
    for raum in sorted(stadtteile["RAUM"].unique()):
        # Format der Quelle ist "101 / Altstadt/Süd" — die Kennziffer abtrennen.
        name = raum.split(" / ", 1)[1] if " / " in raum else raum
        zeilen = stadtteile[stadtteile["RAUM"] == raum]
        eintrag = {"_ebene": "Stadtteil", "_raum": raum}
        eintrag.update(kennzahlen(zeilen, MERKMALE))
        ausgabe[slug(name)] = eintrag

    # Die Innenstadt gibt es amtlich nur als Stadtbezirk, nicht als Stadtteil.
    # Die bestehende Seite immobilienmakler-koeln-innenstadt.html braucht sie
    # trotzdem, deshalb hier gesondert von der Bezirksebene.
    innen = bezirke[bezirke["RAUM"].str.contains("Innenstadt", na=False)]
    if not innen.empty:
        raum = innen["RAUM"].iloc[0]
        eintrag = {"_ebene": "Stadtbezirk", "_raum": raum}
        eintrag.update(kennzahlen(innen, MERKMALE))
        ausgabe["innenstadt"] = eintrag

    ausgabe["_koeln"] = kennzahlen(gesamt, MERKMALE_GESAMTSTADT)
    ausgabe["_quelle"] = {
        "name": ("Stadt Köln, Amt für Stadtentwicklung und Statistik: "
                 "Statistischer Datenkatalog"),
        "url": "https://www.offenedaten-koeln.de/dataset/statistischer-datenkatalog-koeln",
        "lizenz": "Datenlizenz Deutschland Namensnennung 2.0",
        "abgerufen": date.today().isoformat(),
        "hinweis": ("Wohnungsbestand und Wohnflaeche nach Zensus 2022 "
                    "fortgeschrieben. Innenstadt liegt nur als Stadtbezirk vor, "
                    "nicht als Stadtteil."),
        "merkmale": MERKMALE,
        "pflege": ("tools/stadtteildaten/wohnkennzahlen.py --neu ausfuehren. "
                   "Je Stadtteil und Merkmal wird das juengste Jahr mit Wert "
                   "genommen, weil die Merkmale unterschiedlich weit "
                   "fortgeschrieben sind."),
    }

    ZIEL.write_text(json.dumps(ausgabe, ensure_ascii=False, indent=1) + "\n",
                    encoding="utf-8")

    stadtteil_anzahl = len([k for k in ausgabe if not k.startswith("_")])
    print(f"  {stadtteil_anzahl} Raeume geschrieben nach "
          f"{ZIEL.relative_to(WURZEL)}")

    # Vollstaendigkeit melden, statt sie stillschweigend vorauszusetzen.
    luecken = {k: [m for m in MERKMALE.values() if m not in v]
               for k, v in ausgabe.items()
               if not k.startswith("_") and
               [m for m in MERKMALE.values() if m not in v]}
    if luecken:
        print(f"  Unvollstaendig bei {len(luecken)} Raeumen:")
        for k, fehlt in sorted(luecken.items())[:10]:
            print(f"    {k}: fehlt {', '.join(fehlt)}")
    else:
        print("  Alle Merkmale fuer alle Raeume vorhanden")

    return 0


if __name__ == "__main__":
    sys.exit(main())
