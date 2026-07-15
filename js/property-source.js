/* ==========================================================================
   Highseller — Immobilien-Datenquelle (quellen-agnostisch)
   --------------------------------------------------------------------------
   Diese Datei kapselt das Laden der Immobilienangebote und entkoppelt die
   Darstellung (js/immobilien.js) von der konkreten Datenquelle.

   Aktive Datenquelle ist die Propstack-API (serverseitige Netlify Function,
   der API-Schlüssel bleibt serverseitig). Die lokale JSON-Datei
   (src/data/properties.json) bleibt als Fallback/Redaktionsquelle erhalten und
   ist per CONFIG.source jederzeit reaktivierbar. Weitere Portale (Immowelt,
   ImmoScout, onOffice, FLOWFACT, OpenImmo) sind als Adapter-Platzhalter
   vorbereitet.

   Öffentliche API:
     window.HighsellerPropertySource.load()
       -> Promise<{ ok:boolean, source:string, properties:Property[], error?:string }>

   `ok:false` signalisiert einen echten Fehler (Quelle nicht ladbar). Eine
   leere `properties`-Liste bei `ok:true` bedeutet: keine Objekte hinterlegt
   (freundlicher Hinweis, kein Fehler).
   ========================================================================== */
(function () {
  "use strict";

  // === Konfiguration ======================================================
  // Aktive Datenquelle. Umschaltbar an genau EINER Stelle.
  //   "local"     – lokale Objektliste (src/data/properties.json)
  //   "propstack" – Propstack-API über die bestehende Netlify Function  [aktiv]
  // Vorbereitet (siehe ADAPTERS weiter unten):
  //   "immowelt", "immoscout", "onoffice", "flowfact", "openimmo"
  var CONFIG = {
    source: "propstack",
    endpoints: {
      local: "/src/data/properties.json",
      propstack: "/.netlify/functions/propstack-properties",
      // Vorbereitet: jeweils eine eigene Netlify Function, die – wie
      // propstack-properties – ein JSON { ok, properties } zurückgibt, damit
      // API-Schlüssel serverseitig bleiben.
      immowelt: "/.netlify/functions/immowelt-properties",
      immoscout: "/.netlify/functions/immoscout-properties",
      onoffice: "/.netlify/functions/onoffice-properties",
      flowfact: "/.netlify/functions/flowfact-properties",
      openimmo: "/.netlify/functions/openimmo-properties"
    }
  };

  // === Hilfsfunktionen ====================================================
  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
    return isFinite(n) ? n : null;
  }

  function euro(n) {
    if (n === null || n === undefined) return "Preis auf Anfrage";
    try {
      return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
    } catch (e) {
      return n + " €";
    }
  }

  var UMLAUT = { "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" };
  function slugify(input) {
    return String(input || "")
      .toLowerCase()
      .replace(/[äöüß]/g, function (m) { return UMLAUT[m] || m; })
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  // Status normalisieren: "verfügbar"/"verfuegbar" -> "verfuegbar" etc.
  var STATUS_LABEL = { verfuegbar: "Verfügbar", reserviert: "Reserviert", verkauft: "Verkauft" };
  function normStatus(v) {
    var s = String(v || "verfuegbar").toLowerCase().replace(/[äöüß]/g, function (m) { return UMLAUT[m] || m; });
    if (s.indexOf("reserv") === 0) return "reserviert";
    if (s.indexOf("verkauf") === 0 || s === "sold") return "verkauft";
    return "verfuegbar";
  }

  function normImages(images, title) {
    var arr = Array.isArray(images) ? images : [];
    return arr
      .map(function (img) {
        if (!img) return null;
        if (typeof img === "string") return { url: img, alt: title };
        if (img.url) return { url: img.url, alt: img.alt || title };
        return null;
      })
      .filter(Boolean)
      .map(function (img, i) {
        return { url: img.url, alt: img.alt || (title + " – Foto " + (i + 1)) };
      });
  }

  // === Normalisierung: lokales Schema -> gemeinsames Kartenformat =========
  function normalizeLocal(p) {
    var marketingType = String(p.marketingType || "kauf").toLowerCase() === "miete" ? "miete" : "kauf";
    var price = num(p.price);
    var priceLabel = euro(price) + (marketingType === "miete" && price !== null ? " / Monat" : "");
    var status = normStatus(p.status);
    var title = p.title || (p.objectType ? p.objectType + " in " + (p.city || "Köln") : "Immobilie");
    var externalUrl = p.externalUrl || p.exposeUrl || p.url || "";

    return {
      id: String(p.id || slugify(title)),
      slug: p.slug || slugify([p.objectType, p.city, p.district || p.id].filter(Boolean).join("-")),
      title: title,
      city: p.city || "",
      district: p.district || "",
      objectType: p.objectType || "Immobilie",
      marketingType: marketingType,
      price: price,
      priceLabel: priceLabel,
      livingSpace: num(p.livingSpace),
      plotArea: num(p.plotArea),
      rooms: num(p.rooms),
      constructionYear: num(p.constructionYear),
      status: status,
      statusLabel: STATUS_LABEL[status],
      description: p.description || "",
      images: normImages(p.images, title),
      // Lokale Objekte verlinken direkt auf das externe Exposé (falls vorhanden).
      url: externalUrl || "",
      external: Boolean(externalUrl)
    };
  }

  // === Normalisierung: Propstack-Function-Antwort -> Kartenformat =========
  // Die Function liefert bereits ein aufbereitetes Property-Objekt. Wir
  // ergänzen nur die für die Karte nötigen Felder (Link + Status).
  function normalizePropstack(p) {
    var status = normStatus(p.status);
    // Der Button „Exposé ansehen" verlinkt direkt auf das öffentliche
    // Propstack-Exposé (property.exposeUrl). Nur falls dieses fehlt, wird auf
    // die intern gerenderte Detailseite (bzw. Kontakt) ausgewichen.
    var expose = p.exposeUrl || "";
    var url = expose || (p.slug ? "/immobilien/" + encodeURIComponent(p.slug) : "");
    return {
      id: String(p.id),
      slug: p.slug,
      title: p.title,
      city: p.city || "",
      district: p.district || "",
      address: p.address || "",
      objectType: p.objectType || "Immobilie",
      marketingType: p.marketingType === "miete" ? "miete" : "kauf",
      price: (typeof p.price === "number") ? p.price : num(p.price),
      priceLabel: p.priceLabel || euro(num(p.price)),
      livingSpace: num(p.livingSpace),
      plotArea: num(p.plotArea),
      rooms: num(p.rooms),
      constructionYear: num(p.constructionYear),
      status: status,
      statusLabel: STATUS_LABEL[status],
      description: p.description || "",
      images: normImages(p.images, p.title),
      exposeUrl: expose,
      url: url,
      // Externe Exposé-Links öffnen in einem neuen Tab.
      external: Boolean(expose)
    };
  }

  // === Adapter ============================================================
  // Jeder Adapter gibt ein Promise auf { ok, source, properties, error? } zurück.

  function fetchJson(url) {
    return fetch(url, { headers: { Accept: "application/json" } }).then(function (r) {
      if (!r.ok) throw new Error("http_" + r.status);
      return r.json();
    });
  }

  function loadLocal() {
    return fetchJson(CONFIG.endpoints.local + "?t=" + Date.now())
      .then(function (data) {
        var list = Array.isArray(data) ? data : (data && data.properties) || [];
        return { ok: true, source: "local", properties: list.map(normalizeLocal) };
      })
      .catch(function (err) {
        return { ok: false, source: "local", properties: [], error: (err && err.message) || "load_failed" };
      });
  }

  // === Normalisierung: verkaufte Objekte (Referenzen) =====================
  // Verkaufte Objekte werden ausschließlich als sachliche Referenz gezeigt:
  // kein Exposé-Link, kein "Exposé ansehen", Status fix "verkauft".
  function normalizeSold(p) {
    var base = normalizePropstack(p);
    base.status = "verkauft";
    base.statusLabel = STATUS_LABEL.verkauft;
    base.exposeUrl = "";
    base.url = "";
    base.external = false;
    return base;
  }

  function loadPropstack() {
    return fetchJson(CONFIG.endpoints.propstack)
      .then(function (res) {
        // Die Function antwortet stets mit HTTP 200; ok:false = Diagnose.
        var list = (res && res.properties) || [];
        if (res && res.ok === false && list.length === 0) {
          // Kein Objekt verfügbar -> als leer (kein harter Fehler) behandeln,
          // damit der freundliche Hinweis erscheint statt der Fehlerbox.
          return { ok: true, source: "propstack", properties: [] };
        }
        return { ok: true, source: "propstack", properties: list.map(normalizePropstack) };
      })
      .catch(function (err) {
        return { ok: false, source: "propstack", properties: [], error: (err && err.message) || "load_failed" };
      });
  }

  // Verkaufte Objekte (Referenzen) laden – eigener Endpoint, gleiche
  // Fehler-/Leer-Logik wie loadPropstack.
  function loadSold() {
    return fetchJson("/.netlify/functions/propstack-sold-properties")
      .then(function (res) {
        var list = (res && res.properties) || [];
        if (res && res.ok === false && list.length === 0) {
          return { ok: true, source: "propstack-sold", properties: [] };
        }
        return { ok: true, source: "propstack-sold", properties: list.map(normalizeSold) };
      })
      .catch(function (err) {
        return { ok: false, source: "propstack-sold", properties: [], error: (err && err.message) || "load_failed" };
      });
  }

  // --- Vorbereitete Adapter für weitere Portale ---------------------------
  // Anbindung jeweils über eine serverseitige Netlify Function (API-Key bleibt
  // serverseitig), die ein JSON { ok, properties:[...] } liefert. Danach hier
  // eine passende normalizeX-Funktion ergänzen und den Adapter aktiv schalten.
  //
  //   Immowelt API   -> normalizeImmowelt
  //   ImmoScout24 API-> normalizeImmoscout
  //   onOffice API   -> normalizeOnoffice
  //   FLOWFACT API   -> normalizeFlowfact
  //   OpenImmo XML   -> Function parst das XML und liefert JSON; normalizeOpenimmo
  //
  // Der generische Loader unten kann direkt wiederverwendet werden, sobald der
  // Endpoint existiert und ein normalizeX bereitsteht.
  function makePortalLoader(source, normalizer) {
    return function () {
      var endpoint = CONFIG.endpoints[source];
      if (!endpoint) {
        return Promise.resolve({ ok: false, source: source, properties: [], error: "not_configured" });
      }
      return fetchJson(endpoint)
        .then(function (res) {
          var list = (res && res.properties) || [];
          return { ok: true, source: source, properties: list.map(normalizer || normalizeLocal) };
        })
        .catch(function (err) {
          return { ok: false, source: source, properties: [], error: (err && err.message) || "not_implemented" };
        });
    };
  }

  var ADAPTERS = {
    local: loadLocal,
    propstack: loadPropstack,
    // Aktiv schaltbar, sobald der jeweilige Endpoint + Normalizer existiert:
    immowelt: makePortalLoader("immowelt", null),
    immoscout: makePortalLoader("immoscout", null),
    onoffice: makePortalLoader("onoffice", null),
    flowfact: makePortalLoader("flowfact", null),
    openimmo: makePortalLoader("openimmo", null)
  };

  function load() {
    var adapter = ADAPTERS[CONFIG.source] || ADAPTERS.local;
    return adapter();
  }

  // === Export =============================================================
  window.HighsellerPropertySource = {
    config: CONFIG,
    load: load,
    loadSold: loadSold,
    // Für Tests / spätere Nutzung offengelegt:
    normalizeLocal: normalizeLocal,
    normalizePropstack: normalizePropstack,
    normalizeSold: normalizeSold
  };
})();
