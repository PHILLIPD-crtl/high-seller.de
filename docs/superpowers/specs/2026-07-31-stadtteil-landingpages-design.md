# Stadtteil-Landingpages und Kaufseiten — Entwurf

Stand: 31.07.2026 · Branch `feature/stadtteil-landingpages`

## Ziel

high-seller.de soll für mehr Kölner Stadtteile und für Kaufinteressenten
gefunden werden. Konkret:

1. 63 zusätzliche Stadtteilseiten (heute 20, Zielbestand 83)
2. Umbau der bestehenden Innenstadt-Seite zur Bezirksübersicht
3. Zwei Kaufseiten: „Wohnung kaufen Köln" und „Haus kaufen Köln"

Harte Randbedingung: **keine Duplikation**. Die bestehenden 20 Seiten lagen
anfangs bei 41,6 % Textduplikation; sie wurden mit amtlichen Daten auf 8,9 %
gedrückt, kein Seitenpaar über 20 %. Dieser Wert ist die Messlatte für die
neuen Seiten.

## Ausgangslage

- 20 Stadtteilseiten `immobilienmakler-koeln-*.html`, je rund 32 KB, statisches
  HTML, etwa 582 Wörter redaktioneller Text
- Aufbau je Seite: H1, dann H2 „Lage & Markt", „Der Immobilienmarkt in …",
  FAQ, „Immobilienwert ermitteln", Abschluss-Aufruf
- Zahlen stehen **fest im Quelltext**, nicht per JavaScript nachgeladen.
  `src/data/stadtteile-marktdaten.json` und `stadtteile-wohnkennzahlen.json`
  sind Datenablage für die redaktionelle Arbeit, nicht Laufzeitquelle.
- **Kein Generator im Repo.** Die 20 Seiten wurden außerhalb erzeugt oder von
  Hand gepflegt; das Werkzeug fehlt.
- Daten liegen für genau die 20 bestehenden Stadtteile vor, für alle 63 neuen
  fehlen sie vollständig.

## Architektur

Drei getrennte Einheiten. Jede ist für sich prüfbar und hat eine Aufgabe.

### 1. Datenpipeline — `tools/stadtteildaten/`

Je Quelle ein Skript, Ausgabe nach `src/data/`. Die Skripte kommen ins
Repository, damit die Zahlen im Folgejahr mit einem Befehl aktualisierbar sind
statt erneut von Hand.

| Skript | Quelle | Ausgabe |
|---|---|---|
| `bodenrichtwerte.py` | BORIS NRW, `BRW_2026_Polygon` (Shapefile) | Spanne, Median, Zonenzahl je Stadtteil |
| `wohnkennzahlen.py` | offenedaten-koeln.de, Statistischer Datenkatalog (CSV) | Einwohner, Wohnungen, Wohnfläche, Haushalte, Fertigstellungen, Förderquote |
| `kaufpreise.py` | Grundstücksmarktbericht Köln, Gutachterausschuss | Wiederverkauf und Neubau je m², mit Fallzahl |

Methodik für Bodenrichtwerte unverändert gegenüber dem Bestand: Amtlich gibt es
keinen Wert je Stadtteil, nur Zonenwerte. Ausgewiesen wird die Spanne über alle
Wohnbauzonen (`ENTW=B`, Nutzung `WA`/`WR`/`WB`) plus Median und Zonenzahl. Dazu
werden die Zonenpolygone mit den amtlichen Stadtteilgrenzen verschnitten.

**Voraussetzung:** `geopandas`, `shapely`, `fiona`, `pyproj`, `pandas` fehlen
lokal und müssen installiert werden.

**Bekannte Fallen aus dem Bestand, die die Skripte abfangen müssen:**
- Porz, Mülheim, Nippes, Ehrenfeld, Lindenthal und Rodenkirchen sind zugleich
  Stadtbezirksnamen. Ohne Filter auf `RAUMEBENE=Stadtteile` landen Bezirkszahlen
  auf der Stadtteilseite (Rodenkirchen: 58.536 statt 9.557 Wohnungen).
- Merkmalskürzel prüfen: `A0002A` heißt nicht Einwohner, sondern Nichtdeutsche.
  Richtig ist `A0025A`.
- Fertigstellungen nie absolut ausweisen, immer als Quote am eigenen Bestand.

### 2. Seitengenerator — `tools/stadtteildaten/seiten_bauen.py`

Template plus Daten ergibt statisches HTML im Format der bestehenden Seiten.
Zahlen werden fest eingesetzt, nicht per JavaScript nachgeladen — der Bestand
macht es so, und für Suchmaschinen ist es das Belastbarere.

Der Generator ist idempotent: gleiche Eingabe erzeugt gleiche Ausgabe. Damit ist
eine Datenaktualisierung ein Neulauf, keine Handarbeit.

### 3. Ortsprofile — `src/data/stadtteile-profile.json`

Je Stadtteil ein recherchierter Text zu Bebauung und Lage, wie im Bestand:
Baustruktur und prägende Gebäude, Stadtbahn- und Buslinien, Schulen,
Grünflächen. Diese Datei ist der Grund, warum die Seiten sich unterscheiden —
sie ist Handarbeit und lässt sich nicht automatisieren.

## Wie Duplikation vermieden wird

Ein Generator erzeugt von Natur aus gleichförmige Seiten. Drei Gegenmittel,
alle im Bestand erprobt:

1. **Datengesteuerte Blickwinkel.** Der Fließtext wählt anhand der Kennzahlen
   einen von mehreren Aufhängern, je Aufhänger mehrere Fassungen. Ein Stadtteil
   mit hoher Förderquote bekommt einen anderen Einstieg als einer mit teurem
   Neubau. Ein fester Baustein auf 83 Seiten treibt die Quote sofort hoch —
   genau das ist beim ersten Marktdaten-Anlauf passiert.
2. **Individuelle Ortsprofile** (siehe oben).
3. **Rotierende Überschriften**, geprüft gegen die übrigen Überschriften der
   Seite. Im Bestand stand dadurch auf drei Seiten dieselbe H2 zweimal.

**Messung** nach der Methode des Bestands: Cookie-Banner, Wertrechner-Kacheln,
Sprungleiste und die Bezirksauswahl stehen technisch identisch auf jeder Seite
und liegen außerhalb von `header` und `footer`. Wer sie mitzählt, misst
Boilerplate statt Text — das waren rund 20 Prozentpunkte. Diese Blöcke werden
vor der Messung herausgeschnitten.

**Zielwert:** kein Seitenpaar über 20 %, Gesamtwert im Bereich der heutigen
8,9 %.

## Innenstadt

`immobilienmakler-koeln-innenstadt.html` bleibt bestehen und wird zur Übersicht
für den Stadtbezirk umgebaut. Die vier neuen Seiten (Altstadt-Nord,
Altstadt-Süd, Neustadt-Nord, Neustadt-Süd) hängen darunter und verlinken
gegenseitig. Damit bleiben die vorhandenen Platzierungen der alten Seite
erhalten, und die fünf Seiten konkurrieren nicht um dasselbe Suchwort.

Die interne Verlinkung folgt weiter den amtlichen Stadtbezirken und bleibt
**symmetrisch**: ohne Symmetrie hängen Randlagen in der Luft — Porz und Pesch
waren allein in ihrem Bezirk und hatten null eingehende Verweise.

## Kaufseiten

Zwei Seiten: `wohnung-kaufen-koeln.html` und `haus-kaufen-koeln.html`.

Sie bedienen Kaufinteressenten und sind mit `kaeuferkartei.html` und
`immobilien-angebote.html` verzahnt. Sie konkurrieren bewusst **nicht** mit den
Verkäuferseiten (`immobilie-verkaufen.html`, `immobilie-bewerten.html`), die
ein anderes Publikum ansprechen.

Inhaltlich tragend sind die Marktdaten, die die Pipeline ohnehin liefert:
Preisspannen nach Stadtteil, Kaufnebenkosten, Ablauf vom Exposé bis zum Notar.

## Technisches SEO je neuer Seite

Der Bestand ist hier sauber und gibt den Maßstab vor:

- Genau eine H1, eindeutiger Titel, Beschreibung 120–165 Zeichen, keine
  Dubletten über den Bestand hinweg
- `canonical` und `lang` vollständig, Eintrag in `sitemap.xml` mit `lastmod`
- Strukturierte Daten `RealEstateAgent` mit `geo` und `sameAs`, dazu
  `BreadcrumbList`
- Titel-Muster wie im Bestand: etabliertes Hauptwort vorn
  („Immobilienmakler Köln-X"), Bewertungsteil hinten angehängt

**Kein `aggregateRating`.** Google wertet Bewertungen über die eigene Firma auf
der eigenen Seite als „self-serving" und schließt solche Seiten von den
Sterne-Auszeichnungen aus.

## Etappen

| Etappe | Inhalt | Ergebnis |
|---|---|---|
| 1 | Datenpipeline, drei Skripte | Amtliche Zahlen für alle 86 Stadtteile in `src/data` |
| 2 | Generator plus Template | 63 Seiten erzeugbar, noch ohne Ortsprofile |
| 3 | Ortsprofile | 63 recherchierte Texte, Duplikation unter Zielwert |
| 4 | Innenstadt-Umbau, Verlinkung, Sitemap | Bestand und Neubestand verzahnt |
| 5 | Kaufseiten | Zwei Seiten live |

Etappe 3 ist der Schwerpunkt und läuft über mehrere Sitzungen. Etappe 5 ist von
1 bis 4 unabhängig und kann vorgezogen werden.

## Bewusst nicht enthalten

- **Kauf × Stadtteil** („Wohnung kaufen Köln-Sülz"): vervielfacht den Bestand
  und kannibalisiert die Stadtteilseiten, die dasselbe Suchwort bedienen.
- **Eigene Seiten für die kleinsten Orte** waren als Alternative erwogen und
  verworfen: Der Auftraggeber hat sich bewusst für alle 63 einzeln entschieden.
  Das Risiko dünner Seiten bei Orten mit ein- bis zweitausend Einwohnern wird
  über die Ortsprofile abgefedert — je Seite echte Substanz, sonst keine Seite.
- **Laufzeit-Nachladen der Zahlen per JavaScript**: der Bestand setzt sie
  statisch, und für Suchmaschinen ist das der belastbarere Weg.

## Offen, nur vom Auftraggeber lösbar

Unabhängig von diesem Entwurf, aus der vorigen Sitzung übernommen:

- `highseller-immobilien.koeln` als Domain-Alias in Netlify eintragen und DNS
  von Strato umstellen, sonst greift keine der 42 Weiterleitungsregeln.
- Die Hero-Angaben „500+ begleitete Vorgänge" und „Zugang zu 750 Banken" stehen
  unbelegt (§ 5a UWG).
