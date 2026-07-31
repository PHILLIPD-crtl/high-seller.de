#!/usr/bin/env python3
"""Seiten fuer die Umlandstaedte erzeugen.

Nimmt eine bestehende Stadtteilseite als Geruest. Anders als dort gibt es fuer
das Umland KEINE Kaufpreise des Koelner Gutachterausschusses und keine
Wohnkennzahlen der Stadt Koeln - beide Quellen enden an der Stadtgrenze.
Getragen werden die Seiten deshalb von den Bodenrichtwerten aus BORIS NRW,
die landesweit vorliegen, und vom redaktionellen Profil.

Die Marktdaten-Kachel zeigt entsprechend nur den Bodenrichtwert. Eine leere
Kachel oder ein erfundener Kaufpreis waere schlechter als eine Kachel weniger.

Aufruf:  python3 tools/stadtteildaten/umland_seiten.py [--pruefen]
"""
import argparse, json, re, sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
DATEN = WURZEL / "src" / "data"
VORLAGE = WURZEL / "immobilienmakler-koeln-nippes.html"


def zahl(w, n=0):
    return f"{w:,.{n}f}".replace(",", "#").replace(".", ",").replace("#", ".")


def bauen(kuerzel, prof, brw, vorlage):
    stadt = prof["_stadt"]
    datei = f"immobilienmakler-{kuerzel}.html"
    titel = f"Immobilienmakler {stadt} | Immobilie bewerten & verkaufen"
    besch = (f"Immobilienmakler für {stadt}: Häuser und Wohnungen verkaufen und "
             f"bewerten. Amtliche Bodenrichtwerte, geprüfte Käufer, Finanzierung "
             f"aus einer Hand.")[:165]

    kachel = (f'<div><dt>Bodenrichtwert</dt><dd><b>{zahl(brw["brw"][0])}–'
              f'{zahl(brw["brw"][1])} €/m²</b><span>Median {zahl(brw["brwMedian"])} · '
              f'{brw["brwZonen"]} Zonen · Stichtag 1.1.2026</span></dd></div>')

    einleitung = (f"{stadt} liegt vor den Toren Kölns — und hat einen eigenen Markt mit "
                  f"eigenen Preisen. Der Bodenrichtwert liegt im Median bei "
                  f"{zahl(brw['brwMedian'])} € je m² und damit deutlich unter dem Kölner "
                  f"Niveau. Wir sind hier ebenso tätig wie im Stadtgebiet.")
    a1 = (f"{stadt}, {prof['kreis']}, rund {zahl(prof['einwohner'])} Einwohner. "
          f"{prof['lage']}")
    markt = (f"Die amtlichen Bodenrichtwerte reichen von {zahl(brw['brw'][0])} bis "
             f"{zahl(brw['brw'][1])} € je m² über {brw['brwZonen']} Wohnbauzonen, "
             f"Stichtag 1. Januar 2026. Kaufpreise je Objektart weist der Kölner "
             f"Gutachterausschuss für {stadt} nicht aus — sein Berichtsgebiet endet an "
             f"der Stadtgrenze. Für die Bewertung ziehen wir deshalb Vergleichsobjekte "
             f"und den Grundstücksmarktbericht des zuständigen Kreises heran.")

    h = vorlage
    ers = [
        (r'<title>.*?</title>', f'<title>{titel}</title>'),
        (r'(<meta name="description" content=")[^"]*(")', rf'\1{besch}\2'),
        (r'(<meta property="og:title" content=")[^"]*(")', rf'\1{titel}\2'),
        (r'(<meta property="og:description" content=")[^"]*(")', rf'\1{besch}\2'),
        (r'(<meta name="twitter:title" content=")[^"]*(")', rf'\1{titel}\2'),
        (r'(<meta name="twitter:description" content=")[^"]*(")', rf'\1{besch}\2'),
        (r'(<link rel="canonical" href="https://high-seller\.de/)[^"]*(">)', rf'\1{datei}\2'),
        (r'(<meta property="og:url" content="https://high-seller\.de/)[^"]*(">)', rf'\1{datei}\2'),
        (r'(› )Köln-Nippes(</div>)', rf'\1{stadt}\2'),
        (r'<h1>Immobilienmakler in Köln-Nippes</h1><p>.*?</p>',
         f'<h1>Immobilienmakler in {stadt}</h1><p>{einleitung}</p>'),
        (r'<h2>Immobilien in Nippes: Lage &amp; Markt</h2>\n(\s*)<p>.*?</p>\n\s*<p>.*?</p>\n\s*<p>.*?</p>',
         lambda m: (f'<h2>Immobilien in {stadt}: Lage &amp; Markt</h2>\n'
                    f'{m.group(1)}<p>{a1}</p>\n{m.group(1)}<p>{prof["markt"]}</p>\n'
                    f'{m.group(1)}<p>{markt}</p>')),
        (r'(<div class="prose reveal"><p>).*?(</p>)',
         lambda m: m.group(1) + prof["markt"].split(". ")[0] + ". Was das für Ihre Immobilie bedeutet, "
                   "klären wir im Einzelfall." + m.group(2)),
        (r'<h2>Der Immobilienmarkt in Nippes</h2>\n(\s*)<p>.*?</p>',
         lambda m: f'<h2>Der Immobilienmarkt in {stadt}</h2>\n{m.group(1)}<p>{markt}</p>'),
        (r'(<dl>\n)(?:\s*<div><dt>.*?</div>\n)+(\s*</dl>)',
         lambda m: m.group(1) + kachel + "\n" + m.group(2)),
        (r'(<h3>Bebauung in Köln-)Nippes(</h3>\n\s*<p>).*?(</p>)',
         lambda m: f'<h3>Bebauung in {stadt}</h3>\n      <p>' + prof["markt"] + m.group(3)),
        (r'(<h3>Lage und Infrastruktur</h3>\n\s*<p>).*?(</p>)',
         lambda m: m.group(1) + prof["lage"] + m.group(2)),
        (r'(<h3>Wohnungsbestand in Zahlen</h3>\n\s*<p>).*?(</p>)',
         lambda m: m.group(1) + f"Für {stadt} liegen die amtlichen Wohnkennzahlen der "
         f"Stadt Köln nicht vor — sie enden an der Stadtgrenze. Belastbar sind die "
         f"Bodenrichtwerte: {brw['brwZonen']} Wohnbauzonen mit einem Median von "
         f"{zahl(brw['brwMedian'])} € je m². Für die Bewertung Ihrer Immobilie zählen "
         f"ohnehin Zustand, Schnitt und die konkrete Lage im Ort." + m.group(2)),
        (r'<ul class="bullets">.*?</ul>',
         f'<ul class="bullets"><li>Bewertung mit Blick auf {stadt} und die Nachbarorte</li>'
         '<li>Vermarktung über Portale, Netzwerk und Käuferkartei</li>'
         '<li>Käufer auf Finanzierbarkeit geprüft, bevor besichtigt wird</li>'
         '<li>Verkauf und Finanzierung aus einer Hand</li></ul>'),
        (r'<h3>Immobilie in Köln-Nippes verkaufen oder bewerten\?</h3>',
         f'<h3>Immobilie in {stadt} verkaufen oder bewerten?</h3>'),
        (r'(<h2 class="headline">)Immobilienpreise in Köln-Nippes(</h2>)',
         rf'\1Immobilienpreise in {stadt}\2'),
        (r'<h3>Marktdaten Köln-Nippes</h3>', f'<h3>Marktdaten {stadt}</h3>'),
        (r'<h3>Warum steigen die Preise in Nippes\?</h3>\n(\s*)<p>.*?</p>',
         lambda m: (f'<h3>Wie unterscheidet sich {stadt} vom Kölner Markt?</h3>\n'
                    f'{m.group(1)}<p>Der Bodenrichtwert liegt im Median bei '
                    f'{zahl(brw["brwMedian"])} € je m². In Köln liegen die Werte je nach '
                    f'Stadtteil zwischen 600 und über 2.800 € je m². Für Käufer bedeutet '
                    f'das mehr Fläche fürs gleiche Geld, für Verkäufer einen Markt, in dem '
                    f'die Lage im Ort stärker zählt als die Adresse.</p>')),
        (r'<h3>Mehrfamilienhaus in Nippes verkaufen, wie läuft die Bewertung\?</h3>',
         f'<h3>Mehrfamilienhaus in {stadt} verkaufen, wie läuft die Bewertung?</h3>'),
        (r'(<p>)Nippes ist das aufstrebende Veedel im Kölner Norden:.*?(</p>)',
         lambda m: m.group(1) + f"{stadt} im {prof['kreis']}: " +
                   prof["lage"].split(". ")[0] + ". Für eine erste Einschätzung Ihrer "
                   "Immobilie genügen wenige Angaben." + m.group(2)),
        (r'(<h2 class="headline" style="max-width:24ch">)Immobilienwert in Köln-Nippes ermitteln(</h2>)',
         rf'\1Immobilienwert in {stadt} ermitteln\2'),
        (r'(für Ihre Immobilie in )Nippes(\.)', rf'\1{stadt}\2'),
    ]
    for muster, ersatz in ers:
        h, n = re.subn(muster, ersatz, h, flags=re.S)
        if n == 0:
            raise SystemExit(f"{kuerzel}: Muster nicht gefunden -> {str(muster)[:60]}")

    # Nachbarschaftsleiste: Verweis auf die uebrigen Umlandstaedte
    prof_alle = json.loads((DATEN / "umland-profile.json").read_text(encoding="utf-8"))
    knoepfe = " ".join(f'<a class="btn btn--ghost" href="immobilienmakler-{k}.html">'
                       f'{v["_stadt"]}</a>' for k, v in prof_alle.items()
                       if not k.startswith("_") and k != kuerzel)
    h, n = re.subn(r'(<p style="font-weight:600;color:var\(--ink\);margin-bottom:10px">'
                   r'Auch tätig im Stadtbezirk )Nippes( und Umgebung:</p>\n\s*'
                   r'<div style="display:flex;flex-wrap:wrap;gap:10px">).*?(</div>)',
                   lambda m: (m.group(1).replace("im Stadtbezirk ", "im ") + "Kölner Umland"
                              + m.group(2) + knoepfe + m.group(3)), h, flags=re.S)
    if n == 0:
        raise SystemExit(f"{kuerzel}: Nachbarschaftsleiste nicht gefunden")

    h = h.replace("immobilienmakler-koeln-nippes.html", datei)
    h = h.replace("Köln-Nippes", stadt).replace("Köln Nippes", stadt)
    rest = h.count("Nippes")
    if rest:
        stellen = [z.strip()[:110] for z in h.split("\n") if "Nippes" in z][:3]
        raise SystemExit(f"{kuerzel}: {rest} Reste -> {stellen}")
    return datei, h


def main():
    p = argparse.ArgumentParser(); p.add_argument("--pruefen", action="store_true")
    a = p.parse_args()
    prof = json.loads((DATEN / "umland-profile.json").read_text(encoding="utf-8"))
    brw = json.loads((DATEN / "umland-bodenrichtwerte.json").read_text(encoding="utf-8"))
    vorlage = VORLAGE.read_text(encoding="utf-8")
    n = 0
    for k, v in prof.items():
        if k.startswith("_"): continue
        b = brw.get(v["_stadt"])
        if not b:
            print(f"  {k}: keine Bodenrichtwerte, uebersprungen"); continue
        datei, html = bauen(k, v, b, vorlage)
        if not a.pruefen:
            (WURZEL / datei).write_text(html, encoding="utf-8")
        print(f"  {datei}  ({len(html)//1024} KB)")
        n += 1
    print(f"{n} Seiten {'geprueft' if a.pruefen else 'geschrieben'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
