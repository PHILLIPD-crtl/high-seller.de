/* ==========================================================================
   Highseller — Immobilienwert-Rechner (mehrstufig)
   Erste Marktwert-INDIKATION (kein Gutachten). Stadtteil-sensibel für Köln.
   Lead-Erfassung + Übergabe an Netlify Forms ("immobilienbewertung"). DSGVO-konform (Einwilligung).
   --------------------------------------------------------------------------
   HINWEIS: Die €/m²- und Bodenrichtwerte sind redaktionelle RICHTWERTE
   (Stand ~2024/25) zur ersten Orientierung und sollten regelmäßig anhand
   echter Marktdaten (z. B. Gutachterausschuss Köln, Sprengnetter, Portale)
   gepflegt werden. Für Adress-Autovervollständigung kann später Google
   Places / Mapbox ergänzt werden (siehe README).
   ========================================================================== */
(function () {
  "use strict";
  var root = document.getElementById("wertrechner");
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };

  /* ---- Stadtteil-Richtwerte (Köln + Umland). m2W=Wohnung, m2H=Haus, bo=Bodenrichtwert, tier ---- */
  var AREAS = {
    "Innenstadt/Altstadt": { m2W: 6200, m2H: 6500, bo: 2600, tier: "top" },
    "Marienburg":          { m2W: 6800, m2H: 7200, bo: 3000, tier: "top" },
    "Lindenthal":          { m2W: 6000, m2H: 6400, bo: 2400, tier: "top" },
    "Junkersdorf":         { m2W: 5200, m2H: 5600, bo: 1700, tier: "gut" },
    "Braunsfeld":          { m2W: 5500, m2H: 5800, bo: 2000, tier: "gut" },
    "Sülz":                { m2W: 5400, m2H: 5700, bo: 1900, tier: "gut" },
    "Klettenberg":         { m2W: 5500, m2H: 5800, bo: 2000, tier: "gut" },
    "Ehrenfeld":           { m2W: 5000, m2H: 5200, bo: 1700, tier: "gut" },
    "Nippes":              { m2W: 4700, m2H: 4900, bo: 1500, tier: "mittel" },
    "Deutz":               { m2W: 4900, m2H: 5100, bo: 1700, tier: "gut" },
    "Rodenkirchen":        { m2W: 5200, m2H: 5600, bo: 1800, tier: "gut" },
    "Bayenthal/Raderberg": { m2W: 5300, m2H: 5600, bo: 1900, tier: "gut" },
    "Mülheim":             { m2W: 4000, m2H: 4200, bo: 1200, tier: "mittel" },
    "Kalk":                { m2W: 3700, m2H: 3900, bo: 1000, tier: "einfach" },
    "Porz":                { m2W: 3500, m2H: 3800, bo: 900,  tier: "einfach" },
    "Chorweiler":          { m2W: 3000, m2H: 3300, bo: 700,  tier: "einfach" },
    "Hürth":               { m2W: 4200, m2H: 4500, bo: 1300, tier: "mittel" },
    "Frechen":             { m2W: 4000, m2H: 4300, bo: 1200, tier: "mittel" },
    "Brühl":               { m2W: 4100, m2H: 4400, bo: 1250, tier: "mittel" },
    "Bergheim":            { m2W: 3400, m2H: 3700, bo: 850,  tier: "einfach" },
    "Pulheim":             { m2W: 4200, m2H: 4500, bo: 1300, tier: "mittel" },
    "Leverkusen":          { m2W: 3600, m2H: 3900, bo: 1000, tier: "mittel" },
    "Bergisch Gladbach":   { m2W: 4100, m2H: 4400, bo: 1250, tier: "mittel" },
    "Anderer Ort":         { m2W: 3800, m2H: 4100, bo: 1100, tier: "mittel" }
  };
  var NACHFRAGE = { top: 1.05, gut: 1.02, mittel: 1.0, einfach: 0.97 };
  var ERTRAGSFAKTOR = { top: 26, gut: 24, mittel: 22, einfach: 19 }; // Kaufpreisfaktor (Jahresnettokaltmiete)

  /* ---- Anleger-/Finanzierungsprüfung bei vermieteten Objekten ----
     Ein Käufer finanziert den Kaufpreis über eine Annuität (Zins + Tilgung).
     Die Kaltmiete muss diese Bankrate weitgehend tragen, sonst rechnet sich
     der Kauf für einen Investor nicht. Der ausgewiesene Wert wird daher auf
     einen anlegergerechten Betrag gedeckelt. */
  var ZINS = 0.045, TILGUNG = 0.02, ANNUITAET = ZINS + TILGUNG; // 6,5 % p. a. (4,5 % Zins + 2 % Tilgung)
  var DECKUNG = 0.85; // Kaltmiete soll ~85 % der Annuität tragen (leicht negativer Cashflow akzeptiert)

  var ZUSTAND = { renovierungsbeduerftig: 0.88, gepflegt: 1.0, modernisiert: 1.07, hochwertig: 1.12, luxurioes: 1.18 };
  var ENERGIE = { "A+": 1.04, "A": 1.04, "B": 1.02, "C": 1.02, "D": 1.0, "E": 0.98, "F": 0.98, "G": 0.95, "H": 0.95, "": 1.0 };
  var FEAT = {
    neue_fenster: .5, neues_dach: 1, neue_heizung: 1, neue_elektrik: .5, modernes_bad: 1.5,
    einbaukueche: 1, fussbodenheizung: 1, parkett: .5, smarthome: .5, waermepumpe: 1.5,
    photovoltaik: 1, energetische_sanierung: 2, balkon: 1, garten: 1.5, keller: .5,
    stellplatz: 1.5, aufzug: .5
  };

  /* ---- Stadtteil-Auswahl befüllen ---- */
  var areaSel = $("#wz-stadtteil");
  Object.keys(AREAS).forEach(function (k) {
    var o = document.createElement("option"); o.value = k; o.textContent = k;
    if (k === "Ehrenfeld") {} areaSel.appendChild(o);
  });

  /* ---- PLZ → Stadtteil automatisch vorschlagen (Köln + Umland) ---- */
  var PLZ_MAP = {
    "50667":"Innenstadt/Altstadt","50668":"Innenstadt/Altstadt","50670":"Innenstadt/Altstadt",
    "50672":"Innenstadt/Altstadt","50674":"Innenstadt/Altstadt","50676":"Innenstadt/Altstadt",
    "50677":"Innenstadt/Altstadt","50678":"Innenstadt/Altstadt","50679":"Deutz",
    "50733":"Nippes","50735":"Nippes","50737":"Nippes","50739":"Nippes",
    "50765":"Chorweiler","50767":"Chorweiler","50769":"Nippes",
    "50823":"Ehrenfeld","50825":"Ehrenfeld","50827":"Ehrenfeld","50829":"Ehrenfeld",
    "50858":"Junkersdorf","50859":"Junkersdorf",
    "50931":"Lindenthal","50933":"Braunsfeld","50935":"Lindenthal",
    "50937":"Sülz","50939":"Klettenberg",
    "50968":"Marienburg","50969":"Bayenthal/Raderberg",
    "50996":"Rodenkirchen","50997":"Rodenkirchen","50999":"Rodenkirchen",
    "51061":"Mülheim","51063":"Mülheim","51065":"Mülheim","51067":"Mülheim","51069":"Mülheim",
    "51103":"Kalk","51105":"Kalk","51107":"Kalk","51109":"Kalk",
    "51143":"Porz","51145":"Porz","51147":"Porz","51149":"Porz",
    "50354":"Hürth","50226":"Frechen","50259":"Pulheim","50321":"Brühl",
    "50126":"Bergheim","50127":"Bergheim","50129":"Bergheim",
    "51371":"Leverkusen","51373":"Leverkusen","51375":"Leverkusen",
    "51377":"Leverkusen","51379":"Leverkusen","51381":"Leverkusen",
    "51427":"Bergisch Gladbach","51429":"Bergisch Gladbach","51465":"Bergisch Gladbach",
    "51467":"Bergisch Gladbach","51469":"Bergisch Gladbach"
  };
  var plzInput = $("#wz-plz");
  if (plzInput) plzInput.addEventListener("input", function () {
    var plz = plzInput.value.replace(/\D/g, "").slice(0, 5);
    plzInput.value = plz;
    if (plz.length === 5) {
      areaSel.value = PLZ_MAP[plz] || "Anderer Ort";
    }
  });

  /* ---- State ---- */
  var state = { type: "", zustand: "gepflegt", zeitraum: "", status: "", vermietet: "nein", feats: {} };

  /* ---- Kachel-/Segment-/Check-Auswahl ---- */
  $$(".tile[data-type]").forEach(function (t) {
    t.addEventListener("click", function () {
      $$(".tile[data-type]").forEach(function (x) { x.classList.remove("sel"); });
      t.classList.add("sel"); state.type = t.getAttribute("data-type");
      applyTypeVisibility();
    });
  });
  function segGroup(sel, key) {
    $$(sel).forEach(function (s) {
      s.addEventListener("click", function () {
        $$(sel).forEach(function (x) { x.classList.remove("sel"); });
        s.classList.add("sel"); state[key] = s.getAttribute("data-val");
        if (key === "vermietet") applyTypeVisibility();
      });
    });
  }
  segGroup(".seg[data-zustand]", "zustand");
  $$(".seg[data-zustand]").forEach(function (s) { s.setAttribute("data-val", s.getAttribute("data-zustand")); });
  // generische Segmentgruppen
  bindSeg("zeitraum"); bindSeg("status"); bindSeg("vermietet");
  function bindSeg(key) {
    $$('.seg[data-key="' + key + '"]').forEach(function (s) {
      s.addEventListener("click", function () {
        $$('.seg[data-key="' + key + '"]').forEach(function (x) { x.classList.remove("sel"); });
        s.classList.add("sel"); state[key] = s.getAttribute("data-val");
        if (key === "vermietet") applyTypeVisibility();
      });
    });
  }
  $$(".chk[data-feat]").forEach(function (c) {
    c.addEventListener("click", function () {
      var k = c.getAttribute("data-feat");
      if (c.classList.toggle("sel")) state.feats[k] = true; else delete state.feats[k];
    });
  });

  /* ---- Felder je Objekttyp ein/ausblenden ---- */
  function applyTypeVisibility() {
    var t = state.type || "wohnung";
    var isWohnung = t === "wohnung";
    var isHaus = (t === "efh" || t === "dhh" || t === "reihenhaus");
    var isMFH = t === "mfh";
    var isGrund = t === "grundstueck";
    var isGewerbe = t === "gewerbe";
    $$("[data-for]").forEach(function (el) {
      var fors = el.getAttribute("data-for").split(",");
      var show =
        (fors.indexOf("wohnung") > -1 && isWohnung) ||
        (fors.indexOf("haus") > -1 && (isHaus || isMFH || isGewerbe)) ||
        (fors.indexOf("grund") > -1 && (isGrund || isHaus || isMFH)) ||
        (fors.indexOf("mfh") > -1 && isMFH) ||
        (fors.indexOf("vermietet") > -1 && (isMFH || isWohnung) && state.vermietet === "ja");
      el.style.display = show ? "" : "none";
    });
  }
  applyTypeVisibility();

  /* ---- Schritt-Navigation ---- */
  var panels = $$(".step-panel");
  var steps = $$(".progress__step");
  var lbl = $("#wz-step-label");
  var cur = 0;
  var TITLES = ["Objektart", "Standort", "Eckdaten", "Zustand & Ausstattung", "Ihre Pläne", "Ergebnis & Kontakt", "Ihre Wertindikation"];

  function show(i, noScroll) {
    cur = i;
    panels.forEach(function (p, n) { p.classList.toggle("active", n === i); });
    steps.forEach(function (s, n) { s.classList.toggle("done", n < i); s.classList.toggle("active", n === i); });
    if (lbl) lbl.textContent = "Schritt " + Math.min(i + 1, 6) + " von 6 · " + TITLES[i];
    $$(".wz-err").forEach(function (b) { b.classList.remove("show"); });
    // Nur beim Navigieren zwischen Schritten scrollen, nicht beim Seitenaufruf
    if (!noScroll) root.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function err(msg) { var b = panels[cur] && panels[cur].querySelector(".wz-err"); if (b) { b.textContent = msg; b.classList.add("show"); } }

  function num(id) { var v = ($("#" + id) || {}).value || ""; return parseFloat(String(v).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0; }
  function str(id) { return (($("#" + id) || {}).value || "").trim(); }

  function validate(step) {
    if (step === 0 && !state.type) { err("Bitte wählen Sie eine Objektart."); return false; }
    if (step === 1) {
      if (str("wz-plz").length !== 5) { err("Bitte geben Sie eine gültige Postleitzahl an (Pflichtfeld)."); return false; }
      if (!str("wz-ort")) { err("Bitte geben Sie den Ort an."); return false; }
      if (!areaSel.value) { err("Bitte wählen Sie einen Stadtteil bzw. Ort."); return false; }
      if (!str("wz-strasse")) { err("Bitte geben Sie Straße und Hausnummer an."); return false; }
    }
    if (step === 2) {
      var istHaus = (state.type === "efh" || state.type === "dhh" || state.type === "reihenhaus" || state.type === "mfh");
      if (state.type !== "grundstueck" && num("wz-wohnflaeche") <= 0) { err("Bitte geben Sie die Wohnfläche an."); return false; }
      if ((state.type === "grundstueck" || istHaus) && num("wz-grundstueck") <= 0) { err("Bitte geben Sie die Grundstücksfläche an."); return false; }
      if (state.type !== "grundstueck" && !str("wz-baujahr")) { err("Bitte geben Sie das Baujahr an."); return false; }
    }
    if (step === 4) {
      if (!state.zeitraum) { err("Bitte wählen Sie Ihren geplanten Zeitraum."); return false; }
    }
    return true;
  }

  /* Schritt 4 (Zustand & Ausstattung) ist bei Grundstücken nicht relevant und wird übersprungen */
  function skipFor(i, dir) {
    if (state.type === "grundstueck" && i === 3) return i + dir;
    return i;
  }
  $$("[data-next]").forEach(function (b) {
    b.addEventListener("click", function () { if (validate(cur)) show(skipFor(cur + 1, 1)); });
  });
  $$("[data-back]").forEach(function (b) {
    b.addEventListener("click", function () { show(Math.max(0, skipFor(cur - 1, -1))); });
  });

  /* ---- Berechnung ---- */
  function featFactor() {
    var sum = 0;
    Object.keys(state.feats).forEach(function (k) { sum += FEAT[k] || 0; });
    if (sum > 12) sum = 12;
    return 1 + sum / 100;
  }
  function ageFactor() {
    var b = num("wz-baujahr");
    if (!b) return 1.0;
    if (b >= 2015) return 1.06; if (b >= 2000) return 1.03; if (b >= 1980) return 1.0;
    if (b >= 1950) return 0.95; return 0.92;
  }
  function compute() {
    var a = AREAS[areaSel.value] || AREAS["Anderer Ort"];
    var t = state.type;
    var wf = num("wz-wohnflaeche"), gf = num("wz-grundstueck");
    var fZ = ZUSTAND[state.zustand] || 1, fA = ageFactor(), fF = featFactor();
    var fE = ENERGIE[str("wz-energie")] || 1, fN = NACHFRAGE[a.tier] || 1;
    var method = "Vergleichswertverfahren";
    var base, val;

    if (t === "grundstueck") {
      base = gf * a.bo;
      val = base * fN; method = "Bodenwert (Grundstück)";
    } else if (t === "mfh" && state.vermietet === "ja" && num("wz-kaltmiete") > 0) {
      var jnk = num("wz-kaltmiete") * 12;
      val = jnk * (ERTRAGSFAKTOR[a.tier] || 22) * fZ;
      method = "Ertragswertverfahren (vereinfacht)";
      base = val;
    } else {
      var m2 = (t === "wohnung") ? a.m2W : a.m2H;
      base = wf * m2;
      val = base * fZ * fA * fF * fE * fN;
      // Grundstücksanteil bei Häusern (über Basisparzelle hinaus)
      if (t === "efh" || t === "dhh" || t === "reihenhaus" || t === "mfh") {
        var extra = Math.max(0, gf - 250) * a.bo * 0.6;
        val += extra;
      }
    }
    // ---- Anlegerprüfung: bei vermieteten Wohnungen/MFH darf der Wert nicht höher
    //      liegen, als die Kaltmiete über die Annuität (6,5 %) tragen kann. ----
    var kalt = num("wz-kaltmiete");
    var rented = (state.vermietet === "ja" && kalt > 0 && (t === "wohnung" || t === "mfh"));
    var anleger = 0, annuMonat = 0, deckung = 0, capped = false;
    if (rented) {
      anleger = (kalt * 12) / (ANNUITAET * DECKUNG); // Wert, bei dem die Kaltmiete ~85 % der Bankrate trägt
      if (anleger < val) { val = anleger; capped = true; }
      annuMonat = (val * ANNUITAET) / 12;            // resultierende monatliche Bankrate beim angesetzten Wert
      deckung = annuMonat > 0 ? (kalt / annuMonat) : 0; // Anteil der Bankrate, den die Miete deckt
      method = "Ertragswert · Anlegerprüfung (6,5 % Annuität)";
    }

    var mid = Math.round(val / 1000) * 1000;
    var low = Math.round(val * 0.95 / 1000) * 1000;
    var high = Math.round(val * 1.08 / 1000) * 1000;
    return { low: low, mid: mid, high: high, method: method, area: areaSel.value, tier: a.tier,
             fZ: fZ, fA: fA, fF: fF, fE: fE, fN: fN,
             rented: rented, capped: capped, kaltmiete: kalt,
             annuMonat: annuMonat, anleger: anleger, deckung: deckung };
  }

  /* ---- Lead-Kategorie ---- */
  function leadClass() {
    var inKoeln = (areaSel.value !== "Anderer Ort");
    if ((state.zeitraum === "sofort" || state.zeitraum === "3monate") && state.status === "eigentuemer") return inKoeln ? "A" : "B";
    if (state.zeitraum === "6monate") return "B";
    return "C";
  }

  /* ---- Formatierung ---- */
  var euro0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  /* ---- Ergebnis rendern + Lead senden ---- */
  var submitBtn = $("#wz-submit");
  var WA_BASE = "https://wa.me/491628811110?text=";

  if (submitBtn) submitBtn.addEventListener("click", function () {
    // Honeypot
    var hp = $("#wz-hp"); if (hp && hp.value) { return; }
    // Pflichtfelder Kontakt
    var vor = str("wz-vorname"), nach = str("wz-nachname"), tel = str("wz-telefon"), mail = str("wz-email");
    var ds = $("#wz-datenschutz");
    if (!vor || !nach) { err("Bitte Vor- und Nachnamen angeben."); return; }
    if (!tel) { err("Bitte geben Sie eine Telefonnummer an, damit wir Sie zurückrufen können."); return; }
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { err("Bitte eine gültige E-Mail-Adresse angeben."); return; }
    if (ds && !ds.checked) { err("Bitte stimmen Sie der Datenschutzerklärung zu."); return; }

    var r = compute();
    var lead = leadClass();

    // Ergebnis anzeigen
    $("#res-range").innerHTML = euro0.format(r.low) + ' <span class="sep">–</span> ' + euro0.format(r.high);
    $("#res-mid").textContent = "Durchschnittlicher Marktwert: ca. " + euro0.format(r.mid) + " · Methode: " + r.method;
    var fx = [
      ["Lage / Stadtteil", r.area + " (" + r.tier + ")"],
      ["Zustand", labelZustand(state.zustand)],
      ["Ausstattung", "+" + Math.round((r.fF - 1) * 100) + " %"],
      ["Energie", str("wz-energie") || "k. A."]
    ];
    if (r.rented) {
      fx.push(["Kaltmiete", euro0.format(r.kaltmiete) + " / Monat"]);
      fx.push(["Bankrate (6,5 % Annuität)", "ca. " + euro0.format(r.annuMonat) + " / Monat"]);
      fx.push(["Mietdeckung der Rate", Math.round(r.deckung * 100) + " %"]);
    }
    $("#res-factors").innerHTML = fx.map(function (f) {
      return '<div class="rf"><span>' + f[0] + '</span><b>' + f[1] + '</b></div>';
    }).join("");

    // WhatsApp-Link
    var summary = buildSummary(r, lead);
    var wa = $("#res-wa"); if (wa) wa.href = WA_BASE + encodeURIComponent(
      "Hallo Highseller, ich habe den Immobilienwert-Rechner genutzt und möchte eine Vor-Ort-Bewertung:\n\n" + summary);

    show(6);

    // Lead an Server senden (Hintergrund)
    sendLead(summary, { vorname: vor, nachname: nach, telefon: tel, email: mail, lead: lead });
  });

  function labelZustand(z) {
    return { renovierungsbeduerftig: "renovierungsbedürftig", gepflegt: "gepflegt", modernisiert: "modernisiert",
             hochwertig: "hochwertig modernisiert", luxurioes: "luxuriös" }[z] || z;
  }

  function buildSummary(r, lead) {
    var feats = Object.keys(state.feats).join(", ") || "–";
    return [
      "IMMOBILIENBEWERTUNG (Online-Indikation)",
      "Lead-Kategorie: " + lead,
      "Objektart: " + (state.type || "-"),
      "Lage: " + r.area + " (" + r.tier + ")",
      "Adresse: " + (str("wz-strasse") || "-") + ", " + (str("wz-plz") || "") + " " + (str("wz-ort") || "Köln"),
      "Wohnfläche: " + (num("wz-wohnflaeche") || "-") + " m²  |  Grundstück: " + (num("wz-grundstueck") || "-") + " m²",
      "Baujahr: " + (str("wz-baujahr") || "-") + "  |  Zimmer: " + (str("wz-zimmer") || "-"),
      "Zustand: " + labelZustand(state.zustand) + "  |  Energie: " + (str("wz-energie") || "-"),
      "Vermietet: " + state.vermietet + (num("wz-kaltmiete") ? ("  |  Kaltmiete: " + num("wz-kaltmiete") + " €/Monat") : "") + (r.rented ? ("  |  Bankrate (6,5 % Annuität) ca. " + euro0.format(r.annuMonat) + "/Monat, Mietdeckung " + Math.round(r.deckung * 100) + " %") : ""),
      "Ausstattung: " + feats,
      "Verkaufsabsicht: " + (state.zeitraum || "-") + "  |  Status: " + (state.status || "-"),
      "INDIKATION: " + euro0.format(r.low) + " bis " + euro0.format(r.high) + " (Ø Marktwert ca. " + euro0.format(r.mid) + ")"
    ].join("\n");
  }

  function sendLead(summary, c) {
    var data = new FormData();
    data.append("name", c.vorname + " " + c.nachname);
    data.append("telefon", c.telefon);
    data.append("email", c.email);
    data.append("leistung", "Immobilienbewertung (Online-Rechner)");
    data.append("objektart", state.type);
    data.append("objektadresse", (str("wz-strasse") || "") + ", " + (str("wz-plz") || "") + " " + (str("wz-ort") || "Köln"));
    data.append("nachricht", "Lead-Kategorie " + c.lead + " · Verkaufsabsicht: " + (state.zeitraum || "-"));
    data.append("finanzierungsdaten", summary);
    data.append("quelle", location.href);
    data.append("zeitpunkt", new Date().toLocaleString("de-DE"));
    (window.HS_submitLead ? window.HS_submitLead("immobilienbewertung", data) : Promise.resolve()).catch(function () {});
    if (typeof gtag === "function") { gtag("event", "generate_lead", { form_name: "immobilienbewertung" }); }
  }

  show(0, true);
})();
