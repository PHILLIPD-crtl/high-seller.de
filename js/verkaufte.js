/* ==========================================================================
   Highseller — Verkaufte Objekte (Referenzen)
   --------------------------------------------------------------------------
   Rendert die als "Verkauft" gekennzeichneten Propstack-Objekte in jeden
   [data-sold]-Container. Dargestellt werden ausschließlich echte Daten aus
   Propstack: Bild, Titel, Ort, Objektart, Kaufpreis (falls vorhanden),
   Wohnfläche/Zimmer (falls vorhanden) sowie der Status „Verkauft".

   Bewusst NICHT vorhanden: „Exposé ansehen"-Button, Verkaufszeiträume,
   Preisbehauptungen oder ähnliche Aussagen. Fehlende Felder werden elegant
   ausgeblendet statt mit Platzhaltern gefüllt.

   Voraussetzung: js/property-source.js wird VOR dieser Datei geladen.
   ========================================================================== */
(function () {
  "use strict";

  var EMPTY_MSG =
    "Aktuell sind keine verkauften Objekte hinterlegt. Gerne berichten wir Ihnen im persönlichen Gespräch über vergleichbare Verkäufe in Ihrer Lage.";
  var ERROR_MSG =
    "Die Referenzen können gerade nicht geladen werden. Bitte versuchen Sie es in Kürze erneut oder sprechen Sie uns direkt an.";

  // Neutrale, immer zutreffende Aussage. Wird angezeigt, solange für ein Objekt
  // KEINE bestätigten Erfolgsdaten (verified:true) in sold-highlights.json
  // hinterlegt sind. So werden niemals erfundene Fakten dargestellt.
  var NEUTRAL_SUCCESS = "Erfolgreich durch Highseller Immobilien & Finanzen vermittelt.";
  var HIGHLIGHTS_URL = "/src/data/sold-highlights.json";
  var HIGHLIGHTS = {};

  var mounts = Array.prototype.slice.call(document.querySelectorAll("[data-sold]"));
  if (!mounts.length) return;

  var source = window.HighsellerPropertySource;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function skeleton() {
    var s = "";
    for (var i = 0; i < 3; i++) {
      s += '<div class="listing listing--skeleton"><div class="listing__img"></div>' +
        '<div class="listing__body"><span class="sk sk--line"></span><span class="sk sk--line sk--short"></span>' +
        '<span class="sk sk--chip"></span></div></div>';
    }
    return '<div class="listings listings--3">' + s + "</div>";
  }

  function placeholder() {
    return '<div class="listing__noimg">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">' +
      '<path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M9 11h.01M15 11h.01"/></svg>' +
      '<span>Ohne Foto</span></div>';
  }

  // Nur echte, vorhandene Eckdaten. Fehlt ein Wert, wird er weggelassen.
  function facts(p) {
    var out = [];
    if (p.livingSpace) out.push({ label: "Wohnfläche", value: p.livingSpace.toLocaleString("de-DE") + " m²" });
    if (p.rooms) out.push({ label: "Zimmer", value: p.rooms });
    if (p.plotArea) out.push({ label: "Grundstück", value: p.plotArea.toLocaleString("de-DE") + " m²" });
    return out;
  }

  // Baut den Erfolgs-Bereich einer Objektkarte.
  // Nur BESTÄTIGTE (verified:true) Angaben aus sold-highlights.json führen zu
  // konkreten Erfolgsfakten. Andernfalls erscheint ausschließlich die neutrale
  // Aussage – es werden keine Zahlen oder Zeiträume erfunden.
  function successBlock(p) {
    var h = HIGHLIGHTS[p.id] || HIGHLIGHTS[String(p.id)] || null;
    var verified = !!(h && h.verified === true);

    var checkIcon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">' +
      '<path d="M20 6L9 17l-5-5"/></svg>';

    // Erfolgszeile: bestätigter resultText oder neutrale Aussage.
    var line = (verified && h.resultText && String(h.resultText).trim())
      ? esc(String(h.resultText).trim())
      : NEUTRAL_SUCCESS;

    // Optionales Badge nur bei bestätigter, konkreter Vermarktungsdauer.
    var badge = "";
    if (verified && typeof h.soldInDays === "number" && h.soldInDays > 0) {
      badge = '<span class="listing__success-badge">In ' + esc(h.soldInDays) + ' Tagen verkauft</span>';
    }

    return (
      '<div class="listing__success' + (verified ? " is-verified" : "") + '">' +
      badge +
      '<p class="listing__success-line">' + checkIcon + "<span>" + line + "</span></p>" +
      "</div>"
    );
  }

  function card(p) {
    var alt = (p.images && p.images[0] && p.images[0].alt) || ("Verkaufte Immobilie in " + (p.city || "Köln"));
    var img = p.images && p.images[0] && p.images[0].url
      ? '<img loading="lazy" decoding="async" src="' + esc(p.images[0].url) + '" alt="' + esc(alt) + '">'
      : placeholder();
    var place = [p.city, p.district].filter(Boolean).join(" · ") || p.address || "";

    var factItems = facts(p).map(function (x) {
      return "<div><b>" + esc(x.value) + "</b>" + esc(x.label) + "</div>";
    }).join("");

    // Kaufpreis nur zeigen, wenn ein echter Preis vorliegt (keine „Preis auf Anfrage"
    // Platzhalter bei Referenzen).
    var priceRow = (typeof p.price === "number" && p.price > 0)
      ? '<div class="listing__price">' + esc(p.priceLabel) + "</div>"
      : "";

    return (
      '<article class="listing listing--sold">' +
      '<div class="listing__img"><span class="listing__badge listing__badge--sold">Verkauft</span>' + img + "</div>" +
      '<div class="listing__body">' +
      '<span class="listing__type">' + esc(p.objectType) + "</span>" +
      '<h3 class="listing__title">' + esc(p.title) + "</h3>" +
      (place ? '<p class="listing__place">' + esc(place) + "</p>" : "") +
      priceRow +
      (factItems ? '<div class="listing__facts">' + factItems + "</div>" : "") +
      successBlock(p) +
      "</div></article>"
    );
  }

  function renderEmpty(m) {
    m.innerHTML =
      '<div class="listings-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="40" height="40"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/></svg>' +
      "<p>" + EMPTY_MSG + "</p>" +
      '<a class="btn btn--gold" href="/immobilie-bewerten.html">Immobilie kostenlos bewerten</a>' +
      "</div>";
  }

  function renderError(m) {
    m.innerHTML =
      '<div class="listings-empty listings-empty--error">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="40" height="40"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>' +
      "<p>" + ERROR_MSG + "</p>" +
      '<div class="listings-empty__btns">' +
      '<button type="button" class="btn btn--gold" data-sold-retry>Erneut versuchen</button>' +
      '<a class="btn btn--ghost" href="/kontakt.html">Kontakt aufnehmen</a>' +
      "</div></div>";
    var retry = m.querySelector("[data-sold-retry]");
    if (retry) retry.addEventListener("click", boot);
  }

  function render(m, list) {
    if (!list.length) { renderEmpty(m); return; }
    m.innerHTML = '<div class="listings listings--3">' + list.map(card).join("") + "</div>";
    var cards = m.querySelectorAll(".listing");
    Array.prototype.forEach.call(cards, function (c, i) {
      c.style.setProperty("--i", i);
      c.classList.add("listing--in");
    });
  }

  function boot() {
    mounts.forEach(function (m) { m.innerHTML = skeleton(); });

    if (!source || typeof source.loadSold !== "function") {
      mounts.forEach(renderError);
      return;
    }

    // Bestätigte Erfolgsdaten (best effort) laden – schlägt der Abruf fehl,
    // werden ausschließlich die neutralen Erfolgszeilen angezeigt.
    var highlightsReady = fetch(HIGHLIGHTS_URL, { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) { HIGHLIGHTS = (json && json.highlights) || {}; })
      .catch(function () { HIGHLIGHTS = {}; });

    highlightsReady.then(function () {
      source.loadSold()
        .then(function (res) {
          var list = (res && res.properties) || [];
          if (res && res.ok === false) { mounts.forEach(renderError); return; }
          mounts.forEach(function (m) { render(m, list); });
        })
        .catch(function () { mounts.forEach(renderError); });
    });
  }

  boot();
})();
