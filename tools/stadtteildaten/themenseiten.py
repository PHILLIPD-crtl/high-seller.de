#!/usr/bin/env python3
"""Themenseiten aus Fachinhalten erzeugen.

Anders als die Stadtteilseiten tragen diese Seiten keinen Datensatz, sondern
Fachwissen: Was bei dieser Objektart, diesem Anlass oder dieser Kostenfrage
tatsaechlich ueber den Preis entscheidet. Die Inhalte stehen in
src/data/themenseiten-*.json und sind Handarbeit - hier wird nichts erzeugt,
was inhaltlich stimmen muss.

Die Vorlage liefert nur das Geruest: Kopf, Fuss, Wertrechner, Cookie-Banner.

Aufruf:  python3 tools/stadtteildaten/themenseiten.py [--pruefen]
"""
import argparse, glob, json, re, sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
DATEN = WURZEL / "src" / "data"
VORLAGE = WURZEL / "immobilienmakler-koeln-nippes.html"


def bauen(kuerzel, c, vorlage):
    datei = f"{kuerzel}.html"
    h = vorlage
    ers = [
        (r'<title>.*?</title>', f'<title>{c["titel"]}</title>'),
        (r'(<meta name="description" content=")[^"]*(")', rf'\1{c["besch"]}\2'),
        (r'(<meta property="og:title" content=")[^"]*(")', rf'\1{c["titel"]}\2'),
        (r'(<meta property="og:description" content=")[^"]*(")', rf'\1{c["besch"]}\2'),
        (r'(<meta name="twitter:title" content=")[^"]*(")', rf'\1{c["titel"]}\2'),
        (r'(<meta name="twitter:description" content=")[^"]*(")', rf'\1{c["besch"]}\2'),
        (r'(<link rel="canonical" href="https://high-seller\.de/)[^"]*(">)', rf'\1{datei}\2'),
        (r'(<meta property="og:url" content="https://high-seller\.de/)[^"]*(">)', rf'\1{datei}\2'),
        (r'(› )Köln-Nippes(</div>)', rf'\1{c["h1"]}\2'),
        (r'<h1>Immobilienmakler in Köln-Nippes</h1><p>.*?</p>',
         f'<h1>{c["h1"]}</h1><p>{c["kurz"]}</p>'),
        (r'<h2>Immobilien in Nippes: Lage &amp; Markt</h2>\n(\s*)<p>.*?</p>\n\s*<p>.*?</p>\n\s*<p>.*?</p>',
         lambda m: (f'<h2>{c["h1"]}: worauf es ankommt</h2>\n'
                    f'{m.group(1)}<p>{c["a1"]}</p>\n{m.group(1)}<p>{c["a2"]}</p>\n'
                    f'{m.group(1)}<p>{c["a3"]}</p>')),
        (r'(<div class="prose reveal"><p>).*?(</p>)', lambda m: m.group(1) + c["kurz"] + m.group(2)),
        (r'<h2>Der Immobilienmarkt in Nippes</h2>\n(\s*)<p>.*?</p>',
         lambda m: (f'<h2>Verkauf und Finanzierung aus einer Hand</h2>\n{m.group(1)}<p>'
                    "Wir sind Immobilienmakler nach § 34c GewO und zugleich "
                    "Darlehensvermittler nach § 34i GewO. Das heißt für Sie: Wir erkennen "
                    "früh, welche Interessenten realistisch finanzieren können, statt eine "
                    "Zusage abzuwarten, die nicht kommt. Das spart Besichtigungen und "
                    "verkürzt die Zeit bis zum Notartermin.</p>")),
        (r'(<h3>Wohnungsbestand in Zahlen</h3>\n\s*<p>).*?(</p>)',
         lambda m: '<h3>Was wir für Sie übernehmen</h3>\n  <p>'
         "Bewertung, Unterlagenbeschaffung, Exposé, Vermarktung, Besichtigungen mit "
         "geprüften Interessenten, Verhandlung, Notartermin und Übergabe. Die "
         "Ersteinschätzung ist kostenlos und unverbindlich — sie verpflichtet Sie zu "
         "nichts." + m.group(2)),
        # Kennzahlenkacheln entfallen auf Themenseiten - der ganze Block wird ersetzt
        (r'<div class="marktdaten">.*?</div>\n\s*</div>',
         lambda m: (f'<div class="stadtteil-profil">\n      <h3>{c["faq1_f"]}</h3>\n'
                    f'      <p>{c["faq1_a"]}</p>\n      <h3>{c["faq2_f"]}</h3>\n'
                    f'      <p>{c["faq2_a"]}</p>\n    </div>')),
        (r'<ul class="bullets">.*?</ul>',
         f'<ul class="bullets"><li>{c["bullet1"]}</li><li>{c["bullet2"]}</li>'
         f'<li>{c["bullet3"]}</li><li>Kostenlose Ersteinschätzung, unverbindlich</li></ul>'),
        (r'<h3>Immobilie in Köln-Nippes verkaufen oder bewerten\?</h3>',
         f'<h3>{c["h1"]}? Wir schätzen kostenlos ein</h3>'),
        (r'(<h2 class="headline">)Immobilienpreise in Köln-Nippes(</h2>)',
         rf'\1Häufige Fragen\2'),
        (r'(<p>)Nippes ist das aufstrebende Veedel im Kölner Norden:.*?(</p>)',
         lambda m: m.group(1) + c["kurz"] + " Für eine erste Einschätzung genügen wenige "
         "Angaben — kostenlos und unverbindlich." + m.group(2)),
        (r'(<h2 class="headline" style="max-width:24ch">)Immobilienwert in Köln-Nippes ermitteln(</h2>)',
         r'\1Wert Ihrer Immobilie ermitteln\2'),
        (r'(für Ihre Immobilie in )Nippes(\.)', r'\1Köln\2'),
    ]
    for muster, ersatz in ers:
        h, n = re.subn(muster, ersatz, h, flags=re.S)
        if n == 0:
            raise SystemExit(f"{kuerzel}: Muster nicht gefunden -> {str(muster)[:70]}")

    h, n = re.subn(r'(<p style="font-weight:600;color:var\(--ink\);margin-bottom:10px">)'
                   r'Auch tätig im Stadtbezirk Nippes und Umgebung:(</p>\n\s*'
                   r'<div style="display:flex;flex-wrap:wrap;gap:10px">).*?(</div>)',
                   lambda m: (m.group(1) + "Passend dazu:" + m.group(2) +
                              '<a class="btn btn--ghost" href="immobilie-verkaufen.html">Immobilie verkaufen</a> '
                              '<a class="btn btn--ghost" href="immobilie-bewerten.html">Bewertung</a> '
                              '<a class="btn btn--ghost" href="unterlagen-checkliste.html">Unterlagen</a> '
                              '<a class="btn btn--ghost" href="marktdaten-koeln.html">Marktdaten Köln</a> '
                              '<a class="btn btn--ghost" href="immobilienmakler-koeln.html">Stadtteile</a>'
                              + m.group(3)), h, flags=re.S)
    if n == 0:
        raise SystemExit(f"{kuerzel}: Verweisleiste nicht gefunden")

    h = h.replace("immobilienmakler-koeln-nippes.html", datei)
    h = h.replace("Köln-Nippes", "Köln").replace("Köln Nippes", "Köln")
    if h.count("Nippes"):
        raise SystemExit(f"{kuerzel}: Reste -> "
                         f"{[z.strip()[:100] for z in h.split(chr(10)) if 'Nippes' in z][:2]}")
    return datei, h


def main():
    p = argparse.ArgumentParser(); p.add_argument("--pruefen", action="store_true")
    a = p.parse_args()
    vorlage = VORLAGE.read_text(encoding="utf-8")
    n = 0
    for pfad in sorted(glob.glob(str(DATEN / "themenseiten-*.json"))):
        for k, c in json.loads(Path(pfad).read_text(encoding="utf-8")).items():
            if k.startswith("_"): continue
            datei, html = bauen(k, c, vorlage)
            if not a.pruefen:
                (WURZEL / datei).write_text(html, encoding="utf-8")
            print(f"  {datei}  ({len(html)//1024} KB)")
            n += 1
    print(f"{n} Seiten {'geprueft' if a.pruefen else 'geschrieben'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
