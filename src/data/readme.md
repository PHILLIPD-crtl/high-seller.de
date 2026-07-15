# Immobilienangebote – lokale Datenquelle

Diese Datei erklärt, wie die Immobilienangebote auf der Webseite gepflegt werden.
Ziel: Die Webseite zeigt **sofort und zuverlässig** Objekte an – unabhängig davon,
ob die Propstack-API (oder eine andere Portal-API) gerade erreichbar ist.

## Wie es funktioniert

- Die aktive Datenquelle wird in `js/property-source.js` über `CONFIG.source`
  gesteuert. Standard ist `"local"`.
- Bei `"local"` werden die Objekte aus **dieser** Datei geladen:
  [`src/data/properties.json`](./properties.json).
- Die Darstellung (Karten, Filter, Lade-, Leer- und Fehlerzustand) übernimmt
  `js/immobilien.js`. An diesen Dateien muss zum Pflegen der Angebote **nichts**
  geändert werden – es reicht, `properties.json` zu bearbeiten.

## Objekte pflegen

`properties.json` enthält ein Objekt mit dem Feld `properties` (ein Array).

- **Keine Objekte veröffentlichen?** `properties` leer lassen (`[]`). Dann zeigt
  die Seite automatisch den seriösen Hinweis
  „Aktuell bereiten wir neue Immobilienangebote für Sie vor …“.
- **Objekt hinzufügen?** Einen Eintrag nach folgendem Schema in das Array
  ergänzen. Es werden **keine Dummy-Objekte** veröffentlicht – nur echte,
  freigegebene Angebote eintragen.

### Feld-Schema

| Feld               | Pflicht | Typ            | Beschreibung |
|--------------------|:------:|-----------------|--------------|
| `id`               |  ja    | String          | Eindeutige, stabile Kennung (z. B. `koeln-suelz-etw-2z`). |
| `title`            |  ja    | String          | Titel des Angebots. |
| `city`             |  ja    | String          | Ort. |
| `district`         |  –     | String          | Stadtteil / Lage (optional). |
| `objectType`       |  –     | String          | Objektart (z. B. „Eigentumswohnung“, „Einfamilienhaus“). |
| `marketingType`    |  –     | `"kauf"`/`"miete"` | Vermarktungsart. Standard: `"kauf"`. |
| `price`            |  ja*   | Number \| null  | Kaufpreis (bzw. Kaltmiete bei Miete) in Euro. `null` → „Preis auf Anfrage“. |
| `livingSpace`      |  ja    | Number          | Wohnfläche in m². |
| `plotArea`         |  –     | Number          | Grundstücksfläche in m² (optional). |
| `rooms`            |  ja    | Number          | Zimmeranzahl. |
| `constructionYear` |  –     | Number          | Baujahr (optional). |
| `status`           |  ja    | String          | `"verfuegbar"`, `"reserviert"` oder `"verkauft"`. |
| `description`      |  ja    | String          | Kurzbeschreibung. |
| `images`           |  ja    | Array           | Bilder (siehe unten). |
| `externalUrl`      |  –     | String          | Externer Link zum Exposé (ImmoScout, Immowelt, eigenes Exposé …). |

\* `price` darf `null` sein („Preis auf Anfrage“).

`images` akzeptiert entweder einfache URL-Strings oder Objekte mit `url` und
optionalem `alt`-Text:

```json
"images": [
  { "url": "/assets/img/mein-objekt-1.jpg", "alt": "Wohnzimmer mit Rheinblick" },
  "/assets/img/mein-objekt-2.jpg"
]
```

Bilder am besten in `assets/img/` ablegen und relativ (`/assets/img/...`)
referenzieren. Externe Bild-URLs (https) funktionieren ebenfalls.

### Beispiel-Eintrag

```json
{
  "properties": [
    {
      "id": "koeln-rheinauhafen-etw-2z",
      "title": "Moderne 2-Zimmer-Wohnung mit Rheinblick",
      "city": "Köln",
      "district": "Rheinauhafen",
      "objectType": "Eigentumswohnung",
      "marketingType": "kauf",
      "price": 549000,
      "livingSpace": 68,
      "plotArea": null,
      "rooms": 2,
      "constructionYear": 2018,
      "status": "verfuegbar",
      "description": "Hochwertig ausgestattete Wohnung in bester Lage ...",
      "images": [
        { "url": "/assets/img/wohntraum-wohnzimmer.jpg", "alt": "Wohnzimmer" }
      ],
      "externalUrl": "https://www.immobilienscout24.de/expose/XXXXXXXX"
    }
  ]
}
```

## Datenquelle umschalten

In `js/property-source.js`:

```js
var CONFIG = {
  source: "local", // "local" | "propstack" | (vorbereitet: "immowelt", ...)
  ...
};
```

- `"local"` – diese JSON-Datei (Standard, keine API-Abhängigkeit).
- `"propstack"` – Propstack über die bestehende Netlify Function
  `/.netlify/functions/propstack-properties`. Die Anbindung ist vollständig
  erhalten und lässt sich jederzeit reaktivieren.

## Weitere Portal-Anbindungen (vorbereitet)

`js/property-source.js` enthält Adapter-Platzhalter für **Immowelt API**,
**ImmoScout24 API**, **onOffice API**, **FLOWFACT API** und **OpenImmo XML**.
Jede dieser Quellen sollte serverseitig über eine Netlify Function angebunden
werden (damit API-Schlüssel niemals im Browser landen), die – wie
`propstack-properties` – ein JSON `{ ok, properties }` liefert. Der jeweilige
Adapter normalisiert die Antwort dann in das gemeinsame Kartenformat. Details
stehen als Kommentare direkt im Adapter-Abschnitt der Datei.
