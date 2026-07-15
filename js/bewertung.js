/* ==========================================================================
   Highseller — Immobilienbewertung (Startseite, kompakt)
   Erste Marktwert-INDIKATION (kein Gutachten) mit Stadtteil-Logik für Köln.
   --------------------------------------------------------------------------
   DATENPFLEGE:
   - MARKTWERTE: redaktionelle Richtwerte (€/m²) je Stadtteil/Ort. Regelmäßig
     anhand Gutachterausschuss Köln, Portaldaten o. Ä. aktualisieren.
   - BODENRICHTWERTE (bo): Quelle BORIS.NRW (https://www.boris.nrw.de).
     BORIS.NRW bietet keine frei nutzbare Live-API für diesen Zweck; die Werte
     werden daher hier manuell gepflegt. Eine spätere Anbindung (z. B. über
     einen eigenen Server-Endpunkt, der BORIS-Daten cached) kann die Funktion
     lookupBodenrichtwert() ersetzen, ohne dass sich am Formular etwas ändert.
   - PLZ_MAP: ordnet Postleitzahlen dem Stadtteil/Ort zu (Vorschlagslogik).
   ========================================================================== */
(function () {
  "use strict";
  var form = document.getElementById("bewertung-form");
  if (!form) return;
  var $ = function (s) { return form.querySelector(s); };

  /* ---- Marktwerte je Stadtteil/Ort (m2W = Wohnung €/m², m2H = Haus €/m²,
         bo = Bodenrichtwert €/m² lt. BORIS.NRW, manuell gepflegt) ---- */
  var MARKTWERTE = {
    "Innenstadt/Altstadt": { m2W: 6200, m2H: 6500, bo: 2600, tier: "sehr gefragte Lage" },
    "Deutz":               { m2W: 4900, m2H: 5100, bo: 1700, tier: "gefragte Lage" },
    "Marienburg":          { m2W: 6800, m2H: 7200, bo: 3000, tier: "sehr gefragte Lage" },
    "Lindenthal":          { m2W: 6000, m2H: 6400, bo: 2400, tier: "sehr gefragte Lage" },
    "Braunsfeld":          { m2W: 5500, m2H: 5800, bo: 2000, tier: "gefragte Lage" },
    "Junkersdorf":         { m2W: 5200, m2H: 5600, bo: 1700, tier: "gefragte Lage" },
    "Sülz":                { m2W: 5400, m2H: 5700, bo: 1900, tier: "gefragte Lage" },
    "Klettenberg":         { m2W: 5500, m2H: 5800, bo: 2000, tier: "gefragte Lage" },
    "Ehrenfeld":           { m2W: 5000, m2H: 5200, bo: 1700, tier: "gefragte Lage" },
    "Nippes":              { m2W: 4700, m2H: 4900, bo: 1500, tier: "solide Lage" },
    "Weidenpesch":         { m2W: 3700, m2H: 3900, bo: 1100, tier: "solide Lage" },
    "Niehl":               { m2W: 3400, m2H: 3600, bo: 1000, tier: "solide Lage" },
    "Rodenkirchen":        { m2W: 5200, m2H: 5600, bo: 1800, tier: "gefragte Lage" },
    "Bayenthal/Raderberg": { m2W: 5300, m2H: 5600, bo: 1900, tier: "gefragte Lage" },
    "Zollstock":           { m2W: 4300, m2H: 4500, bo: 1400, tier: "solide Lage" },
    "Mülheim":             { m2W: 4000, m2H: 4200, bo: 1200, tier: "solide Lage" },
    "Höhenhaus":           { m2W: 3300, m2H: 3600, bo: 950,  tier: "solide Lage" },
    "Dünnwald":            { m2W: 3400, m2H: 3700, bo: 1000, tier: "solide Lage" },
    "Kalk":                { m2W: 3700, m2H: 3900, bo: 1000, tier: "einfache Lage" },
    "Porz":                { m2W: 3500, m2H: 3800, bo: 900,  tier: "einfache Lage" },
    "Chorweiler":          { m2W: 3000, m2H: 3300, bo: 700,  tier: "einfache Lage" },
    "Hürth":               { m2W: 4200, m2H: 4500, bo: 1300, tier: "solide Lage" },
    "Frechen":             { m2W: 4000, m2H: 4300, bo: 1200, tier: "solide Lage" },
    "Pulheim":             { m2W: 4200, m2H: 4500, bo: 1300, tier: "solide Lage" },
    "Brühl":               { m2W: 4100, m2H: 4400, bo: 1250, tier: "solide Lage" },
    "Wesseling":           { m2W: 3500, m2H: 3800, bo: 950,  tier: "solide Lage" },
    "Bergheim":            { m2W: 3400, m2H: 3700, bo: 850,  tier: "einfache Lage" },
    "Leverkusen":          { m2W: 3600, m2H: 3900, bo: 1000, tier: "solide Lage" },
    "Bergisch Gladbach":   { m2W: 4100, m2H: 4400, bo: 1250, tier: "solide Lage" },
    "Anderer Ort":         { m2W: 3800, m2H: 4100, bo: 1100, tier: "solide Lage" }
  };

  /* ---- PLZ → Stadtteil/Ort (Köln + Umland). Bei mehreren Stadtteilen je PLZ
         wird der marktprägende vorgeschlagen; manuell änderbar. ---- */
  var PLZ_MAP = {
    "50667": "Innenstadt/Altstadt", "50668": "Innenstadt/Altstadt", "50670": "Innenstadt/Altstadt",
    "50672": "Innenstadt/Altstadt", "50674": "Innenstadt/Altstadt", "50676": "Innenstadt/Altstadt",
    "50677": "Innenstadt/Altstadt", "50678": "Innenstadt/Altstadt",
    "50679": "Deutz",
    "50733": "Nippes", "50737": "Weidenpesch", "50735": "Niehl", "50739": "Nippes",
    "50765": "Chorweiler", "50767": "Chorweiler", "50769": "Niehl",
    "50823": "Ehrenfeld", "50825": "Ehrenfeld", "50827": "Ehrenfeld", "50829": "Ehrenfeld",
    "50858": "Junkersdorf", "50859": "Junkersdorf",
    "50931": "Lindenthal", "50933": "Braunsfeld", "50935": "Lindenthal",
    "50937": "Sülz", "50939": "Klettenberg",
    "50968": "Marienburg", "50969": "Zollstock",
    "50996": "Rodenkirchen", "50997": "Rodenkirchen", "50999": "Rodenkirchen",
    "51061": "Höhenhaus", "51063": "Mülheim", "51065": "Mülheim", "51067": "Mülheim",
    "51069": "Dünnwald",
    "51103": "Kalk", "51105": "Kalk", "51107": "Kalk", "51109": "Kalk",
    "51143": "Porz", "51145": "Porz", "51147": "Porz", "51149": "Porz",
    "50354": "Hürth", "50226": "Frechen", "50259": "Pulheim",
    "50321": "Brühl", "50389": "Wesseling",
    "50126": "Bergheim", "50127": "Bergheim", "50129": "Bergheim",
    "51371": "Leverkusen", "51373": "Leverkusen", "51375": "Leverkusen",
    "51377": "Leverkusen", "51379": "Leverkusen", "51381": "Leverkusen",
    "51427": "Bergisch Gladbach", "51429": "Bergisch Gladbach", "51465": "Bergisch Gladbach",
    "51467": "Bergisch Gladbach", "51469": "Bergisch Gladbach"
  };
  var PLZ_STADT = { "503": "Hürth/Brühl/Wesseling", "50354": "Hürth", "50226": "Frechen",
    "50259": "Pulheim", "50321": "Brühl", "50389": "Wesseling", "5012": "Bergheim",
    "5137": "Leverkusen", "5138": "Leverkusen", "5142": "Bergisch Gladbach",
    "5146": "Bergisch Gladbach" };

  var ZUSTAND = { "renovierungsbeduerftig": 0.88, "gepflegt": 1.0, "modernisiert": 1.07, "hochwertig": 1.12 };

  /* Bodenrichtwert-Lookup — Platzhalter für eine spätere BORIS.NRW-Anbindung. */
  function lookupBodenrichtwert(area) {
    var a = MARKTWERTE[area] || MARKTWERTE["Anderer Ort"];
    return a.bo;
  }

  /* ---- Stadtteil-Auswahl befüllen ---- */
  var areaSel = $("#bw-stadtteil");
  Object.keys(MARKTWERTE).forEach(function (k) {
    var o = document.createElement("option");
    o.value = k; o.textContent = k;
    areaSel.appendChild(o);
  });

  /* ---- PLZ → Stadtteil / Stadt automatisch vorschlagen ---- */
  var plzInput = $("#bw-plz");
  var stadtInput = $("#bw-stadt");
  var plzHint = $("#bw-plz-hint");
  plzInput.addEventListener("input", function () {
    var plz = plzInput.value.replace(/\D/g, "").slice(0, 5);
    plzInput.value = plz;
    if (plz.length !== 5) { if (plzHint) plzHint.textContent = ""; return; }
    var area = PLZ_MAP[plz];
    if (area) {
      areaSel.value = area;
      var koeln = plz.charAt(0) === "5" && ((plz >= "50667" && plz <= "51149") && !PLZ_STADT[plz] && !PLZ_STADT[plz.slice(0, 4)] && !PLZ_STADT[plz.slice(0, 3)]);
      var umland = { "Hürth": 1, "Frechen": 1, "Pulheim": 1, "Brühl": 1, "Wesseling": 1, "Bergheim": 1, "Leverkusen": 1, "Bergisch Gladbach": 1 };
      stadtInput.value = umland[area] ? area : "Köln";
      if (plzHint) plzHint.textContent = "Erkannt: " + (umland[area] ? area : "Köln-" + area);
    } else {
      areaSel.value = "Anderer Ort";
      if (plzHint) plzHint.textContent = "PLZ außerhalb unseres Kerngebiets, wir beraten Sie trotzdem gern.";
    }
  });

  /* ---- Grundstücksfläche nur bei relevanten Objekttypen ---- */
  var typSel = $("#bw-typ");
  var gsField = $("#bw-grundstueck-field");
  function toggleGrund() {
    var t = typSel.value;
    var show = (t === "Haus" || t === "Mehrfamilienhaus" || t === "Grundstück");
    gsField.style.display = show ? "" : "none";
    var wfField = $("#bw-wohnflaeche-field");
    wfField.style.display = (t === "Grundstück") ? "none" : "";
  }
  typSel.addEventListener("change", toggleGrund);
  toggleGrund();

  /* ---- Helfer ---- */
  function num(sel) {
    var v = ($(sel) || {}).value || "";
    return parseFloat(String(v).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
  }
  function val(sel) { return (($(sel) || {}).value || "").trim(); }
  var euro0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  function ageFactor(b) {
    if (!b) return 1.0;
    if (b >= 2015) return 1.06; if (b >= 2000) return 1.03; if (b >= 1980) return 1.0;
    if (b >= 1950) return 0.95; return 0.92;
  }

  function compute() {
    var area = areaSel.value || "Anderer Ort";
    var a = MARKTWERTE[area] || MARKTWERTE["Anderer Ort"];
    var t = typSel.value;
    var wf = num("#bw-wohnflaeche"), gf = num("#bw-grundstueck");
    var fZ = ZUSTAND[val("#bw-zustand")] || 1;
    var fA = ageFactor(num("#bw-baujahr"));
    var bo = lookupBodenrichtwert(area);
    var v;
    if (t === "Grundstück") {
      v = gf * bo;
    } else {
      var m2 = (t === "Wohnung") ? a.m2W : a.m2H;
      v = wf * m2 * fZ * fA;
      if ((t === "Haus" || t === "Mehrfamilienhaus") && gf > 250) {
        v += (gf - 250) * bo * 0.6; // größere Grundstücke anteilig über Bodenrichtwert
      }
    }
    return {
      low: Math.round(v * 0.95 / 1000) * 1000,
      high: Math.round(v * 1.08 / 1000) * 1000,
      area: area, tier: a.tier
    };
  }

  /* ---- Validierung + Absenden ---- */
  var errBox = $(".bw-err");
  function showErr(msg) { if (errBox) { errBox.textContent = msg; errBox.classList.add("show"); } }
  function clearErr() { if (errBox) errBox.classList.remove("show"); }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErr();
    var hp = form.querySelector(".hp input"); if (hp && hp.value) return;

    var checks = [
      [typSel.value, "Bitte wählen Sie den Immobilientyp."],
      [val("#bw-plz").length === 5 ? "x" : "", "Bitte geben Sie eine gültige Postleitzahl an (Pflichtfeld)."],
      [val("#bw-stadt"), "Bitte geben Sie die Stadt an."],
      [areaSel.value, "Bitte wählen Sie den Stadtteil bzw. Ortsteil."],
      [val("#bw-strasse"), "Bitte geben Sie die Straße an."],
      [typSel.value === "Grundstück" ? "x" : (num("#bw-wohnflaeche") > 0 ? "x" : ""), "Bitte geben Sie die Wohnfläche an."],
      [(typSel.value === "Grundstück" && num("#bw-grundstueck") <= 0) ? "" : "x", "Bitte geben Sie die Grundstücksfläche an."],
      [val("#bw-baujahr"), "Bitte geben Sie das Baujahr an."],
      [val("#bw-zustand"), "Bitte wählen Sie den Zustand."],
      [typSel.value === "Grundstück" ? "x" : val("#bw-zimmer"), "Bitte geben Sie die Zimmeranzahl an."],
      [val("#bw-name"), "Bitte geben Sie Ihren Namen an."],
      [val("#bw-telefon"), "Bitte geben Sie Ihre Telefonnummer an."],
      [/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val("#bw-email")) ? "x" : "", "Bitte geben Sie eine gültige E-Mail-Adresse an."],
      [$("#bw-datenschutz").checked ? "x" : "", "Bitte stimmen Sie der Datenschutzerklärung zu."]
    ];
    for (var i = 0; i < checks.length; i++) {
      if (!checks[i][0]) { showErr(checks[i][1]); return; }
    }

    var r = compute();

    /* Ergebnis anzeigen */
    var res = $("#bw-result");
    $("#bw-res-range").innerHTML = euro0.format(r.low) + ' <span class="sep">–</span> ' + euro0.format(r.high);
    $("#bw-res-note").textContent = "Erste Marktwert-Indikation für " + val("#bw-stadt") + ". " + r.area +
      " (" + r.tier + "). Kein Gutachten. Den genauen Verkaufswert ermitteln wir gern kostenlos und unverbindlich vor Ort.";
    form.querySelector(".bw-fields").style.display = "none";
    res.style.display = "";
    res.scrollIntoView({ behavior: "smooth", block: "center" });

    /* Lead senden */
    var lines = [
      "IMMOBILIENBEWERTUNG (Startseiten-Formular)",
      "Typ: " + typSel.value,
      "Adresse: " + val("#bw-strasse") + ", " + val("#bw-plz") + " " + val("#bw-stadt") + " (" + r.area + ")",
      "Wohnfläche: " + (num("#bw-wohnflaeche") || "–") + " m² | Grundstück: " + (num("#bw-grundstueck") || "–") + " m²",
      "Baujahr: " + val("#bw-baujahr") + " | Zimmer: " + (val("#bw-zimmer") || "–") + " | Zustand: " + val("#bw-zustand"),
      "Indikation: " + euro0.format(r.low) + " bis " + euro0.format(r.high)
    ].join("\n");
    var data = new FormData();
    data.append("name", val("#bw-name"));
    data.append("telefon", val("#bw-telefon"));
    data.append("email", val("#bw-email"));
    data.append("leistung", "Immobilienbewertung (Startseite)");
    data.append("objektart", typSel.value);
    data.append("objektadresse", val("#bw-strasse") + ", " + val("#bw-plz") + " " + val("#bw-stadt"));
    data.append("nachricht", lines);
    data.append("quelle", location.href);
    data.append("zeitpunkt", new Date().toLocaleString("de-DE"));
    (window.HS_submitLead ? window.HS_submitLead("immobilienbewertung", data) : Promise.resolve()).catch(function () {});
    if (typeof gtag === "function") { gtag("event", "generate_lead", { form_name: "immobilienbewertung" }); }
  });
})();
