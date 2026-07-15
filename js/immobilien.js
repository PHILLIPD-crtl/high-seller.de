/* ==========================================================================
   Highseller — Immobilienangebote (Darstellung)
   --------------------------------------------------------------------------
   Rendert die Immobilienkarten in alle [data-immobilien]-Container. Die Daten
   kommen quellen-agnostisch aus js/property-source.js (Standard: lokale
   JSON-Datei, ohne API-Abhängigkeit; Propstack bleibt umschaltbar).

   Zustände:
     - Laden : Skeleton-Karten
     - Leer  : freundlicher Hinweis (keine Objekte hinterlegt)
     - Fehler: seriöse Fehlermeldung mit "Erneut versuchen" + Kontakt
     - Daten : moderne Immobilienkarten mit Status-Badge

   Verwendung im HTML:
     <div data-immobilien="preview" data-limit="3"></div>   (Startseite)
     <div data-immobilien="grid"></div>                      (Angebotsseite)

   Voraussetzung: js/property-source.js wird VOR dieser Datei geladen.
   ========================================================================== */
(function () {
  "use strict";

  var EMPTY_MSG =
    "Aktuell befinden sich keine Immobilien in der Vermarktung. Gerne merken wir Sie für passende Angebote vor.";
  var ERROR_MSG =
    "Die Immobilienangebote können gerade nicht geladen werden. Bitte versuchen Sie es in Kürze erneut oder kontaktieren Sie uns direkt.";

  var mounts = Array.prototype.slice.call(document.querySelectorAll("[data-immobilien]"));
  if (!mounts.length) return;

  var source = window.HighsellerPropertySource;

  function boot() {
    mounts.forEach(function (m) { m.innerHTML = skeleton(); });

    if (!source || typeof source.load !== "function") {
      mounts.forEach(function (m) { renderError(m); });
      return;
    }

    source.load()
      .then(function (res) {
        var list = (res && res.properties) || [];
        if (res && res.ok === false) {
          mounts.forEach(function (m) { renderError(m); });
          return;
        }
        mounts.forEach(function (m) { render(m, list); });
      })
      .catch(function () {
        mounts.forEach(function (m) { renderError(m); });
      });
  }

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

  // Auf der Karte werden die wichtigsten Eckdaten gezeigt.
  function meta(p) {
    var out = [];
    if (p.livingSpace) out.push({ label: "Wohnfläche", value: p.livingSpace.toLocaleString("de-DE") + " m²" });
    if (p.rooms) out.push({ label: "Zimmer", value: p.rooms });
    if (p.plotArea) out.push({ label: "Grundstück", value: p.plotArea.toLocaleString("de-DE") + " m²" });
    return out;
  }

  // Hochwertiger Platzhalter, wenn (noch) kein Foto vorhanden ist.
  function placeholder() {
    return '<div class="listing__noimg">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">' +
      '<path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M9 11h.01M15 11h.01"/></svg>' +
      '<span>Fotos folgen in Kürze</span></div>';
  }

  function card(p) {
    var img = p.images && p.images[0] && p.images[0].url
      ? '<img loading="lazy" decoding="async" src="' + esc(p.images[0].url) + '" alt="' + esc(p.images[0].alt) + '">'
      : placeholder();
    var badge = p.marketingType === "miete" ? "Zur Miete" : "Zum Kauf";
    var place = [p.city, p.district].filter(Boolean).join(" · ") || p.address || "";
    var metaItems = meta(p).map(function (x) {
      return "<span><b>" + esc(x.value) + "</b>" + esc(x.label) + "</span>";
    }).join("");

    // Bildbereich: externer Link öffnet in neuem Tab, interner Link normal.
    var linkAttrs = p.external ? ' target="_blank" rel="noopener"' : "";
    var media = p.url
      ? '<a class="listing__img" href="' + esc(p.url) + '"' + linkAttrs + '>' +
          '<span class="listing__badge">' + esc(badge) + "</span>" + img + "</a>"
      : '<div class="listing__img"><span class="listing__badge">' + esc(badge) + "</span>" + img + "</div>";

    var title = p.url
      ? '<a href="' + esc(p.url) + '"' + linkAttrs + ">" + esc(p.title) + "</a>"
      : esc(p.title);

    return (
      '<article class="listing">' +
      media +
      '<div class="listing__body">' +
      '<span class="listing__type">' + esc(p.objectType) + "</span>" +
      '<h3 class="listing__title">' + title + "</h3>" +
      '<p class="listing__place">' + esc(place) + "</p>" +
      '<div class="listing__price">' + esc(p.priceLabel) + "</div>" +
      (metaItems ? '<div class="listing__facts">' + metaItems + "</div>" : "") +
      '<div class="listing__cta">' + cta(p) + "</div>" +
      "</div></article>"
    );
  }

  // Genau ein Button pro Karte: „Exposé ansehen“ führt zur Detailseite
  // (bzw. zum externen Exposé, falls die Quelle einen direkten Link liefert).
  function cta(p) {
    var linkAttrs = p.external ? ' target="_blank" rel="noopener"' : "";
    var href = p.url || "/kontakt.html";
    return '<a class="btn btn--gold btn--sm btn--block" href="' + esc(href) + '"' + linkAttrs + ">Exposé ansehen</a>";
  }

  function renderEmpty(m) {
    m.innerHTML =
      '<div class="listings-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="40" height="40"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/></svg>' +
      "<p>" + EMPTY_MSG + "</p>" +
      '<a class="btn btn--gold" href="/kontakt.html">Kontakt aufnehmen</a>' +
      "</div>";
  }

  function renderError(m) {
    m.innerHTML =
      '<div class="listings-empty listings-empty--error">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="40" height="40"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>' +
      "<p>" + ERROR_MSG + "</p>" +
      '<div class="listings-empty__btns">' +
      '<button type="button" class="btn btn--gold" data-immobilien-retry>Erneut versuchen</button>' +
      '<a class="btn btn--ghost" href="/kontakt.html">Kontakt aufnehmen</a>' +
      "</div></div>";
    var retry = m.querySelector("[data-immobilien-retry]");
    if (retry) retry.addEventListener("click", boot);
  }

  function render(m, list) {
    if (!list.length) { renderEmpty(m); return; }

    var mode = m.getAttribute("data-immobilien");
    var items = list.slice();

    if (mode === "preview") {
      var limit = parseInt(m.getAttribute("data-limit") || "3", 10);
      items = items.slice(0, limit);
    }

    var filterBar = "";
    if (mode === "grid" && list.length > 1) {
      var types = list.map(function (p) { return p.objectType; })
        .filter(function (v, i, a) { return v && a.indexOf(v) === i; });
      filterBar =
        '<div class="listing-filter" role="tablist">' +
        '<button class="chip chip--sel" data-f="all">Alle (' + list.length + ")</button>" +
        types.map(function (t) { return '<button class="chip" data-f="type:' + esc(t) + '">' + esc(t) + "</button>"; }).join("") +
        "</div>";
    }

    m.innerHTML = filterBar + '<div class="listings listings--3">' + items.map(card).join("") + "</div>";
    animate(m);

    if (mode === "grid" && list.length > 1) wireFilter(m, list);
  }

  function animate(m) {
    var cards = m.querySelectorAll(".listing");
    Array.prototype.forEach.call(cards, function (c, i) {
      c.style.setProperty("--i", i);
      c.classList.add("listing--in");
    });
  }

  function wireFilter(m, list) {
    var chips = m.querySelectorAll(".chip");
    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener("click", function () {
        Array.prototype.forEach.call(chips, function (c) { c.classList.remove("chip--sel"); });
        chip.classList.add("chip--sel");
        var f = chip.getAttribute("data-f");
        var filtered = list.filter(function (p) {
          if (f === "all") return true;
          if (f === "kauf" || f === "miete") return p.marketingType === f;
          if (f.indexOf("type:") === 0) return p.objectType === f.slice(5);
          return true;
        });
        var grid = m.querySelector(".listings");
        grid.innerHTML = filtered.length
          ? filtered.map(card).join("")
          : '<p class="listings-empty__inline">Keine Objekte in dieser Kategorie. Sprechen Sie uns gerne an.</p>';
        animate(m);
      });
    });
  }

  boot();
})();
