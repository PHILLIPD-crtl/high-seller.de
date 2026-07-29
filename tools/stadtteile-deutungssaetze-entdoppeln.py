#!/usr/bin/env python3
"""
Entdoppelt die vier Deutungssaetze in den Wohnkennzahlen-Absaetzen.

Der Absatz wechselt harte Zahlen mit deutenden Saetzen ab. Die Zahlen sind je
Stadtteil verschieden, die Deutungssaetze stammen aus einem kleinen Vorrat -
haben zwei Veedel aehnliche Werte, greifen sie zur selben Fassung. Genau daraus
entstanden die drei Seitenpaare ueber 20 % Uebereinstimmung.

Je Gruppe bleibt EIN Vorkommen unveraendert (der Stadtteil, auf den die
Formulierung am genauesten passt), alle uebrigen bekommen eine eigene Fassung.
Die neuen Fassungen sind an den tatsaechlichen Zahlen des jeweiligen Veedels
geprueft - drei der alten waren sachlich schief:

  - Niehl: Foerderquote 7,8 % gegen 6,2 % ist nicht "nahe am staedtischen Wert",
    sondern darueber.
  - Bayenthal: 3,4 % gegen 6,2 % ist deutlich darunter, nicht "nahe".
  - Porz: 46 % Einpersonenhaushalte gegen 52 % ist gerade KEINE ausgeglichene
    Mischung, sondern ein Familienueberhang. Der alte Satz behauptete das
    Gegenteil der Daten.

Ausserdem stand auf Bayenthal zweimal hintereinander "Der Anteil gefoerderter
Mietwohnungen"; das faellt mit weg.
"""
import os, sys

ROOT = "/Users/phillipdarscheidt/Desktop/Immobilien – High Seller/high-seller-site/.claude/worktrees/seo-fix"

ALT = {
 "alter":     "Beim Alter liegt das Veedel im städtischen Mittel, ein Sondereffekt auf das Verkaufsgeschehen ist daraus nicht abzulesen.",
 "nachfrage": "Die Nachfrage verteilt sich dadurch breit über die Wohnungsgrößen, was Preisvergleiche innerhalb des Veedels aussagekräftig macht.",
 "foerder":   "Der Anteil geförderter Mietwohnungen liegt nahe am städtischen Wert und wirkt sich auf die Preisbildung nur örtlich aus.",
 "mischung":  "Die Mischung hält die Nachfrage stabil, unabhängig davon, ob eine kleine oder eine große Einheit angeboten wird.",
}

# (Stadtteil, Gruppe) -> neue Fassung. None = bleibt unveraendert.
NEU = {
 # --- Durchschnittsalter, Koeln 42,7 Jahre ---
 ("junkersdorf","alter"): None,                       # 42,9 - trifft "im Mittel" am genauesten
 ("bayenthal","alter"):   "Gut ein Jahr unter dem Kölner Wert ist zu wenig Abstand, um daraus einen eigenen Effekt auf das Verkaufsgeschehen abzuleiten.",
 ("deutz","alter"):       "Ein Jahr Abstand nach unten bleibt ohne erkennbare Folge für Angebot und Nachfrage.",
 ("nippes","alter"):      "Der Abstand zum Kölner Wert beträgt gut ein halbes Jahr und trägt zur Einschätzung einer einzelnen Immobilie nichts bei.",
 ("zollstock","alter"):   "Ein knappes halbes Jahr über dem Kölner Wert ist kein Ausschlag, der sich im Verkaufsgeschehen niederschlägt.",

 # --- Mittlere Wohnungsgroesse, Koeln 77 m² ---
 ("lindenthal","nachfrage"): None,                    # 78 m² - "nah am Mittel" trifft hier zu
 ("bayenthal","nachfrage"):  "Der Bestand liegt damit einige Quadratmeter über dem städtischen Zuschnitt; wer eine große Wohnung anbietet, findet im Veedel genügend Vergleichsobjekte.",
 ("niehl","nachfrage"):      "Der Zuschnitt bleibt knapp unter dem städtischen Wert, und weil sich der Bestand nicht auf Extreme verteilt, sind Vergleichsobjekte aus dem Veedel belastbar.",

 # --- Foerderquote, Koeln 6,2 % ---
 ("ehrenfeld","foerder"):   None,                     # 5,9 % - "nahe am staedtischen Wert" trifft zu
 ("bayenthal","foerder"):   "Der geförderte Bestand bleibt damit gut zwei Punkte unter dem Stadtwert, ohne dass daraus ein eigener Preiseffekt entsteht.",
 ("muelheim","foerder"):    "Damit entspricht der geförderte Bestand praktisch dem Stadtwert und verschiebt die Preisbildung im Veedel nicht.",
 ("niehl","foerder"):       "Damit liegt der geförderte Bestand über dem Stadtwert; spürbar wird das in einzelnen Straßenzügen, nicht im Veedel insgesamt.",
 ("weidenpesch","foerder"): "Der geförderte Bestand liegt knapp unter dem Stadtwert und ist für die Preisbildung eine Randgröße.",

 # --- Haushaltsstruktur, Koeln 51,9 % Einpersonen / 17,7 % mit Kindern ---
 ("klettenberg","mischung"): None,                    # 53 % / 18 % - Mischung trifft zu
 ("bayenthal","mischung"):   "Beide Werte liegen dicht an der Gesamtstadt; die Nachfrage bleibt dadurch über die Größenklassen hinweg gleichmäßig.",
 ("porz","mischung"):        "Deutlich weniger Einpersonenhaushalte und mehr Familien als in Köln: Wohnungen ab drei Zimmern und Häuser treffen hier auf die größere Zielgruppe.",
}

# Bayenthal nannte den Anteil zweimal hintereinander. Der zweite Halbsatz faellt
# mit dem Austausch weg, der erste bleibt - hier nur die Ueberleitung glaetten.
FEIN = [
 ("bayenthal",
  "Der Anteil geförderter Mietwohnungen beträgt 3,4 %, in Köln 6,2 %.",
  "Gefördert vermietet sind 3,4 %, in Köln 6,2 %."),
]

def main():
    trocken = "--schreiben" not in sys.argv
    geaendert = 0
    for (st, grp), neu in sorted(NEU.items()):
        if neu is None:
            continue
        p = os.path.join(ROOT, f"immobilienmakler-koeln-{st}.html")
        s = open(p, encoding="utf-8").read()
        alt = ALT[grp]
        n = s.count(alt)
        if n != 1:
            print(f"  ABBRUCH {st}/{grp}: {n} Treffer statt 1", file=sys.stderr)
            return 1
        if not trocken:
            open(p, "w", encoding="utf-8").write(s.replace(alt, neu))
        print(f"  {st:14s} {grp:10s} ersetzt")
        geaendert += 1

    for st, alt, neu in FEIN:
        p = os.path.join(ROOT, f"immobilienmakler-koeln-{st}.html")
        s = open(p, encoding="utf-8").read()
        if s.count(alt) != 1:
            print(f"  HINWEIS {st}: Feinschliff nicht eindeutig, uebersprungen", file=sys.stderr)
            continue
        if not trocken:
            open(p, "w", encoding="utf-8").write(s.replace(alt, neu))
        print(f"  {st:14s} {'feinschliff':10s} ersetzt")
        geaendert += 1

    print(f"\n{geaendert} Stellen{' (Probelauf, nichts geschrieben)' if trocken else ' geschrieben'}.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
