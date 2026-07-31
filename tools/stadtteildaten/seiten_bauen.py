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


# Kuerzel -> Anzeigename, aus der Bezirksdatei gefuellt. Wird fuer die
# Beschriftung der Nachbarschaftsknoepfe gebraucht.
ANZEIGE = {}


def anzeige_von(kuerzel):
    return ANZEIGE.get(kuerzel, kuerzel.replace("-", "-").title())


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


def zusammenfassung(s):
    """Ein Satz ueber dem Marktabschnitt. Nimmt den ersten Satz des
    Bebauungsprofils auf, damit hier nicht dieselbe Floskel auf 63 Seiten steht."""
    erster = s.profil["bebauung"].split(". ")[0].rstrip(".")
    return (f"{erster}. Für den Verkauf zählt, was das im Einzelfall bedeutet — "
            f"Zustand, Schnitt und Lage innerhalb des Stadtteils.")


def markt_absatz(s):
    """Absatz unter 'Der Immobilienmarkt in X'. Traegt die Kaufpreise."""
    if not s.wv:
        return (f"Der Gutachterausschuss weist für {s.anzeige} im Berichtsjahr keine "
                f"gesonderten Wohnungspreise aus — dafür braucht es mindestens drei "
                f"auswertbare Kaufverträge. Die Bewertung stützt sich hier auf "
                f"Bodenrichtwerte und Vergleichsobjekte der Nachbarschaft.")
    teile = [f"Im Weiterverkauf wurden 2025 im Mittel {zahl(s.wv['eurProM2'])} € je m² "
             f"Wohnfläche notariell beurkundet, ermittelt aus {zahl(s.wv['faelle'])} "
             f"Kaufverträgen."]
    if s.neubau:
        aufschlag = round((s.neubau["eurProM2"] / s.wv["eurProM2"] - 1) * 100)
        teile.append(f"Neubauwohnungen lagen bei {zahl(s.neubau['eurProM2'])} € je m² und damit "
                     f"rund {aufschlag} % darüber ({zahl(s.neubau['faelle'])} Verträge).")
    teile.append("Das sind beurkundete Preise, keine Angebotspreise — der Unterschied ist "
                 "der Grund, warum diese Zahlen als Grundlage taugen.")
    return " ".join(teile)


def abschluss(s):
    """Absatz ueber dem Wertrechner. Fasst den Stadtteil in einem Satz, ohne
    die Formulierungen der Abschnitte darueber zu wiederholen."""
    lage_erster = s.profil["lage"].split(". ")[0].rstrip(".")
    return (f"{s.anzeige} im Stadtbezirk {s.bezirk}: {lage_erster}. Was Ihre Immobilie "
            f"hier wert ist, hängt von Lage, Zustand und Schnitt ab — die Einschätzung "
            f"ist kostenlos und unverbindlich.")


def preisfrage(s):
    """Antwort auf die Preisfrage. Stuetzt sich auf die eigenen Zahlen des
    Stadtteils statt auf allgemeine Marktprosa."""
    if not s.wv:
        return ("Für diesen Stadtteil weist der Gutachterausschuss zu wenige Kaufverträge "
                "aus, um einen Mittelwert zu bilden. Aussagekräftig sind hier die "
                "Bodenrichtwerte und Vergleichsobjekte der direkten Nachbarschaft — "
                "beides sehen wir uns für Ihr Objekt konkret an.")
    teile = [f"Für {s.anzeige} liegt der beurkundete Mittelwert im Weiterverkauf bei "
             f"{zahl(s.wv['eurProM2'])} € je m² Wohnfläche."]
    if s.b:
        teile.append(f"Die Bodenrichtwerte reichen von {zahl(s.b['brw'][0])} bis "
                     f"{zahl(s.b['brw'][1])} € je m² über {s.b['brwZonen']} "
                     f"{'Zone' if s.b['brwZonen'] == 1 else 'Zonen'} — die Spanne zeigt, wie "
                     f"stark die Lage innerhalb des Stadtteils zählt.")
    teile.append("Ein Mittelwert ersetzt keine Bewertung: Zustand, Schnitt, Baujahr und "
                 "Vermietung verschieben den Wert im Einzelfall erheblich.")
    return " ".join(teile)


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
        # Lage & Markt: Ueberschrift plus die drei folgenden Absaetze am Stueck,
        # damit Reihenfolge und Einrueckung der Vorlage erhalten bleiben.
        (r'<h2>Immobilien in Nippes: Lage &amp; Markt</h2>\n'
         r'(\s*)<p>.*?</p>\n\s*<p>.*?</p>\n\s*<p>.*?</p>',
         lambda m: (f'<h2>Immobilien in {s.anzeige}: Lage &amp; Markt</h2>\n'
                    f'{m.group(1)}<p>{a1}</p>\n{m.group(1)}<p>{a2}</p>\n'
                    f'{m.group(1)}<p>{a3}</p>')),
        (r'(<div class="prose reveal"><p>).*?(</p>)',
         lambda m: m.group(1) + zusammenfassung(s) + m.group(2)),
        (r'<h2>Der Immobilienmarkt in Nippes</h2>\n(\s*)<p>.*?</p>',
         lambda m: (f'<h2>Der Immobilienmarkt in {s.anzeige}</h2>\n'
                    f'{m.group(1)}<p>{markt_absatz(s)}</p>')),
        # Kennzahlenkacheln zwischen <dl> und </dl>
        (r'(<dl>\n)(?:\s*<div><dt>.*?</div>\n)+(\s*</dl>)',
         lambda m: m.group(1) + marktdaten_block(s, koeln) + "\n" + m.group(2)),
        # Ortsprofil: Bebauung und Lage
        (r'(<h3>Bebauung in Köln-)Nippes(</h3>\n\s*<p>).*?(</p>)',
         lambda m: m.group(1) + s.anzeige + m.group(2) + s.profil["bebauung"] + m.group(3)),
        (r'(<h3>Lage und Infrastruktur</h3>\n\s*<p>).*?(</p>)',
         lambda m: m.group(1) + s.profil["lage"] + m.group(2)),
        # Wohnungsbestand in Zahlen
        (r'(<h3>Wohnungsbestand in Zahlen</h3>\n\s*<p>).*?(</p>)',
         lambda m: m.group(1) + bestand_absatz(s, koeln) + m.group(2)),
        # Leistungsaufzaehlung
        (r'<ul class="bullets">.*?</ul>',
         lambda m: ('<ul class="bullets">'
                    f'<li>Bewertung anhand der Vergleichslagen in {s.anzeige}</li>'
                    '<li>Vermarktung über Portale, Netzwerk und Käuferkartei</li>'
                    '<li>Käufer auf Finanzierbarkeit geprüft, bevor besichtigt wird</li>'
                    '<li>Auch vermietete Objekte und Kapitalanlagen</li></ul>')),
        # Abschlussabsatz ueber dem Wertrechner
        (r'(<p class="awards-note")', r'\1'),  # Anker, bleibt unveraendert
        # Haeufige Fragen: erste Frage traegt den Stadtteilnamen
        (r'<h3>Warum steigen die Preise in Nippes\?</h3>\n(\s*)<p>.*?</p>',
         lambda m: (f'<h3>Wie entwickeln sich die Preise in {s.anzeige}?</h3>\n'
                    f'{m.group(1)}<p>{preisfrage(s)}</p>')),
        (r'<h3>Mehrfamilienhaus in Nippes verkaufen, wie läuft die Bewertung\?</h3>',
         f'<h3>Mehrfamilienhaus in {s.anzeige} verkaufen, wie läuft die Bewertung?</h3>'),
        # Abschlussabsatz ueber dem Wertrechner
        (r'(<p>)Nippes ist das aufstrebende Veedel im Kölner Norden:.*?(</p>)',
         lambda m: m.group(1) + abschluss(s) + m.group(2)),
        # Einstiegstext des Wertrechners
        (r'(<p class="lead" style="max-width:58ch;margin-bottom:20px">Sie überlegen zu '
         r'verkaufen\? Starten Sie mit einer kostenlosen Einschätzung für Ihre Immobilie in )'
         r'Nippes(\.)',
         rf'\1{s.anzeige}\2'),
        (r'<h3>Immobilie in Köln-Nippes verkaufen oder bewerten\?</h3>',
         f'<h3>Immobilie in Köln-{s.anzeige} verkaufen oder bewerten?</h3>'),
        (r'(<h2 class="headline">)Immobilienpreise in Köln-Nippes(</h2>)',
         rf'\1Immobilienpreise in Köln-{s.anzeige}\2'),
        (r'<h3>Marktdaten Köln-Nippes</h3>', f'<h3>Marktdaten Köln-{s.anzeige}</h3>'),
        (r'(<h2 class="headline" style="max-width:24ch">)Immobilienwert in Köln-Nippes ermitteln(</h2>)',
         rf'\1Immobilienwert in Köln-{s.anzeige} ermitteln\2'),
    ]
    for muster, ersatz in ersetzungen:
        h, n = re.subn(muster, ersatz, h, flags=re.S)
        if n == 0:
            raise SystemExit(f"{s.kuerzel}: Muster nicht gefunden -> {muster[:60]}")

    # Nachbarschaftsleiste: Verweise auf die uebrigen Stadtteile desselben
    # Bezirks, fuer die es eine Seite gibt. Symmetrisch, weil jede Seite alle
    # anderen ihres Bezirks nennt — ohne Symmetrie haengen Randlagen in der Luft.
    if s.nachbarn:
        knoepfe = " ".join(
            f'<a class="btn btn--ghost" href="immobilienmakler-koeln-{n}.html">'
            f'Köln-{anzeige_von(n)}</a>' for n in s.nachbarn)
        h, n_ = re.subn(
            r'(<p style="font-weight:600;color:var\(--ink\);margin-bottom:10px">'
            r'Auch tätig im Stadtbezirk )Nippes( und Umgebung:</p>\n\s*'
            r'<div style="display:flex;flex-wrap:wrap;gap:10px">).*?(</div>)',
            lambda m: m.group(1) + s.bezirk + m.group(2) + knoepfe + m.group(3),
            h, flags=re.S)
        if n_ == 0:
            raise SystemExit(f"{s.kuerzel}: Nachbarschaftsleiste nicht gefunden")

    # Schlussdurchgang fuer die strukturierten Daten und alles, was den Namen
    # der Vorlage noch traegt. Bewusst zuletzt: waeren diese Ersetzungen frueher
    # gelaufen, haetten die genaueren Muster oben ins Leere gegriffen.
    h = h.replace("immobilienmakler-koeln-nippes.html", s.datei)
    h = h.replace("Köln-Nippes", f"Köln-{s.anzeige}")
    h = h.replace("Köln Nippes", f"Köln {s.anzeige}")

    # Der Bezirksname darf stehen bleiben: Riehl LIEGT im Stadtbezirk Nippes,
    # "Riehl gehoert zum Stadtbezirk Nippes" ist richtig und kein Rest der
    # Vorlage. Nur Vorkommen ausserhalb dieser Wendungen zaehlen.
    pruef = h
    if s.bezirk == "Nippes":
        pruef = pruef.replace(f"zum Stadtbezirk {s.bezirk}", "")
        pruef = pruef.replace(f"im Stadtbezirk {s.bezirk}", "")
        pruef = pruef.replace(f"Stadtbezirk {s.bezirk} und Umgebung", "")
    rest = pruef.count("Nippes")
    if rest and s.kuerzel != "nippes":
        stellen = [z.strip()[:120] for z in pruef.split("\n") if "Nippes" in z][:3]
        raise SystemExit(f"{s.kuerzel}: {rest} Reste der Vorlage uebrig -> {stellen}")

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
    bezirke = laden("stadtteile-bezirke.json")["stadtteile"]
    ANZEIGE.update({k: v["name"].replace("/", "-") for k, v in bezirke.items()})
    koeln = wohn["_koeln"]

    kuerzel = args.stadtteile or [k for k in profile if not k.startswith("_")]
    vorlage = VORLAGE.read_text(encoding="utf-8")

    print(f"Seiten bauen: {len(kuerzel)} Stadtteile")
    gebaut = 0
    for k in kuerzel:
        if k not in profile:
            print(f"  {k}: kein Ortsprofil, uebersprungen")
            continue
        bez = bezirke.get(k, {})
        # Nachbarn = uebrige Stadtteile desselben Bezirks, fuer die es eine
        # Seite gibt. Die Verlinkung bleibt damit symmetrisch.
        # Nur Nachbarn verlinken, deren Seite existiert oder in diesem Lauf
        # entsteht — ein Verweis ins Leere schadet mehr als ein fehlender.
        nachbarn = sorted(n for n, v in bezirke.items()
                          if v.get("bezirk") == bez.get("bezirk") and n != k
                          and ((WURZEL / f"immobilienmakler-koeln-{n}.html").exists()
                               or n in kuerzel))
        s = Stadtteil(k, profile[k], wohn[k], boden.get(k), kauf.get(k, {}),
                      bezirk=bez.get("bezirk", ""), nachbarn=nachbarn)
        html = bauen(s, vorlage, koeln)
        if not args.pruefen:
            (WURZEL / s.datei).write_text(html, encoding="utf-8")
        gebaut += 1
        print(f"  {s.datei}  ({len(html)//1024} KB)")

    print(f"{gebaut} Seiten {'geprueft' if args.pruefen else 'geschrieben'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
