#!/usr/bin/env python3
"""Die beiden Kaufseiten erzeugen: Wohnung kaufen und Haus kaufen in Koeln.

Kern beider Seiten ist eine Preisuebersicht ueber alle Koelner Stadtteile, fuer
die der Gutachterausschuss notarielle Kaufpreise ausweist - 79 Stadtteile,
3.374 Vertraege des Jahres 2025. Das ist der eigentliche Mehrwert gegenueber
Portalen, die Angebotspreise zeigen.

Die Seiten konkurrieren bewusst NICHT mit immobilie-verkaufen.html und
immobilie-bewerten.html: Sie sprechen Kaufinteressenten an und verweisen auf
Kaeuferkartei und Angebote.

Aufruf:  python3 tools/stadtteildaten/kaufseiten.py [--pruefen]
"""
import argparse, json, re, sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
DATEN = WURZEL / "src" / "data"
VORLAGE = WURZEL / "immobilienmakler-koeln-nippes.html"


def zahl(w, n=0):
    return f"{w:,.{n}f}".replace(",", "#").replace(".", ",").replace("#", ".")


def slug(name):
    s = name.lower()
    for a, b in (("ä","ae"),("ö","oe"),("ü","ue"),("ß","ss"),("/","-"),(" ","-")):
        s = s.replace(a, b)
    return s


SEITEN = {
 "wohnung-kaufen-koeln": {
  "titel": "Wohnung kaufen in Köln | Preise nach Stadtteil",
  "h1": "Wohnung kaufen in Köln",
  "besch": "Eigentumswohnung in Köln kaufen: notarielle Kaufpreise für 79 Stadtteile, "
           "Ablauf, Nebenkosten und Finanzierung aus einer Hand.",
  "art": "Wohnung", "artPl": "Wohnungen",
 },
 "haus-kaufen-koeln": {
  "titel": "Haus kaufen in Köln | Lagen, Preise und Ablauf",
  "h1": "Haus kaufen in Köln",
  "besch": "Haus in Köln kaufen: Bodenrichtwerte aller Stadtteile, worauf es beim "
           "Grundstück ankommt, Nebenkosten und Finanzierung aus einer Hand.",
  "art": "Haus", "artPl": "Häuser",
 },
}


def preistabelle(kp, wohnung=True):
    """Preisuebersicht als Liste. Bewusst vollstaendig statt Top-10: Wer sucht,
    sucht seinen Stadtteil, nicht die Rangliste."""
    werte = sorted(((v["Weiterverkauf"]["eurProM2"], v["Weiterverkauf"]["faelle"],
                     v["_stadtteil"], k)
                    for k, v in kp.items()
                    if not k.startswith("_") and "Weiterverkauf" in v), reverse=True)
    zeilen = "".join(
        f'<div><dt><a href="immobilienmakler-koeln-{k}.html">{n}</a></dt>'
        f'<dd><b>{zahl(p)} €/m²</b><span>{zahl(f)} Kaufverträge</span></dd></div>'
        for p, f, n, k in werte)
    return zeilen, len(werte), sum(f for _, f, _, _ in werte), werte


def bauen(kuerzel, cfg, kp, brw, vorlage):
    datei = f"{kuerzel}.html"
    zeilen, anzahl, vertraege, werte = preistabelle(kp)
    teuer, guenstig = werte[0], werte[-1]
    art, artPl = cfg["art"], cfg["artPl"]

    einleitung = (
        f"Wer in Köln eine {art.lower()} kaufen will, findet in Portalen Angebotspreise. "
        f"Was tatsächlich gezahlt wurde, steht woanders: im Grundstücksmarktbericht des "
        f"Gutachterausschusses. Für {anzahl} Kölner Stadtteile liegen dort notarielle "
        f"Kaufpreise aus {zahl(vertraege)} Verträgen des Jahres 2025 vor. Diese Zahlen "
        f"finden Sie hier — und wir ordnen sie für Ihr Vorhaben ein.")

    spanne = (
        f"Die Spanne ist erheblich: von {zahl(guenstig[0])} € je m² Wohnfläche in "
        f"{guenstig[2]} bis {zahl(teuer[0])} € in {teuer[2]}. Das ist ein Faktor von fast "
        f"vier innerhalb einer Stadt. Wer flexibel ist, was den Stadtteil angeht, "
        f"verändert sein Budget stärker als durch jede Verhandlung.")

    if art == "Haus":
        besonders = (
            "Bei Häusern kommt der Grundstückswert hinzu, der sich nicht aus dem "
            "Quadratmeterpreis der Wohnfläche ableiten lässt. Maßgeblich ist der "
            "amtliche Bodenrichtwert der jeweiligen Zone, Stichtag 1. Januar 2026. Ein "
            "Haus mit 500 m² Grund in einer Lage mit 1.200 € Bodenrichtwert trägt allein "
            "im Boden 600.000 € — unabhängig vom Zustand des Gebäudes. Deshalb prüfen "
            "wir bei Häusern immer beides: Bodenwert und Gebäudewert.")
    else:
        besonders = (
            "Bei Eigentumswohnungen entscheidet neben Lage und Zustand die "
            "Teilungserklärung mit: Sie regelt Sondereigentum, Gemeinschaftseigentum und "
            "Stimmrechte. Ebenso wichtig sind die Protokolle der Eigentümerversammlungen "
            "der letzten Jahre und der Stand der Instandhaltungsrücklage. Eine günstige "
            "Wohnung in einer sanierungsbedürftigen Anlage ist keine günstige Wohnung.")

    nebenkosten = (
        "Zu den Kaufnebenkosten in Nordrhein-Westfalen: 6,5 % Grunderwerbsteuer, "
        "Notar und Grundbuch zusammen etwa 1,5 bis 2 %, dazu die Maklerprovision, die "
        "sich Käufer und Verkäufer seit Dezember 2020 bei Wohnimmobilien teilen. In "
        "Summe sind das rund 10 % des Kaufpreises, die zusätzlich zum Eigenkapital "
        "bereitstehen müssen — Banken finanzieren die Nebenkosten in aller Regel nicht mit.")

    finanzierung = (
        "Wir sind nicht nur Makler, sondern haben auch die Erlaubnis als "
        "Darlehensvermittler nach § 34i GewO. Das heißt: Sie können Objektsuche und "
        "Finanzierung an einer Stelle klären, statt zwischen Makler und Bank zu "
        "pendeln. Praktisch wichtig ist das beim Tempo — wer eine belastbare "
        "Finanzierungszusage hat, ist bei begehrten Objekten im Vorteil.")

    h = vorlage
    ers = [
        (r'<title>.*?</title>', f'<title>{cfg["titel"]}</title>'),
        (r'(<meta name="description" content=")[^"]*(")', rf'\1{cfg["besch"]}\2'),
        (r'(<meta property="og:title" content=")[^"]*(")', rf'\1{cfg["titel"]}\2'),
        (r'(<meta property="og:description" content=")[^"]*(")', rf'\1{cfg["besch"]}\2'),
        (r'(<meta name="twitter:title" content=")[^"]*(")', rf'\1{cfg["titel"]}\2'),
        (r'(<meta name="twitter:description" content=")[^"]*(")', rf'\1{cfg["besch"]}\2'),
        (r'(<link rel="canonical" href="https://high-seller\.de/)[^"]*(">)', rf'\1{datei}\2'),
        (r'(<meta property="og:url" content="https://high-seller\.de/)[^"]*(">)', rf'\1{datei}\2'),
        (r'(› )Köln-Nippes(</div>)', rf'\1{cfg["h1"]}\2'),
        (r'<h1>Immobilienmakler in Köln-Nippes</h1><p>.*?</p>',
         f'<h1>{cfg["h1"]}</h1><p>{einleitung}</p>'),
        (r'<h2>Immobilien in Nippes: Lage &amp; Markt</h2>\n(\s*)<p>.*?</p>\n\s*<p>.*?</p>\n\s*<p>.*?</p>',
         lambda m: (f'<h2>Was {artPl} in Köln kosten</h2>\n'
                    f'{m.group(1)}<p>{spanne}</p>\n{m.group(1)}<p>{besonders}</p>\n'
                    f'{m.group(1)}<p>{nebenkosten}</p>')),
        (r'(<div class="prose reveal"><p>).*?(</p>)',
         lambda m: m.group(1) + f"Notarielle Kaufpreise statt Angebotspreise: {anzahl} "
         f"Kölner Stadtteile, {zahl(vertraege)} Verträge aus dem Jahr 2025." + m.group(2)),
        (r'<h2>Der Immobilienmarkt in Nippes</h2>\n(\s*)<p>.*?</p>',
         lambda m: f'<h2>Finanzierung und Kauf aus einer Hand</h2>\n{m.group(1)}<p>{finanzierung}</p>'),
        (r'(<dl>\n)(?:\s*<div><dt>.*?</div>\n)+(\s*</dl>)',
         lambda m: m.group(1) + zeilen + "\n" + m.group(2)),
        (r'(<h3>Bebauung in Köln-)Nippes(</h3>\n\s*<p>).*?(</p>)',
         lambda m: f'<h3>Ablauf vom Exposé bis zum Notar</h3>\n      <p>'
         "Nach der Besichtigung prüfen wir gemeinsam die Unterlagen: Grundbuchauszug, "
         "Flurkarte, Energieausweis, bei Wohnungen zusätzlich Teilungserklärung, "
         "Protokolle und Wirtschaftsplan. Erst danach folgt das Preisgespräch. Der "
         "Notarvertrag wird vom Notar entworfen, den üblicherweise der Käufer bestimmt; "
         "zwischen Entwurf und Beurkundung müssen bei Verbrauchern zwei Wochen liegen. "
         "Der Kaufpreis wird erst fällig, wenn die Auflassungsvormerkung im Grundbuch "
         "steht und Lastenfreiheit gesichert ist." + m.group(3)),
        (r'(<h3>Lage und Infrastruktur</h3>\n\s*<p>).*?(</p>)',
         lambda m: '<h3>Käuferkartei: vor der Vermarktung erfahren</h3>\n      <p>'
         "Viele Objekte werden verkauft, bevor sie in einem Portal erscheinen. Wer in "
         "unserer Käuferkartei steht, erfährt von passenden Immobilien, sobald sie "
         "vorliegen. Sie hinterlegen einmal Ihre Kriterien — Lage, Größe, Budget — und "
         "wir melden uns, wenn etwas dazu passt." + m.group(2)),
        (r'(<h3>Wohnungsbestand in Zahlen</h3>\n\s*<p>).*?(</p>)',
         lambda m: '<h3>Warum notarielle Preise und keine Angebotspreise?</h3>\n  <p>'
         "Angebotspreise sind Wünsche. Sie stehen in Portalen und werden im Verlauf einer "
         "Vermarktung oft nach unten korrigiert. Notarielle Kaufpreise sind das, was "
         "tatsächlich geflossen ist — erhoben vom Gutachterausschuss für Grundstückswerte "
         "aus jedem beurkundeten Vertrag. Für eine Kaufentscheidung ist das die "
         "belastbarere Grundlage." + m.group(2)),
        (r'<ul class="bullets">.*?</ul>',
         f'<ul class="bullets"><li>Objektsuche im gesamten Kölner Stadtgebiet und Umland</li>'
         '<li>Prüfung der Unterlagen vor dem Preisgespräch</li>'
         '<li>Finanzierung über § 34i GewO aus einer Hand</li>'
         '<li>Begleitung bis zur Schlüsselübergabe</li></ul>'),
        (r'<h3>Immobilie in Köln-Nippes verkaufen oder bewerten\?</h3>',
         f'<h3>{art} in Köln kaufen — wir unterstützen Sie</h3>'),
        (r'(<h2 class="headline">)Immobilienpreise in Köln-Nippes(</h2>)',
         rf'\1Kaufpreise nach Stadtteil\2'),
        (r'<h3>Marktdaten Köln-Nippes</h3>',
         f'<h3>{anzahl} Stadtteile, {zahl(vertraege)} Kaufverträge 2025</h3>'),
        (r'<h3>Warum steigen die Preise in Nippes\?</h3>\n(\s*)<p>.*?</p>',
         lambda m: (f'<h3>Wie viel Eigenkapital brauche ich?</h3>\n{m.group(1)}<p>'
                    "Als Faustregel sollten die Kaufnebenkosten von rund 10 % aus "
                    "Eigenkapital gedeckt sein, dazu möglichst 10 bis 20 % des "
                    "Kaufpreises. Finanzierungen ohne Eigenkapital gibt es, sie sind "
                    "aber teurer und setzen ein sicheres, ausreichendes Einkommen "
                    "voraus. Was in Ihrem Fall geht, rechnen wir konkret durch — "
                    "unser Budgetrechner gibt einen ersten Anhaltspunkt.</p>")),
        (r'<h3>Mehrfamilienhaus in Nippes verkaufen, wie läuft die Bewertung\?</h3>\n(\s*)<p>.*?</p>',
         lambda m: (f'<h3>Kann ich kaufen, bevor ich verkauft habe?</h3>\n{m.group(1)}<p>'
                    "Ja, dafür gibt es die Zwischenfinanzierung: Die neue Immobilie wird "
                    "vorfinanziert und mit dem Erlös aus dem Verkauf abgelöst. Das setzt "
                    "eine belastbare Einschätzung des Verkaufswerts voraus — genau die "
                    "liefern wir, weil wir beide Seiten machen. Die Alternative ist eine "
                    "Rücktrittsklausel im Kaufvertrag, die aber nicht jeder Verkäufer "
                    "akzeptiert.</p>")),
        (r'(<p>)Nippes ist das aufstrebende Veedel im Kölner Norden:.*?(</p>)',
         lambda m: m.group(1) + f"Sie suchen {'eine Wohnung' if art=='Wohnung' else 'ein Haus'} "
         "in Köln? Hinterlegen Sie Ihre Kriterien in unserer Käuferkartei — dann melden "
         "wir uns, sobald etwas Passendes vorliegt." + m.group(2)),
        (r'(<h2 class="headline" style="max-width:24ch">)Immobilienwert in Köln-Nippes ermitteln(</h2>)',
         r'\1Ihre Immobilie verkaufen und neu kaufen\2'),
        (r'(für Ihre Immobilie in )Nippes(\.)', r'\1Köln\2'),
    ]
    for muster, ersatz in ers:
        h, n = re.subn(muster, ersatz, h, flags=re.S)
        if n == 0:
            raise SystemExit(f"{kuerzel}: Muster nicht gefunden -> {str(muster)[:60]}")

    h, n = re.subn(r'(<p style="font-weight:600;color:var\(--ink\);margin-bottom:10px">)'
                   r'Auch tätig im Stadtbezirk Nippes und Umgebung:(</p>\n\s*'
                   r'<div style="display:flex;flex-wrap:wrap;gap:10px">).*?(</div>)',
                   lambda m: (m.group(1) + "Weiter zu:" + m.group(2) +
                              '<a class="btn btn--ghost" href="kaeuferkartei.html">Käuferkartei</a> '
                              '<a class="btn btn--ghost" href="immobilien-angebote.html">Aktuelle Angebote</a> '
                              '<a class="btn btn--ghost" href="baufinanzierungsrechner.html">Finanzierungsrechner</a> '
                              '<a class="btn btn--ghost" href="budget-rechner.html">Budgetrechner</a> '
                              '<a class="btn btn--ghost" href="marktdaten-koeln.html">Marktdaten Köln</a>'
                              + m.group(3)), h, flags=re.S)
    if n == 0:
        raise SystemExit(f"{kuerzel}: Verweisleiste nicht gefunden")

    h = h.replace("immobilienmakler-koeln-nippes.html", datei)
    h = h.replace("Köln-Nippes", "Köln").replace("Köln Nippes", "Köln")
    # Die Preistabelle listet alle Stadtteile, Nippes eingeschlossen - dort ist
    # der Name richtig und kein Rest der Vorlage. Vor der Pruefung entfernen.
    pruef = re.sub(r"<dl>.*?</dl>", "", h, flags=re.S)
    rest = pruef.count("Nippes")
    if rest:
        raise SystemExit(f"{kuerzel}: {rest} Reste -> "
                         f"{[z.strip()[:100] for z in pruef.split(chr(10)) if 'Nippes' in z][:2]}")
    return datei, h


def main():
    p = argparse.ArgumentParser(); p.add_argument("--pruefen", action="store_true")
    a = p.parse_args()
    kp = json.loads((DATEN / "stadtteile-kaufpreise.json").read_text(encoding="utf-8"))
    brw = json.loads((DATEN / "stadtteile-bodenrichtwerte.json").read_text(encoding="utf-8"))
    vorlage = VORLAGE.read_text(encoding="utf-8")
    for k, cfg in SEITEN.items():
        datei, html = bauen(k, cfg, kp, brw, vorlage)
        if not a.pruefen:
            (WURZEL / datei).write_text(html, encoding="utf-8")
        print(f"  {datei}  ({len(html)//1024} KB)")
    print(f"{len(SEITEN)} Seiten {'geprueft' if a.pruefen else 'geschrieben'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
