#!/usr/bin/env python3
"""
Verkaufte Objekte aus Propstack holen und fest in die Seite schreiben.

WARUM DIESES WERKZEUG EXISTIERT
-------------------------------
Die Referenzseite hat ihre Objekte frueher erst im Browser nachgeladen. Das
hatte zwei Folgen: Google sah eine leere Seite, und sobald Propstack nicht
erreichbar war oder ein Objekt dort verschwand, war die Referenz weg. Beides
ist fuer eine Seite, die Vertrauen belegen soll, das Gegenteil des Ziels.

Deshalb liegen die Objekte jetzt als Momentaufnahme im Projekt:
  - die Daten in  src/data/verkaufte-objekte.json
  - die Bilder in assets/img/referenz-objekt-*.jpg|webp  (selbst gehostet)
  - die Karten fest im Quelltext von verkaufte-objekte.html

WAS BEWUSST NICHT ANGEZEIGT WIRD
--------------------------------
  - Die Strassenadresse. Propstack liefert sie ("Rodderweg 50"), aber das sind
    verkaufte Privatimmobilien. Ort und Stadtteil genuegen als Referenz.
  - Der Preis. Propstack fuehrt den ANGEBOTSpreis, nicht den erzielten Preis.
    Ihn als Verkaufserfolg auszuweisen waere eine Behauptung ins Blaue
    (§ 5a UWG). Dieselbe Regel gilt schon in sold-highlights.json.
  - Die Propstack-Titel. Dort steht Vermarktungstext bis hin zu
    Preisnachlaessen ("Von 149.000,-Euro auf 125.000,-Euro"). Die Ueberschrift
    wird stattdessen aus Objektart und Ort gebildet.
  - Verkaufsdauer oder Interessentenzahlen. Nur wenn sie in
    sold-highlights.json bestaetigt hinterlegt sind, ergaenzt das Skript sie.

BENUTZUNG
---------
    python3 tools/verkaufte-objekte-aktualisieren.py

Ohne Argumente holt es die Live-Daten von high-seller.de, laedt fehlende
Bilder nach und schreibt JSON und HTML neu. Danach die Aenderung ansehen,
insbesondere die Stadtteile, und committen.

    --quelle datei.json   stattdessen aus einer lokalen Antwort lesen
    --nur-html            nichts neu holen, nur den HTML-Block neu bauen

STADTTEILE
----------
Propstack fuellt das Feld "district" unzuverlaessig: mal leer, mal steht das
Bundesland darin ("Nordrhein-Westfalen"), mal der Ort selbst. Deshalb pflegt
die JSON-Datei unter "kuratiert" je Objekt einen geprueften Stadtteil. Kommt
ein neues Objekt hinzu, meldet das Skript es und traegt zunaechst nichts ein;
der Stadtteil ist dann von Hand aus dem Propstack-Titel zu ergaenzen.
"""

import argparse
import io
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUELLE = "https://high-seller.de/.netlify/functions/propstack-sold-properties"
DATEN = os.path.join(ROOT, "src", "data", "verkaufte-objekte.json")
SEITE = os.path.join(ROOT, "verkaufte-objekte.html")
BILDER = os.path.join(ROOT, "assets", "img")
HIGHLIGHTS = os.path.join(ROOT, "src", "data", "sold-highlights.json")

ANFANG = "<!-- VERKAUFTE-OBJEKTE:ANFANG -->"
ENDE = "<!-- VERKAUFTE-OBJEKTE:ENDE -->"
BREITEN = (480, 960)

NEUTRAL = "Erfolgreich durch Highseller Immobilien &amp; Finanzen vermittelt."


# --- Hilfen ---------------------------------------------------------------

def esc(s):
    return (str(s or "").replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def zahl(n):
    """1234.5 -> '1.234,5' ; 61.41 -> '61' (Wohnflaechen ohne Nachkomma)."""
    if n is None:
        return None
    n = round(float(n))
    return f"{n:,}".replace(",", ".")


def slug(s):
    s = str(s or "").lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        s = s.replace(a, b)
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s)).strip("-")


def ort(rec):
    """Köln + Nippes -> 'Köln-Nippes'. Ohne Stadtteil nur den Ort."""
    stadt, teil = rec["ort"], rec.get("stadtteil")
    if not teil or teil == stadt:
        return stadt
    return f"{stadt}-{teil}"


# --- Daten holen ----------------------------------------------------------

def laden(url, timeout=60):
    """Bytes von einer URL holen.

    urllib nutzt unter macOS haeufig einen Zertifikatsspeicher, den eine per
    python.org installierte Fassung nicht kennt ("CERTIFICATE_VERIFY_FAILED").
    Statt das Werkzeug daran scheitern zu lassen, faellt es dann auf curl
    zurueck, das auf jedem Mac vorhanden ist.
    """
    req = urllib.request.Request(url, headers={"User-Agent": "highseller-sync"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except urllib.error.URLError as e:
        if "CERTIFICATE_VERIFY" not in str(e.reason):
            raise
        import subprocess
        p = subprocess.run(["curl", "-sSL", "--max-time", str(timeout), url],
                           capture_output=True)
        if p.returncode != 0:
            raise RuntimeError(f"curl scheiterte: {p.stderr.decode()[:200]}") from e
        return p.stdout


def hole(pfad=None):
    if pfad:
        with open(pfad, encoding="utf-8") as fh:
            return json.load(fh)
    return json.loads(laden(QUELLE, 45).decode("utf-8"))


def lade_bestand():
    if os.path.exists(DATEN):
        with open(DATEN, encoding="utf-8") as fh:
            return json.load(fh)
    return {"kuratiert": {}, "objekte": []}


def bild_holen(url, basis):
    """Laedt das Bild und legt JPEG plus WebP in zwei Breiten ab."""
    from PIL import Image

    jpg = os.path.join(BILDER, basis + ".jpg")
    if os.path.exists(jpg):
        return False
    im = Image.open(io.BytesIO(laden(url))).convert("RGB")
    # 16:11 zuschneiden, das ist das Seitenverhaeltnis der Karte (.listing__img)
    zb, zh = 16, 11
    b, h = im.size
    if b / h > zb / zh:
        neu = int(h * zb / zh)
        im = im.crop(((b - neu) // 2, 0, (b + neu) // 2, h))
    else:
        neu = int(b * zh / zb)
        im = im.crop((0, (h - neu) // 2, b, (h + neu) // 2))
    im.resize((1280, 880), Image.LANCZOS).save(jpg, "JPEG", quality=82, optimize=True)
    for w in BREITEN:
        im.resize((w, round(w * zh / zb)), Image.LANCZOS).save(
            os.path.join(BILDER, f"{basis}-{w}.webp"), "WEBP", quality=80, method=6
        )
    return True


# --- Aufbereiten ----------------------------------------------------------

def aufbereiten(roh, kuratiert, hole_bilder=True):
    objekte, neu = [], []
    for p in roh:
        pid = str(p.get("id"))
        k = kuratiert.get(pid, {})
        if pid not in kuratiert:
            neu.append((pid, p.get("title", "")))

        stadtteil = k.get("stadtteil")
        if stadtteil is None:
            # Propstack-Feld nur uebernehmen, wenn es plausibel ist.
            d = (p.get("district") or "").strip()
            stadtteil = d if d and d not in ("Nordrhein-Westfalen", p.get("city")) else ""

        rec = {
            "id": pid,
            "objektart": k.get("objektart") or p.get("objectType") or "Immobilie",
            "ort": p.get("city") or "",
            "stadtteil": stadtteil,
            "wohnflaeche": p.get("livingSpace"),
            "grundstueck": p.get("plotArea"),
            "zimmer": p.get("rooms"),
            "baujahr": p.get("constructionYear"),
            "energieklasse": ((p.get("energy") or {}).get("class") or ""),
        }
        basis = f"referenz-objekt-{slug(rec['objektart'])}-{slug(ort(rec))}-{pid}"
        rec["bild"] = basis

        bilder = p.get("images") or []
        if hole_bilder and bilder and bilder[0].get("url"):
            try:
                if bild_holen(bilder[0]["url"], basis):
                    print(f"  Bild geladen: {basis}")
            except Exception as e:  # Bild fehlt -> Karte zeigt Platzhalter
                print(f"  WARNUNG Bild {pid}: {e}", file=sys.stderr)
        if not os.path.exists(os.path.join(BILDER, basis + ".jpg")):
            rec["bild"] = ""
        objekte.append(rec)

    objekte.sort(key=lambda r: (r["ort"], r.get("stadtteil") or "", r["id"]))
    return objekte, neu


# --- HTML -----------------------------------------------------------------

def karte(rec, hl):
    o = ort(rec)
    titel = f"{rec['objektart']} in {o}"
    art = "Verkauft" if rec["objektart"] else "Verkauft"

    if rec["bild"]:
        b = rec["bild"]
        bild = (
            '<picture>'
            f'<source type="image/webp" srcset="assets/img/{b}-480.webp 480w, assets/img/{b}-960.webp 960w" '
            'sizes="(max-width:760px) 92vw, (max-width:980px) 46vw, 380px">'
            # Bewusst nachgestellt formuliert: "Verkaufte Haus" waere falsch,
            # und die Objektarten haben unterschiedliche Geschlechter.
            f'<img src="assets/img/{b}.jpg" alt="{esc(titel + ", von Highseller Immobilien verkauft")}" '
            'loading="lazy" decoding="async" width="1280" height="880">'
            '</picture>'
        )
    else:
        bild = ('<div class="listing__noimg">'
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">'
                '<path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M9 11h.01M15 11h.01"/></svg>'
                '<span>Ohne Foto</span></div>')

    fakten = []
    if rec.get("wohnflaeche"):
        fakten.append((zahl(rec["wohnflaeche"]) + " m²", "Wohnfläche"))
    if rec.get("zimmer"):
        z = rec["zimmer"]
        fakten.append((str(int(z)) if float(z).is_integer() else str(z).replace(".", ","), "Zimmer"))
    if rec.get("grundstueck"):
        fakten.append((zahl(rec["grundstueck"]) + " m²", "Grundstück"))
    if rec.get("baujahr"):
        fakten.append((str(rec["baujahr"]), "Baujahr"))
    fakten = fakten[:3]
    fakten_html = "".join(f"<div><b>{esc(v)}</b>{esc(l)}</div>" for v, l in fakten)

    # Konkrete Erfolgsangaben nur, wenn in sold-highlights.json bestaetigt.
    h = hl.get(rec["id"]) or {}
    bestaetigt = h.get("verified") is True
    zeile = esc(h["resultText"].strip()) if bestaetigt and h.get("resultText", "").strip() else NEUTRAL
    abzeichen = ""
    if bestaetigt and isinstance(h.get("soldInDays"), int) and h["soldInDays"] > 0:
        abzeichen = f'<span class="listing__success-badge">In {h["soldInDays"]} Tagen verkauft</span>'

    haken = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">'
             '<path d="M20 6L9 17l-5-5"/></svg>')
    # Propstack liefert die Klasse als Schluessel ("A_PLUS"), nicht als Anzeige.
    ek = {"A_PLUS": "A+"}.get(rec.get("energieklasse", ""), rec.get("energieklasse", ""))
    energie = (f'<p class="listing__place">Energieklasse {esc(ek)}</p>' if ek else "")

    return (
        '<article class="listing listing--sold">'
        f'<div class="listing__img"><span class="listing__badge listing__badge--sold">{art}</span>{bild}</div>'
        '<div class="listing__body">'
        f'<span class="listing__type">{esc(rec["objektart"])}</span>'
        f'<h3 class="listing__title">{esc(titel)}</h3>'
        # Keine eigene Ortszeile: der Ort steht bereits in der Ueberschrift,
        # eine Wiederholung direkt darunter liest sich wie ein Fehler.
        f'{energie}'
        + (f'<div class="listing__facts">{fakten_html}</div>' if fakten_html else "")
        + f'<div class="listing__success{" is-verified" if bestaetigt else ""}">{abzeichen}'
        f'<p class="listing__success-line">{haken}<span>{zeile}</span></p></div>'
        '</div></article>'
    )


def schema(objekte):
    """ItemList, damit Google die Referenzen als Liste erfassen kann."""
    eintraege = []
    for i, r in enumerate(objekte, 1):
        e = {
            "@type": "ListItem",
            "position": i,
            "item": {
                "@type": "Residence",
                "name": f"{r['objektart']} in {ort(r)}",
                "address": {"@type": "PostalAddress", "addressLocality": r["ort"],
                            "addressRegion": "NRW", "addressCountry": "DE"},
            },
        }
        if r.get("stadtteil"):
            e["item"]["address"]["addressLocality"] = f"{r['ort']}-{r['stadtteil']}"
        if r.get("wohnflaeche"):
            e["item"]["floorSize"] = {"@type": "QuantitativeValue",
                                      "value": round(float(r["wohnflaeche"])), "unitCode": "MTK"}
        if r.get("zimmer"):
            e["item"]["numberOfRooms"] = r["zimmer"]
        eintraege.append(e)
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Verkaufte Immobilien von Highseller Immobilien & Finanzen",
        "numberOfItems": len(objekte),
        "itemListElement": eintraege,
    }, ensure_ascii=False, separators=(", ", ": "))


def block(objekte, hl):
    karten = "".join(karte(r, hl) for r in objekte)
    orte = sorted({r["ort"] for r in objekte})
    orte_txt = ", ".join(orte[:-1]) + " und " + orte[-1] if len(orte) > 1 else orte[0]
    stand = (f'<p class="hint" style="margin-top:18px">{len(objekte)} vermittelte Objekte in '
             f'{esc(orte_txt)}. Weitere Referenzen nennen wir auf Anfrage, '
             'soweit die früheren Eigentümer der Nennung zugestimmt haben.</p>')
    return (
        f'{ANFANG}\n'
        '<!-- Fest im Quelltext, absichtlich. Erzeugt von\n'
        '     tools/verkaufte-objekte-aktualisieren.py - nicht von Hand aendern,\n'
        '     sonst ist die Aenderung beim naechsten Lauf wieder weg. -->\n'
        f'<div class="listings listings--3" data-sold-static>{karten}</div>\n'
        f'{stand}\n'
        f'<script type="application/ld+json">{schema(objekte)}</script>\n'
        f'{ENDE}'
    )


# --- Hauptlauf ------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quelle")
    ap.add_argument("--nur-html", action="store_true")
    a = ap.parse_args()

    bestand = lade_bestand()
    kuratiert = bestand.get("kuratiert", {})

    if a.nur_html:
        objekte = bestand["objekte"]
        neu = []
    else:
        antwort = hole(a.quelle)
        if not antwort.get("ok"):
            print("Propstack antwortet nicht wie erwartet, nichts geaendert.", file=sys.stderr)
            return 1
        roh = antwort.get("properties") or []
        if not roh:
            print("Keine verkauften Objekte geliefert, nichts geaendert.", file=sys.stderr)
            return 1
        print(f"{len(roh)} verkaufte Objekte aus Propstack.")
        objekte, neu = aufbereiten(roh, kuratiert)

        neu_bestand = {"_hinweis": bestand.get("_hinweis") or HINWEIS}
        # Erlaeuternde Schluessel (_...) unveraendert mitnehmen, sie sind die
        # Pflegeanleitung fuer den naechsten Menschen.
        for k, v in bestand.items():
            if k.startswith("_") and k != "_hinweis":
                neu_bestand[k] = v
        neu_bestand["kuratiert"] = kuratiert
        neu_bestand["objekte"] = objekte
        bestand = neu_bestand
        with open(DATEN, "w", encoding="utf-8") as fh:
            json.dump(bestand, fh, ensure_ascii=False, indent=2)
            fh.write("\n")

    hl = {}
    if os.path.exists(HIGHLIGHTS):
        with open(HIGHLIGHTS, encoding="utf-8") as fh:
            hl = (json.load(fh).get("highlights") or {})

    seite = open(SEITE, encoding="utf-8").read()
    if ANFANG not in seite:
        print(f"Marker {ANFANG} fehlt in verkaufte-objekte.html", file=sys.stderr)
        return 1
    neu_html = block(objekte, hl)
    seite = re.sub(re.escape(ANFANG) + r".*?" + re.escape(ENDE), lambda _: neu_html, seite, flags=re.S)
    open(SEITE, "w", encoding="utf-8").write(seite)

    print(f"{len(objekte)} Karten in verkaufte-objekte.html geschrieben.")
    for pid, titel in neu:
        print(f"  NEU ohne geprueften Stadtteil: {pid} — {titel[:70]}")
    if neu:
        print('  -> Stadtteil in verkaufte-objekte.json unter "kuratiert" ergaenzen,'
              ' dann erneut laufen lassen.')
    return 0


HINWEIS = (
    "Momentaufnahme der von Propstack als 'Verkauft' gefuehrten Objekte. "
    "Erzeugt von tools/verkaufte-objekte-aktualisieren.py. Diese Datei ist die "
    "dauerhafte Quelle der Referenzseite: sie bleibt gueltig, auch wenn "
    "Propstack nicht erreichbar ist oder ein Objekt dort geloescht wird. "
    "Bewusst NICHT enthalten: Strassenadresse (verkaufte Privatimmobilien) und "
    "Preis (Propstack fuehrt den Angebots-, nicht den erzielten Preis). "
    "'kuratiert' haelt je Objekt-ID gepruefte Angaben fest, die Propstack "
    "unzuverlaessig liefert - vor allem den Stadtteil."
)

if __name__ == "__main__":
    sys.exit(main())
