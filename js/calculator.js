/* ==========================================================================
   Highseller — Baufinanzierungsrechner (Annuitätendarlehen)
   Live-Berechnung im de-DE-Format. Passend zu baufinanzierungsrechner.html
   ========================================================================== */
(function () {
  "use strict";
  var form = document.getElementById("calc");
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };

  /* GRUNDERWERBSTEUER je Bundesland (% vom Kaufpreis).
     WICHTIG: Stand 2025 — Sätze werden von den Ländern geändert, regelmäßig prüfen! */
  var GREST = {
    "Baden-Württemberg": 5.0, "Bayern": 3.5, "Berlin": 6.0, "Brandenburg": 6.5,
    "Bremen": 5.0, "Hamburg": 5.5, "Hessen": 6.0, "Mecklenburg-Vorpommern": 6.0,
    "Niedersachsen": 5.0, "Nordrhein-Westfalen": 6.5, "Rheinland-Pfalz": 5.0,
    "Saarland": 6.5, "Sachsen": 5.5, "Sachsen-Anhalt": 5.0,
    "Schleswig-Holstein": 6.5, "Thüringen": 5.0
  };

  /* Formatierer */
  var euro0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  var euro2 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var int0  = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  function pct(n) { return n.toLocaleString("de-DE", { maximumFractionDigits: 2 }); }

  /* Elemente */
  var objektart   = $("bf-objektart");
  var zinsbindung = $("zinsbindung");
  var kaufpreis   = $("kaufpreis");
  var eigenkapital= $("eigenkapital");
  var bundesland  = $("bundesland");
  var sollzins    = $("sollzins");
  var tilgung     = $("tilgung");
  var notarP      = $("notarprozent");
  var maklerP     = $("maklerprozent");
  var maklerTgl   = $("makler-toggle");
  var maklerWrap  = $("makler-wrap");
  var warn        = $("calc-warn");
  var hidden      = document.querySelector("[name=finanzierungsdaten]");
  var waBtn       = $("wa-finanzierung");
  var WA_BASE     = "https://wa.me/491628811110?text=";

  /* Bundesland-Auswahl befüllen (Standard: NRW) */
  Object.keys(GREST).forEach(function (name) {
    var o = document.createElement("option");
    o.value = name;
    o.textContent = name + " (" + pct(GREST[name]) + " %)";
    if (name === "Nordrhein-Westfalen") o.selected = true;
    bundesland.appendChild(o);
  });

  /* Geldfelder mit Tausenderpunkten */
  function bindMoney(input) {
    function format() {
      var d = input.value.replace(/[^\d]/g, "");
      input.value = d === "" ? "" : int0.format(parseInt(d, 10));
    }
    input.addEventListener("input", function () { format(); compute(); });
    input.addEventListener("blur", format);
    format();
  }
  function moneyVal(input) { var d = input.value.replace(/[^\d]/g, ""); return d ? parseInt(d, 10) : 0; }
  function pctVal(input, max) {
    var v = parseFloat(String(input.value).replace(",", ".").replace(/[^0-9.]/g, ""));
    if (isNaN(v) || v < 0) v = 0;
    if (max != null && v > max) v = max;
    return v;
  }
  function setText(id, val) { var el = $(id); if (el) el.textContent = val; }

  bindMoney(kaufpreis); bindMoney(eigenkapital);

  /* Maklerprovision an/aus */
  function syncMakler() {
    var on = maklerTgl.checked;
    if (maklerWrap) maklerWrap.style.opacity = on ? "1" : ".45";
    maklerP.disabled = !on;
  }
  maklerTgl.addEventListener("change", function () { syncMakler(); compute(); });
  syncMakler();

  [objektart, zinsbindung, bundesland, sollzins, tilgung, notarP, maklerP].forEach(function (el) {
    el.addEventListener("input", compute);
    el.addEventListener("change", compute);
  });

  /* Rechenkern */
  function compute() {
    var P  = moneyVal(kaufpreis);
    var EK = moneyVal(eigenkapital);
    var i  = pctVal(sollzins, 25) / 100;       // Sollzins p.a.
    var t  = pctVal(tilgung, 25) / 100;        // anfängliche Tilgung p.a.
    var years = parseInt(zinsbindung.value, 10) || 0;
    var grestRate = GREST[bundesland.value] || 0;

    var grest  = P * grestRate / 100;
    var notar  = P * pctVal(notarP, 20) / 100;
    var makler = maklerTgl.checked ? P * pctVal(maklerP, 20) / 100 : 0;
    var neben  = grest + notar + makler;
    var gesamt = P + neben;
    var darlehen = Math.max(0, gesamt - EK);

    var monRate = darlehen * (i + t) / 12;     // anfängliche Annuität

    /* Monatlicher Tilgungsplan -> Restschuld + 1.-Jahres-Anteile */
    var mZins = i / 12, rest = darlehen, zins1 = 0, tilg1 = 0;
    var neverAmort = darlehen > 0 && monRate <= rest * mZins + 0.001;
    if (!neverAmort) {
      for (var m = 1; m <= years * 12; m++) {
        var z = rest * mZins;
        var tilgM = monRate - z;
        if (tilgM > rest) tilgM = rest;
        rest -= tilgM;
        if (m <= 12) { zins1 += z; tilg1 += tilgM; }
        if (rest <= 0) { rest = 0; break; }
      }
    } else {
      rest = darlehen; zins1 = darlehen * i; tilg1 = monRate * 12 - zins1;
    }

    var nebenPct = P > 0 ? (neben / P * 100) : 0;

    /* Ausgabe (vor Eingabe des Kaufpreises neutrale Striche zeigen) */
    if (P === 0) {
      ["out-rate-monat", "out-kaufpreis", "out-nebenkosten", "out-grest", "out-notar",
       "out-makler", "out-eigenkapital", "out-darlehen", "out-zins1", "out-tilgung1",
       "out-restschuld"].forEach(function (id) { setText(id, "–"); });
      setText("out-rate-jahr", "–");
      setText("out-nebenkosten-pct", "");
      setText("out-grest-pct", "(" + pct(grestRate) + " %)");
      if (warn) warn.style.display = "none";
      if (hidden) hidden.value = "";
      return;
    }
    setText("out-rate-monat", darlehen > 0 ? euro2.format(monRate) : "—");
    setText("out-rate-jahr",  darlehen > 0 ? euro0.format(monRate * 12) : "kein Darlehen nötig");
    setText("out-kaufpreis",  euro0.format(P));
    setText("out-nebenkosten", euro0.format(neben));
    setText("out-nebenkosten-pct", "(" + pct(nebenPct) + " %)");
    setText("out-grest", euro0.format(grest));
    setText("out-grest-pct", "(" + pct(grestRate) + " %)");
    setText("out-notar", euro0.format(notar));
    setText("out-makler", maklerTgl.checked ? euro0.format(makler) : "—");
    setText("out-eigenkapital", "− " + euro0.format(EK));
    setText("out-darlehen", euro0.format(darlehen));
    setText("out-zins1", euro0.format(zins1));
    setText("out-tilgung1", euro0.format(tilg1));
    setText("out-restschuld", euro0.format(rest));
    setText("out-restschuld-label", "Restschuld nach " + years + (years === 1 ? " Jahr" : " Jahren"));

    /* Warnung */
    if (warn) {
      var msg = "";
      if (darlehen === 0 && P > 0) msg = "Ihr Eigenkapital deckt die Gesamtkosten, es wird kein Darlehen benötigt.";
      else if (neverAmort) msg = "Bei dieser Kombination aus Sollzins und Tilgung wird das Darlehen nicht zurückgeführt, die Rate deckt nur die Zinsen. Bitte erhöhen Sie die Tilgung.";
      if (msg) { warn.style.display = "flex"; var sp = warn.querySelector("span"); if (sp) sp.textContent = msg; }
      else { warn.style.display = "none"; }
    }

    /* Zusammenfassung für Formular + WhatsApp */
    var summary =
      "Baufinanzierung, unverbindliche Beispielrechnung\n" +
      "Objektart: " + objektart.value + "\n" +
      "Kaufpreis: " + euro0.format(P) + "\n" +
      "Eigenkapital: " + euro0.format(EK) + "\n" +
      "Bundesland: " + bundesland.value + " (Grunderwerbsteuer " + pct(grestRate) + " %)\n" +
      "Kaufnebenkosten gesamt: " + euro0.format(neben) + "\n" +
      "Darlehensbetrag: " + euro0.format(darlehen) + "\n" +
      "Sollzins: " + pct(pctVal(sollzins, 25)) + " % | Tilgung: " + pct(pctVal(tilgung, 25)) + " % | Zinsbindung: " + years + " J.\n" +
      "Monatsrate (ca.): " + (darlehen > 0 ? euro2.format(monRate) : "—") + "\n" +
      "Restschuld nach Zinsbindung: " + euro0.format(rest);

    if (hidden) hidden.value = summary;
    if (waBtn) {
      waBtn.href = WA_BASE + encodeURIComponent(
        "Hallo Highseller Immobilien & Finanzen, ich habe den Baufinanzierungsrechner genutzt und möchte ein persönliches Angebot:\n\n" + summary);
    }
  }

  compute();
})();
