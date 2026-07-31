#!/usr/bin/env python3
"""Rohmaterial für die Ortsprofile je Kölner Stadtteil sammeln.

Quelle: deutschsprachige Wikipedia, Kategorie „Stadtteil von Köln".

Sammelt die Abschnitte, aus denen sich Bebauung und Lage belegen lassen:
Geschichte, Bauwerke, Verkehr, Bildung, Grünflächen. Das Ergebnis ist
**Arbeitsmaterial**, keine Seiteninhalte.

WICHTIG — der Text wird nicht übernommen, sondern gelesen und neu formuliert.
Wikipedia steht unter CC BY-SA; eine wörtliche Übernahme würde Namensnennung
und Weitergabe unter gleichen Bedingungen verlangen und wäre für eine
gewerbliche Seite unbrauchbar. Ausserdem waeren 63 abgeschriebene Absätze
genau die Art Inhalt, die Google als wertlos einstuft. Aus den Fakten
(Baujahre, Linien, Schulnamen, Parks) entsteht je Stadtteil ein eigener Text.

Schreibt tools/stadtteildaten/.cache/ortsfakten.json — bewusst in den
Zwischenspeicher und nicht nach src/data, weil es Rohmaterial ist.

Aufruf:
    python3 tools/stadtteildaten/ortsfakten.py
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests

API = "https://de.wikipedia.org/w/api.php"
KATEGORIE = "Kategorie:Stadtteil von Köln"

# Abschnitte, die Bebauung und Lage belegen. Alles andere (Politik, Wappen,
# Persönlichkeiten, Einzelnachweise) traegt zu einer Maklerseite nichts bei.
INTERESSANT = re.compile(
    r"geschichte|bebauung|bauwerk|architekt|siedlung|verkehr|anbindung|"
    r"infrastruktur|bildung|schule|gr[üu]n|park|freizeit|sehensw|"
    r"wirtschaft|ans[äa]ssige",
    re.I,
)

WURZEL = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / ".cache"
ZIEL = CACHE / "ortsfakten.json"


def slug(name: str) -> str:
    """Stadtteilname zu Kürzel, identisch zu den übrigen Skripten."""
    s = name.lower()
    for alt, neu in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss"),
                     ("/", "-"), (" ", "-")):
        s = s.replace(alt, neu)
    return s


def artikelname_zu_stadtteil(titel: str) -> str:
    """„Braunsfeld (Köln)" -> „Braunsfeld".

    Die Klammerzusaetze der Wikipedia dienen der Unterscheidung von
    gleichnamigen Orten und gehoeren nicht zum Stadtteilnamen.
    """
    return re.sub(r"\s*\((Köln|Köln-\w+)\)\s*$", "", titel).strip()


def artikel_liste(sitzung: requests.Session) -> list[str]:
    antwort = sitzung.get(API, params={
        "action": "query", "list": "categorymembers",
        "cmtitle": KATEGORIE, "cmlimit": "500", "format": "json",
    }, timeout=60)
    antwort.raise_for_status()
    return [m["title"] for m in antwort.json()["query"]["categorymembers"]]


def abschnitte(sitzung: requests.Session, titel: str) -> dict:
    """Klartext des Artikels holen und nach Abschnitten aufteilen."""
    antwort = sitzung.get(API, params={
        "action": "query", "prop": "extracts", "explaintext": "1",
        "titles": titel, "format": "json", "redirects": "1",
    }, timeout=60)
    antwort.raise_for_status()
    seiten = antwort.json()["query"]["pages"]
    text = next(iter(seiten.values())).get("extract", "")
    if not text:
        return {}

    ergebnis = {}
    aktuell = "Einleitung"
    puffer: list[str] = []
    for zeile in text.split("\n"):
        ueberschrift = re.match(r"^(=+)\s*(.+?)\s*\1$", zeile.strip())
        if ueberschrift:
            if puffer:
                ergebnis[aktuell] = "\n".join(puffer).strip()
            aktuell = ueberschrift.group(2)
            puffer = []
        else:
            puffer.append(zeile)
    if puffer:
        ergebnis[aktuell] = "\n".join(puffer).strip()

    # Einleitung immer behalten, sonst nur die fachlich ergiebigen Abschnitte.
    return {k: v for k, v in ergebnis.items()
            if v and (k == "Einleitung" or INTERESSANT.search(k))}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--neu", action="store_true",
                        help="alle Artikel erneut laden")
    args = parser.parse_args()

    print("Ortsfakten je Stadtteil")
    CACHE.mkdir(parents=True, exist_ok=True)

    vorhanden = {}
    if ZIEL.exists() and not args.neu:
        vorhanden = json.loads(ZIEL.read_text(encoding="utf-8"))
        print(f"  Zwischenspeicher: {len(vorhanden)} Stadtteile")

    sitzung = requests.Session()
    sitzung.headers["User-Agent"] = (
        "high-seller.de Stadtteildaten/1.0 (https://high-seller.de; "
        "Recherche fuer Stadtteilseiten)"
    )

    titel_liste = artikel_liste(sitzung)
    print(f"  {len(titel_liste)} Artikel in der Kategorie")

    ausgabe = dict(vorhanden)
    neu = 0
    for i, titel in enumerate(titel_liste, 1):
        name = artikelname_zu_stadtteil(titel)
        kuerzel = slug(name)
        if kuerzel in ausgabe and not args.neu:
            continue
        teile = abschnitte(sitzung, titel)
        ausgabe[kuerzel] = {
            "_stadtteil": name,
            "_artikel": titel,
            "_url": f"https://de.wikipedia.org/wiki/{titel.replace(' ', '_')}",
            "abschnitte": teile,
        }
        neu += 1
        if neu % 10 == 0:
            print(f"  {neu} geladen ({i}/{len(titel_liste)})")
        # Die Wikipedia-API bittet um massvolle Abfrage; eine kurze Pause
        # zwischen den Artikeln kostet hier nichts und ist fair.
        time.sleep(0.2)

    ZIEL.write_text(json.dumps(ausgabe, ensure_ascii=False, indent=1) + "\n",
                    encoding="utf-8")

    leer = sorted(k for k, v in ausgabe.items() if not v["abschnitte"])
    print(f"  {len(ausgabe)} Stadtteile in {ZIEL.relative_to(WURZEL)} "
          f"({neu} neu geladen)")
    if leer:
        print(f"  Ohne verwertbare Abschnitte ({len(leer)}): {', '.join(leer)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
