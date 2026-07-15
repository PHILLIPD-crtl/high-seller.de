# Highseller Immobilien & Finanzen — Website (Stand v11)

## Was in v11 umgesetzt wurde
- **Header-Responsive**: Zusammenquetschen im Bereich 1120–1320 px behoben
  (kompaktere Nav-Stufe, `flex-wrap:nowrap`, kleineres Logo); Burger-Menü darunter.
- **Propstack-Anbindung (serverseitig)**: Netlify Functions `propstack-properties`
  (Liste) und `property` (SEO-Detailseite `/immobilien/<slug>`), gemeinsame Logik in
  `_lib/propstack.mts`. API-Schlüssel nur über `PROPSTACK_API_KEY` (Env), nie im Frontend.
  Neuer Bereich „Aktuelle Immobilienangebote“ (Startseite), Übersicht `/immobilienangebote`
  mit Filtern, Edge-Caching, Lazy Loading, freundlicher Fallback-Meldung, Schema.org.
- **Formulare auf Netlify Forms**: alle Formulare an info@high-seller.de (sendmail.php
  entfernt), Spam-Honeypot, gestaltete HTML-Benachrichtigung via
  `netlify/functions/submission-created.mts` (optional über Resend). Registrierung
  JS-/laufzeitgerenderter Formulare in `__forms.html`.
- **Google-Bewertungen**: automatische Anonymisierung („Mi*** R.“), sanftes Einblenden,
  Hover-Effekt, Google-Badge (`js/reviews.js`).
- **Auszeichnungen**: „+500 Verkäufe“ entfernt, verbleibende Siegel größer/edler.
- **Google-Karte**: adressbasierter Embed (zeigt zuverlässig Kranhaus 1, Im Zollhafen 18).
- **Footer**: Instagram/TikTok verlinkt, LinkedIn ergänzt; Facebook/LinkedIn/ImmoScout24/
  Immowelt/Kleinanzeigen als dokumentierte Platzhalter (`data-profile-todo`).
- Cache-Busting v11; Details siehe `.netlify/results.md`.


# Highseller Immobilien & Finanzen — Website (Stand v10)

## Was in v10 umgesetzt wurde
- **Header ohne CTA-Button**: „Beratung anfragen" aus dem Header entfernt. Neu ausbalanciert:
  Logo links, Navigation gruppiert, Telefonnummer rechts als dezente Pill (dort, wo zuvor der Button
  war). Kein Overflow mehr auf Desktop/Tablet/Mobil (per Messung geprüft; Telefon zeigt ab 1120 px,
  darunter Burger-Menü).
- **Newsletter neu gestaltet**: kompakte, elegante Karte im Footer statt des breiten Bandes.
  Gold-Eyebrow „Newsletter", Überschrift + Kurztext links, E-Mail-Feld und „Anmelden" als eine
  weiße Pill rechts, DSGVO-Hinweis darunter. Auf Mobil sauber gestapelt.
- Cache-Busting v10; alle 38 Seiten validiert.


## Was in v9 umgesetzt wurde
- **Header-Fix**: rechts wird nichts mehr abgeschnitten (kompaktere Navigation, kürzeres CTA
  „Beratung anfragen", Telefonnummer erst ab 1500 px, kein Overflow, per Messung verifiziert).
- **Hero**: zusätzlicher, sehr dezenter Lichtstreif (heroSheen, alle 13 s) + weicherer Glow;
  beides nur transform/opacity, respektiert prefers-reduced-motion.
- **Störende Striche entfernt**: Eyebrow-Akzentlinien (u. a. „Für Eigentümer") seitenweit deaktiviert.
- **Wertrechner**: 7 neue, konsistente Icons je Immobilienart; bei Grundstücken wird der Schritt
  „Zustand & Ausstattung" automatisch übersprungen (vor und zurück).
- **Team**: „28 Jahre Verkaufserfahrung", seriösere persönliche Vorstellungen, Zitat-Stil mit
  goldener Linie im Overlay.
- **Bilder-Ordner (8 Motive)** eingebaut: Bild-Heros für 11 Unterseiten (Verkaufen, Bewerten,
  Angebote, Käuferkartei, Baufinanzierung, Über uns, Kontakt, Wissen, Checkliste, Makler Köln, FAQ)
  über neue page-hero--img Variante; alle SEO-benannt mit Alt-Texten.
- **Hintergründe**: feine Linienstruktur in hellen Sektionen, radiale Lichtflächen in dunklen,
  edlere Verläufe in page-hero und Footer.
- **Widerruf**: E-Mail-Button öffnet das Mailprogramm mit vollständiger Widerrufsvorlage im Text
  (Empfänger, Betreff, Vorlage; Nutzer ergänzt nur noch seine Daten).
- **Newsletter**: große Startseiten-Sektion entfernt; stattdessen dezente, kompakte Box im Footer
  aller Seiten (E-Mail + Einwilligung + Double-Opt-in-Hinweis über sendmail.php).
- **Neue Seite verkaufte-objekte.html**: Referenzseite mit Bild-Hero, 6 Referenzkarten
  (Verkauft-Badge, Ort, Objektart, Flächen; diskret ohne Preise), Vertrauens-Split und Bewertungs-CTA;
  in Navigation, Footer und Sitemap verlinkt. ACHTUNG: Karten sind Beispieldaten, vor Livegang durch
  echte, freigegebene Referenzen ersetzen (Kommentar im Code).
- **Cache-Busting v9**; alle 38 Seiten validiert (Tag-Struktur, Links, Assets).


## Was in v8 umgesetzt wurde
- **Gedankenstriche entfernt**: alle „ – " in Fließtexten seitenweit grammatikalisch aufgelöst
  (Komma/Punkt); sichtbare Komposita wie „Budgetrechner" vereinheitlicht. Zahlenspannen und
  E-Mail/Vor-Ort-Schreibweisen bleiben korrekt.
- **Navigation**: Menüpunkt „Startseite" (Desktop + Mobil), Header mit mehr Luft (92 px).
- **Ansprechpartner**: „Callcenter"-Punkt ersetzt durch „Zugang zu über 750 Banken über unser
  Finanzierungsnetzwerk"; überall „29 Jahre Verkaufserfahrung".
- **Team**: Name/Rolle als Overlay im Bild, persönlichere Vorstellungen (Baris mit dezentem Schmunzler).
- **Sterne in Gold** (#E4B33C) auf der gesamten Seite; Google-Bewertungen laufen künftig als ruhige
  Marquee-Kartenreihe (js/reviews.js rendert automatisch, sobald echte Rezensionen eingetragen sind).
- **Footer**: Claim unter dem Logo hervorgehoben (footer__claim), Social-Icons in Markenfarben (Hover),
  Portal-Einträge mit Farb-Icons + echtem Google-G, Widerruf-Button harmonisch in der Legal-Zeile.
- **Impressum**: Berufsbezeichnungen korrigiert (Immobilienmakler nach § 34c GewO,
  Immobiliardarlehensvermittler nach § 34i GewO, Hausverwalter nach § 34c GewO), auch im Footer-Disclaimer.
- **Budgetrechner**: „Einnahmen & Ausgaben" (ohne „Aus"), Haushaltsnettoeinkommen vor Personen,
  13 Info-Tooltips; Finanzierungsrechner 8 Tooltips; Wertrechner 3 Tooltips (Komponente .info-tip,
  Hover + Fokus/Klick, mobil nutzbar).
- **Kontakt**: „Gewünschte Leistung" mit Optgroups (Immobilien/Finanzierung) und neuen Optionen
  (verkaufen, bewerten lassen, kaufen, Finanzierungsberatung, Baufinanzierung prüfen,
  Anschlussfinanzierung, Allgemeine Anfrage).
- **Neue Fotos** (SEO-benannt): koeln-panorama-dom-nacht, schluesseluebergabe-immobilienverkauf-koeln
  (Prozess), handschlag-immobilienmakler-koeln (Kontakt), immobilienmakler-schreibtisch-koeln
  (Verkaufen), expose-beratung-immobilienmakler (Käuferkartei).
- **Awards**: Siegel-Grafiken einheitlich (84 px, contain) in den Referenz-Kacheln.
- **Design**: dezente Verläufe (soft/navy/page-hero/footer), Overscroll-Flächen behoben
  (html-Hintergrund navy), Cache-Busting v8.


## Was in v7 umgesetzt wurde
- **500+ Immobilienverkäufe** seitenweit (Hero, Trust-Leiste, Referenzen, Über uns, Kontakt).
- **Kontakt**: Headline „Ich freue mich darauf, Sie persönlich kennenzulernen."; Beratungsbild auf der
  Startseite; Trust-Zeile (24-h-Antwort, kostenlos, 500+ Verkäufe); Formular in Segmente
  „Immobilienverkauf/Bewertung" und „Finanzierung" getrennt (main.js).
- **WhatsApp-Schwebebutton entfernt** (mobile Kontaktleiste und Menü-Links bleiben).
- **Ladebildschirm**: dezenter Loader mit Logo auf der Startseite, nur einmal pro Sitzung (sessionStorage).
- **Wertrechner**: PLZ, Ort, Stadtteil, Straße, Wohnfläche, Grundstück (falls relevant) und Baujahr sind
  Pflichtfelder; Unverbindlichkeits-Hinweis („ohne Gewähr") auf Startseite und Bewertungsseite.
- **Bewertungs-CTA**: „Ihre Meinung macht den Unterschied."
- **Neue Seite unterlagen-checkliste.html**: alle Verkaufsunterlagen nach Kategorien, Energieausweis-Fakten
  (10 Jahre gültig, Pflicht), druckfreundliche Checkliste mit Logo-Wasserzeichen (window.print), in
  Navigation und Sitemap verlinkt.
- **15 neue Stadtteilseiten** (Deutz, Klettenberg, Bayenthal, Marienburg, Mülheim, Porz, Weidenpesch,
  Niehl, Junkersdorf, Braunsfeld, Innenstadt, Zollstock, Dünnwald, Höhenhaus, Pesch) mit einzigartigen
  Texten, FAQ inkl. FAQPage-Schema, CTAs und Querverlinkung; Übersichtsseite verlinkt alle 20 Veedel.
- **FAQ**: 4 neue Fragen (Bewertungsablauf, Vor-Ort vs. Online, Marktwert Köln), Schema auf 32 Fragen erweitert.
- **Google Maps**: Embed auf „Highseller Immobilien & Finanzen, Im Zollhafen 18, 50678 Köln" (Klick-Consent bleibt).
- **Widerruf**: Footer-Link als sichtbarer Button „Vertrag widerrufen".
- **Performance**: Hero-Preload, decoding=async für alle Bilder, Cache-Busting (?v=7) für CSS/JS.


## Was in v6 umgesetzt wurde (Helles Blau · Wertrechner · Stadtteile)
- **Farbkonzept**: Gold vollständig durch helles, seriöses Blau ersetzt (#2F7CD3 / #2263AE); Buttons,
  Sterne, Akzente, Rechner-Highlight und Formular-Fokus angepasst; Gesamtwirkung heller.
- **Hero**: dezenter Ken-Burns-Zoom auf dem Hintergrundbild + weicher Licht-Glow (beides respektiert
  prefers-reduced-motion), aufgehelltes Overlay, Text-Schatten für optimale Lesbarkeit.
- **Ausführlicher Wertrechner (6 Schritte)** jetzt direkt auf der Startseite, inklusive
  PLZ-zu-Stadtteil-Automatik in js/wertrechner.js; kompaktes Bewertungsformular ersetzt.
- **Neue Bilder** (SEO-benannt): kranhaeuser-koeln-rheinauhafen.jpg (Standorte/Über uns/Makler Köln),
  immobilienberatung-koeln.jpg (Kontakt/Über uns), marktanalyse-immobilienbewertung-koeln.jpg
  (Baufinanzierung/Wissen). Zwei gelieferte Motive wegen KI-Artefakten bewusst nicht verwendet.
- **Wissen & Ratgeber**: doppelt verschachteltes Karten-Grid repariert, echte Bilder statt
  Logo-Platzhalter, alle Karten verlinkt, responsive 1/2/3-spaltig.
- **Aktuelle Angebote**: Karten auf Desktop exakt dreispaltig, gleiche Höhen.
- **Stadtteilseiten fertiggestellt**: Lindenthal, Sülz, Ehrenfeld, Nippes, Rodenkirchen mit
  individuellen Markt-Abschnitten (Preisniveau als redaktionelle Richtwerte), je zwei lokalen
  Eigentümer-Fragen und Querverlinkung der Veedel.


## Was in v5 umgesetzt wurde (Conversion & SEO)
- **Bewertungsformular auf der Startseite** (`js/bewertung.js`): alle Pflichtfelder inkl. PLZ mit
  automatischer Stadtteil-Erkennung (PLZ_MAP), stadtteilgenaue Marktrichtwerte, Bodenrichtwerte
  als BORIS.NRW-Struktur (manuell pflegbar, Funktion `lookupBodenrichtwert()` für spätere Anbindung).
  Ergebnis sofort als Spanne, Lead geht an sendmail.php.
- **Finanzierungsrechner**: Sollzins-Standard 4,5 %, Kaufpreis/Eigenkapital leer mit Platzhaltern,
  Rate mit dezentem Gold-Glow (`.rate-highlight`), neutrale Striche vor Eingabe.
- **Budget-Rechner**: Personen im Haushalt (Lebenshaltung 700 €/Person, automatisch vorgeschlagen),
  Haushaltsnettoeinkommen gesamt, Fixkosten als Gesamtbetrag, nachvollziehbare Rechen-Aufschlüsselung
  im Ergebnis, Sollzins 4,5 %.
- **Team**: 3 Karten nebeneinander, persönliche Vorstellung beim Hover (Touch: unter der Karte),
  Rolle „Immobilienmakler & Baufinanzierer".
- **Kontakt**: Bild eingebunden, Headline „Ich freue mich auf Ihre Anfrage.".
- **Hero**: dezente Licht-Animation (`.hero__glow`, respektiert prefers-reduced-motion).
- **Navigation**: gruppierte Hover-Dropdowns (Immobilie verkaufen / Finanzierung / Für Eigentümer /
  Über uns), Mobile-Menü mit Aufklapp-Gruppen — auf allen Seiten.
- **Newsletter-Sektion** mit DSGVO-Einwilligung und Double-Opt-in-Hinweis (Versand über sendmail.php;
  vor Livegang an Newsletter-Tool wie Brevo/Mailchimp anbinden).
- **Google-Bewertungen**: erfundene Beispiel-Rezensionen entfernt; `js/reviews.js` als pflegbare
  Struktur (rating/count/reviews[] mit echten Google-Rezensionen füllen, placeId für Bewertungslink),
  plus Bereich „Ihre Erfahrung ist uns wichtig".
- **Über-uns-Seite** (`ueber-uns.html`) mit Unternehmensprofil, Team, Kranhaus-Standort und CTAs.
- **SEO**: Meta-Titles/Descriptions mit Fokus-Keywords (Immobilienmakler Köln, Immobilienbewertung
  Köln kostenlos, Immobilie verkaufen Köln …), areaServed im Schema um Umland erweitert
  (Rhein-Erft-Kreis, Hürth, Frechen, Pulheim, Brühl, Wesseling, Leverkusen, Bergisch Gladbach),
  Umland-Absatz in der Standorte-Sektion, Sitemap ergänzt.

- **Unterseiten inhaltlich ausgebaut**: Baufinanzierung (Ablauf + FAQ), Käuferkartei (3-Schritte-Erklärung),
  Wissen (Ratgeber-Texte mit internen Links), Angebote (Kaufinteressenten-/Eigentümer-Sektion),
  Immobilienmakler Köln (Preis- und Umland-Texte, Platzhalter „in Vorbereitung" entfernt),
  Immobilie verkaufen (FAQ-Sektion). Ratgeber-Karten jetzt mehrspaltig.

## Vor dem Livegang zusätzlich zu pflegen (v5)
1. `js/reviews.js`: echte Google-Rezensionen, Gesamtwertung und placeId eintragen.
2. `js/bewertung.js` und `js/wertrechner.js`: Markt- und Bodenrichtwerte regelmäßig prüfen (BORIS.NRW).
3. Newsletter: Anbindung an ein Double-Opt-in-fähiges Tool statt sendmail.php.


## Was in v4 umgesetzt wurde (Redesign)
- **Foto-Hero** auf der Startseite (`assets/img/hero-koeln-abend.jpg`) statt Illustration; fehlerhafte SVG-Kranhaus-Grafik entfernt.
- **Neue Bildsprache**: 5 hochwertige Motive eingebunden (`hero-koeln-abend`, `bewertung-koelnblick`, `beratung-buero`, `wohntraum-wohnzimmer`, `expose-verkauf`).
- **Immobilienbewertungs-Sektion** prominent direkt unter dem Hero, mit klarer Headline und CTA.
- **Farbsystem beruhigt**: Navy + Weiß + dezentes Gold; grelles Blau und Buntheit reduziert.
- **Header luftiger**: mehr Höhe, klare Navigation, WhatsApp-Button aus dem Header entfernt.
- **Sterne einheitlich** als SVG (Gold), Trust-Leiste und Bewertungen korrigiert.
- **Awards entfernt**: Der frühere Abschnitt „Auszeichnungen“ wurde durch den seriösen Abschnitt „Qualifikationen & Vertrauen“ ersetzt (§ 34c/§ 34i GewO, unabhängige Baufinanzierung, persönlicher Ansprechpartner in Köln); unbelegte Award- und Bewertungssiegel sowie die Golf-Partner-Grafik entfernt.
- **Kontrast-Fixes**: Kontaktbereich auf dunklem Grund jetzt lesbar, Formular-Fokusfarben angepasst.
- **Widerrufsbelehrung** als eigene Seite (`widerruf.html`), im Footer aller Seiten verlinkt, Hinweis unter allen Formularen; Sitemap ergänzt.
- **Interne Notizen entfernt** (review-flags in Impressum/Datenschutz), Lade-Splashscreen entfernt.


Statische, schnelle Premium-Website (HTML/CSS/JS + ein PHP-Mailskript) für den
Kölner Makler- und Finanzierungsbetrieb **Highseller Immobilien & Finanzen**
(Inhaber Baris Ölmez, Kranhaus 1, Köln).

## Was in v3 umgesetzt wurde
- **Hausverwaltung vollständig entfernt** (Seite, Menü, Footer, Formular, Meta, Sitemap). Fokus: Verkauf, Bewertung, Vermittlung, Baufinanzierung, Finanzierungsberatung, Käuferprüfung, Eigentümerberatung.
- **Budget-Rechner** (`budget-rechner.html`, `js/budget.js`): Rückwärtsrechnung max. Kaufpreis, Variante A (Wunschrate) / B (Einnahmen − Ausgaben), Kaufnebenkosten inkl. Grunderwerbsteuer je Bundesland, Restschuld nach Zinsbindung, Einschätzung + Lead-Versand.
- **Teamfotos** (Baris, Serhad, Romeo) eingebunden; **Baris** zusätzlich im Hero, in der persönlichen Vorstellung und im Kontaktbereich.
- **Kölner Kranhäuser** als hochwertige stilisierte Illustration im Hero (Köln-Bezug, kein Stockfoto).
- **Header verschlankt**: flache 6-Punkt-Navigation, größeres Logo, Telefon **+49 162 8811110**, CTA „Kostenlos beraten lassen".
- **Trust-Leiste** direkt unter dem Hero (200+ Verkäufe · Bewertungen · Auszeichnungen · regionale Expertise · aus einer Hand).
- **Bewertungen & Auszeichnungen** weit oben auf der Startseite platziert.
- **Persönliche Vorstellung von Baris Ölmez** mit Foto, Text und CTA „Persönliches Beratungsgespräch anfragen".
- **200+ Verkäufe** als Vertrauenszahl im Hero und in der Trust-Leiste.
- Begriff **„Vertriebserfahrung" → „Verkaufserfahrung"**, Telefon überall **+49 162 8811110**.
- Alle Formulare → `sendmail.php` an **info@high-seller.de**, mit DSGVO-Checkbox und prominenter Danke-Meldung („Vielen Dank für Ihre Anfrage. Wir melden uns zeitnah persönlich bei Ihnen.").
- Design: mehr Weißraum, größere Bilder, dezente Goldakzente, hochwertige Schatten/Karten, mobil optimiert.

## Struktur
- `index.html` Startseite · `immobilie-verkaufen.html` · `immobilie-bewerten.html` (Wertrechner) · `baufinanzierung.html` · `baufinanzierungsrechner.html` · `budget-rechner.html` · `immobilien-angebote.html` · `kaeuferkartei.html` · `kontakt.html` · `faq.html` · `wissen.html` · Stadtteilseiten + `immobilienmakler-koeln.html` · `impressum.html` · `datenschutz.html`
- `css/styles.css` · `js/main.js`, `js/wertrechner.js`, `js/budget.js`, `js/calculator.js`
- `assets/img/` (Fotos, Logo, Siegel, Favicons) · `sendmail.php` · `sitemap.xml` · `robots.txt`

## Vor dem Live-Gang noch zu erledigen
1. **`sendmail.php`**: `$ABSENDER` auf eine real existierende Postfach-Adresse setzen; für zuverlässigen Versand SMTP/PHPMailer nutzen (Hinweis im Skript). PHP-Hosting erforderlich.
2. **Echte Immobilienfotos** einsetzen: Objekt-/Stadtbilder sind aktuell dezent gebrandete Flächen (Logo auf Navy). Sobald lizenzierte Fotos vorliegen, die `.img-brand`-Flächen ersetzen.
3. **Bewertungen** auf der Startseite sind Beispieltexte — vor Launch durch echte Google-Bewertungen ersetzen (oder Google-Widget einbinden).
4. **Beispiel-Angebote** (3 Listings) durch echte Objekte ersetzen bzw. an Portal-/IDX-Feed anbinden.
5. **Wertrechner-Richtwerte** (€/m², Bodenrichtwerte in `js/wertrechner.js`) und **Grunderwerbsteuer** (`js/budget.js`) regelmäßig prüfen/pflegen.
6. **Impressum & Datenschutz** rechtlich gegenprüfen lassen.

## Bewusst nicht enthalten
Kein Backend/CRM, keine bezahlten Marktdaten, keine Google-Places-Autocomplete. Leads kommen per E-Mail (bzw. mailto-Fallback) an. Diese Bausteine können als Folgeschritt ergänzt werden.
