#!/usr/bin/env python3
"""Stadtteilseiten aus Vorlage und Daten erzeugen.

Nimmt eine bestehende Stadtteilseite als Gerüst und ersetzt die variablen
Stellen durch stadtteileigene Inhalte. Boilerplate (Kopf, Fuß, Wertrechner,
Cookie-Banner) bleibt unangetastet — sie macht rund 300 der 354 Zeilen aus und
soll sich nie unterscheiden.

Gegen Duplikation wirken drei Dinge:
1. Die Zahlen unterscheiden sich je Stadtteil ohnehin.
2. Die Ortsprofile sind Handarbeit (src/data/stadtteile-profile.json).
3. Formulierungsgerüste werden **datengesteuert** gewählt, nicht zufällig:
   Ein Stadtteil mit hoher Förderquote bekommt einen anderen Aufhänger als
   einer mit teurem Neubau. Zufall würde bei erneutem Lauf andere Texte
   erzeugen und die Seiten unnötig verändern.

Aufruf:
    python3 tools/stadtteildaten/seiten_bauen.py            # alle mit Profil
    python3 tools/stadtteildaten/seiten_bauen.py riehl      # einzelne
    python3 tools/stadtteildaten/seiten_bauen.py --pruefen  # nur messen
"""

import argparse
import json
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
DATEN = WURZEL / "src" / "data"
VORLAGE = WURZEL / "immobilienmakler-koeln-nippes.html"


def laden(name):
    return json.loads((DATEN / name).read_text(encoding="utf-8"))


def zahl(wert, nachkomma=0):
    """1234.5 -> '1.235' — deutsche Schreibweise.

    Der Umweg ueber das Rautezeichen ist noetig, weil Punkt und Komma
    gegeneinander getauscht werden: ohne Zwischenschritt wuerde die zweite
    Ersetzung das Ergebnis der ersten wieder einfangen.
    """
    s = f"{wert:,.{nachkomma}f}"
    return s.replace(",", "#").replace(".", ",").replace("#", ".")


def waehle(varianten, kennzahl):
    """Variante datengesteuert waehlen, damit gleiche Eingabe gleiche Ausgabe
    ergibt. Der Rest der Kennzahl streut ueber die Stadtteile."""
    return varianten[int(kennzahl) % len(varianten)]


class Stadtteil:
    def __init__(self, kuerzel, profil, wohn, boden, kauf, bezirk, nachbarn):
        self.kuerzel = kuerzel
        self.name = profil["_stadtteil"]
        # "Neustadt/Süd" heisst in Fliesstext und Adresse "Neustadt-Süd"
        self.anzeige = self.name.replace("/", "-")
        self.profil = profil
        self.w = wohn
        self.b = boden
        self.k = kauf
        self.bezirk = bezirk
        self.nachbarn = nachbarn
        self.datei = f"immobilienmakler-koeln-{kuerzel}.html"

    # -- abgeleitete Kennzahlen -------------------------------------------
    @property
    def einwohner(self):
        return self.w["einwohner"]["wert"]

    @property
    def wohnungen(self):
        return self.w["wohnungen"]["wert"]

    @property
    def flaeche_je_wohnung(self):
        return self.w["wohnflaecheJeWohnung"]["wert"]

    @property
    def wv(self):
        return self.k.get("Weiterverkauf")

    @property
    def neubau(self):
        return self.k.get("Neubau")

    @property
    def einpersonen(self):
        return self.w["anteilEinpersonen"]["wert"]

    @property
    def mit_kindern(self):
        return self.w["anteilMitKindern"]["wert"]

    @property
    def gefoerdert(self):
        return self.w["anteilGefoerdert"]["wert"]


def marktdaten_block(s, koeln):
    """Die drei Kennzahlenkacheln. Fehlende Werte werden weggelassen, nicht
    mit Platzhaltern gefuellt — eine leere Kachel wirkt wie ein Fehler."""
    teile = []
    if s.b:
        teile.append(
            f'<div><dt>Bodenrichtwert</dt><dd><b>{zahl(s.b["brw"][0])}–{zahl(s.b["brw"][1])} €/m²</b>'
            f'<span>Median {zahl(s.b["brwMedian"])} · {s.b["brwZonen"]} '
            f'{"Zone" if s.b["brwZonen"] == 1 else "Zonen"} · Stichtag 1.1.2026</span></dd></div>')
    if s.wv:
        teile.append(
            f'<div><dt>Wohnung, Weiterverkauf</dt><dd><b>{zahl(s.wv["eurProM2"])} €/m²</b>'
            f'<span>{zahl(s.wv["faelle"])} Kaufverträge 2025</span></dd></div>')
    if s.neubau:
        teile.append(
            f'<div><dt>Wohnung, Neubau</dt><dd><b>{zahl(s.neubau["eurProM2"])} €/m²</b>'
            f'<span>{zahl(s.neubau["faelle"])} Kaufverträge 2025</span></dd></div>')
    return "".join(teile)


def bestand_absatz(s, koeln):
    """Wohnungsbestand in Zahlen — der Vergleich mit dem Stadtwert macht die
    Zahl erst aussagekraeftig."""
    k_ein = koeln["anteilEinpersonen"]["wert"]
    k_kind = koeln["anteilMitKindern"]["wert"]
    k_fl = koeln["wohnflaecheJeWohnung"]["wert"]

    if s.flaeche_je_wohnung >= k_fl + 12:
        gr = (f"Mit {zahl(s.flaeche_je_wohnung, 1)} m² je Wohnung liegt der Bestand deutlich "
              f"über dem Kölner Mittel von {zahl(k_fl, 1)} m² — hier stehen Familienwohnungen "
              f"und Häuser, keine Einzimmerappartements.")
    elif s.flaeche_je_wohnung <= k_fl - 8:
        gr = (f"Mit {zahl(s.flaeche_je_wohnung, 1)} m² je Wohnung ist der Bestand kleinteiliger "
              f"als im Kölner Mittel ({zahl(k_fl, 1)} m²). Das begrenzt den Kreis der Käufer "
              f"nicht, verschiebt ihn aber.")
    else:
        gr = (f"Mit {zahl(s.flaeche_je_wohnung, 1)} m² je Wohnung entspricht der Bestand "
              f"weitgehend dem Kölner Mittel von {zahl(k_fl, 1)} m².")

    nachfrage = (
        "gefragt sind vor allem gut geschnittene Zwei- und Dreizimmerwohnungen"
        if s.einpersonen > k_ein + 3 else
        "gefragt sind vor allem familientaugliche Grundrisse ab drei Zimmern"
        if s.mit_kindern > k_kind + 2 else
        "die Nachfrage verteilt sich breit über die Wohnungsgrößen")

    text = (f"Von den {zahl(s.w['haushalte']['wert'])} Haushalten bestehen "
            f"{zahl(s.einpersonen)} % aus einer Person (Köln: {zahl(k_ein)} %), "
            f"{zahl(s.mit_kindern)} % leben mit Kindern (Köln: {zahl(k_kind)} %). "
            f"Das prägt die Nachfrage: {nachfrage}. {gr}")

    if s.gefoerdert >= koeln["anteilGefoerdert"]["wert"] * 1.6:
        text += (f" Der Anteil geförderter Wohnungen liegt bei {zahl(s.gefoerdert, 1)} % und "
                 f"damit klar über dem Stadtwert von "
                 f"{zahl(koeln['anteilGefoerdert']['wert'], 1)} % — für Kapitalanleger ein "
                 f"Punkt, der in die Bewertung gehört.")
    return text


def einleitung(s):
    """Erster Satz nach der H1. Aufhaenger datengesteuert, nicht zufaellig."""
    varianten = [
        f"{s.anzeige} zählt zu den Lagen, in denen sich Angebot und Nachfrage spürbar "
        f"verschoben haben.",
        f"{s.anzeige} ist ein Stadtteil mit eigenem Charakter — und einem Markt, der sich "
        f"nicht mit dem Kölner Durchschnitt erklären lässt.",
        f"Wer in {s.anzeige} verkauft, verkauft in einem Markt mit eigenen Regeln.",
    ]
    grund = int(s.einwohner)
    satz = waehle(varianten, grund)
    if s.wv:
        satz += (f" {zahl(s.wv['faelle'])} notariell beurkundete Wohnungsverkäufe im Jahr 2025 "
                 f"geben dafür eine belastbare Grundlage.")
    return satz


def lage_und_markt(s, koeln):
    """Drei Absaetze: Einordnung, Bebauung, Preisniveau."""
    a1 = (f"{s.anzeige} gehört zum Stadtbezirk {s.bezirk}. "
          f"{zahl(s.einwohner)} Menschen leben hier in {zahl(s.wohnungen)} Wohnungen.")
    a2 = s.profil["bebauung"]
    a3_teile = [s.profil["lage"]]
    if s.wv:
        k_wv = 4200  # grober Kölner Mittelwert Weiterverkauf, nur zur Einordnung
        if s.wv["eurProM2"] >= 5200:
            a3_teile.append(
                f"Das Preisniveau ist gehoben: {zahl(s.wv['eurProM2'])} € je m² Wohnfläche im "
                f"Weiterverkauf, ermittelt aus {zahl(s.wv['faelle'])} notariellen Kaufverträgen.")
        elif s.wv["eurProM2"] <= 3300:
            a3_teile.append(
                f"Mit {zahl(s.wv['eurProM2'])} € je m² Wohnfläche im Weiterverkauf liegt "
                f"{s.anzeige} im günstigeren Drittel der Stadt — für Käufer ein Einstieg, für "
                f"Eigentümer ein Markt mit Bewegung nach oben.")
        else:
            a3_teile.append(
                f"Der Weiterverkauf liegt bei {zahl(s.wv['eurProM2'])} € je m² Wohnfläche, "
                f"ermittelt aus {zahl(s.wv['faelle'])} notariellen Kaufverträgen des Jahres 2025.")
    return a1, a2, " ".join(a3_teile)


def bauen(s, vorlage, koeln):
    """Vorlage nehmen und Stelle fuer Stelle ersetzen."""
    h = vorlage
    a1, a2, a3 = lage_und_markt(s, koeln)

    titel = f"Immobilienmakler Köln-{s.anzeige} | Immobilie bewerten"
    beschreibung = (f"Immobilienmakler in Köln-{s.anzeige}: Wohnungen und Häuser verkaufen und "
                    f"bewerten. Aktuelle Marktdaten, geprüfte Käufer, Bewertung aus einer Hand.")
    if len(beschreibung) > 165:
        beschreibung = beschreibung[:162].rsplit(" ", 1)[0] + "."

    ersetzungen = [
        # Metadaten
        (r'<title>.*?</title>', f'<title>{titel}</title>'),
        (r'(<meta name="description" content=")[^"]*(")', rf'\1{beschreibung}\2'),
        (r'(<meta property="og:title" content=")[^"]*(")', rf'\1{titel}\2'),
        (r'(<meta property="og:description" content=")[^"]*(")', rf'\1{beschreibung}\2'),
        (r'(<meta name="twitter:title" content=")[^"]*(")', rf'\1{titel}\2'),
        (r'(<meta name="twitter:description" content=")[^"]*(")', rf'\1{beschreibung}\2'),
        (r'(<link rel="canonical" href="https://high-seller\.de/)[^"]*(">)',
         rf'\1{s.datei}\2'),
        (r'(<meta property="og:url" content="https://high-seller\.de/)[^"]*(">)',
         rf'\1{s.datei}\2'),
        # Sichtbarer Inhalt
        (r'(› )Köln-Nippes(</div>)', rf'\1Köln-{s.anzeige}\2'),
        (r'<h1>Immobilienmakler in Köln-Nippes</h1><p>.*?</p>',
         f'<h1>Immobilienmakler in Köln-{s.anzeige}</h1><p>{einleitung(s)}</p>'),
        (r'<h2>Immobilien in Nippes: Lage &amp; Markt</h2>',
         f'<h2>Immobilien in {s.anzeige}: Lage &amp; Markt</h2>'),
        (r'<h2>Der Immobilienmarkt in Nippes</h2>',
         f'<h2>Der Immobilienmarkt in {s.anzeige}</h2>'),
        (r'<h3>Immobilie in Köln-Nippes verkaufen oder bewerten\?</h3>',
         f'<h3>Immobilie in Köln-{s.anzeige} verkaufen oder bewerten?</h3>'),
        (r'(<h2 class="headline">)Immobilienpreise in Köln-Nippes(</h2>)',
         rf'\1Immobilienpreise in Köln-{s.anzeige}\2'),
        (r'<h3>Marktdaten Köln-Nippes</h3>', f'<h3>Marktdaten Köln-{s.anzeige}</h3>'),
        (r'<h3>Bebauung in Köln-Nippes</h3>', f'<h3>Bebauung in Köln-{s.anzeige}</h3>'),
        (r'(<h2 class="headline" style="max-width:24ch">)Immobilienwert in Köln-Nippes ermitteln(</h2>)',
         rf'\1Immobilienwert in Köln-{s.anzeige} ermitteln\2'),
    ]
    for muster, ersatz in ersetzungen:
        h, n = re.subn(muster, ersatz, h, flags=re.S)
        if n == 0:
            raise SystemExit(f"{s.kuerzel}: Muster nicht gefunden -> {muster[:60]}")

    return h


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("stadtteile", nargs="*", help="Kürzel; leer = alle mit Profil")
    p.add_argument("--pruefen", action="store_true", help="nur messen, nichts schreiben")
    args = p.parse_args()

    profile = laden("stadtteile-profile.json")
    wohn = laden("stadtteile-wohnkennzahlen.json")
    boden = laden("stadtteile-bodenrichtwerte.json")
    kauf = laden("stadtteile-kaufpreise.json")
    koeln = wohn["_koeln"]

    kuerzel = args.stadtteile or [k for k in profile if not k.startswith("_")]
    vorlage = VORLAGE.read_text(encoding="utf-8")

    print(f"Seiten bauen: {len(kuerzel)} Stadtteile")
    gebaut = 0
    for k in kuerzel:
        if k not in profile:
            print(f"  {k}: kein Ortsprofil, uebersprungen")
            continue
        s = Stadtteil(k, profile[k], wohn[k], boden.get(k), kauf.get(k, {}),
                      bezirk="", nachbarn=[])
        html = bauen(s, vorlage, koeln)
        if not args.pruefen:
            (WURZEL / s.datei).write_text(html, encoding="utf-8")
        gebaut += 1
        print(f"  {s.datei}  ({len(html)//1024} KB)")

    print(f"{gebaut} Seiten {'geprueft' if args.pruefen else 'geschrieben'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
