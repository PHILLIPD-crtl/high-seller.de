/* ==========================================================================
   Highseller — Budget-Rechner (max. Kaufpreis, Rückwärtsrechnung)
   Variante A: Wunschrate direkt · Variante B: aus Einnahmen − Ausgaben
   Lead-Versand an Netlify Forms (Formular "budgetrechner", Ziel info@high-seller.de).
   ========================================================================== */
(function () {
  "use strict";
  var root = document.getElementById("budgetrechner");
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };

  var GREST = { // Grunderwerbsteuer in % (Stand 2025 prüfen)
    "Baden-Württemberg":5.0,"Bayern":3.5,"Berlin":6.0,"Brandenburg":6.5,"Bremen":5.0,
    "Hamburg":5.5,"Hessen":6.0,"Mecklenburg-Vorpommern":6.0,"Niedersachsen":5.0,
    "Nordrhein-Westfalen":6.5,"Rheinland-Pfalz":5.0,"Saarland":6.5,"Sachsen":5.5,
    "Sachsen-Anhalt":5.0,"Schleswig-Holstein":6.5,"Thüringen":5.0
  };
  var sel = $("b-bundesland");
  Object.keys(GREST).forEach(function (k) {
    var o = document.createElement("option"); o.value = k; o.textContent = k + " (" + de(GREST[k]) + " %)";
    if (k === "Nordrhein-Westfalen") o.selected = true; sel.appendChild(o);
  });

  var euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  function de(n){ return String(n).replace(".", ","); }
  function parseNum(v){ return parseFloat(String(v||"").replace(/\./g,"").replace(",", ".").replace(/[^\d.-]/g,"")) || 0; }
  function val(id){ return parseNum(($(id)||{}).value); }

  // Tausenderpunkte in Geld-Feldern
  root.querySelectorAll("[data-money]").forEach(function (inp) {
    inp.addEventListener("input", function () {
      var d = inp.value.replace(/\D/g, "");
      inp.value = d ? Number(d).toLocaleString("de-DE") : "";
      calc();
    });
  });
  root.querySelectorAll("input:not([data-money]),select").forEach(function (inp) {
    inp.addEventListener("input", calc);
  });

  /* Lebenshaltungskosten: Richtwert 700 € je Person im Haushalt.
     Wird beim Wechsel der Personenzahl vorgeschlagen, bleibt aber manuell änderbar. */
  var KOSTEN_PRO_PERSON = 700;
  var personenSel = $("b-personen");
  var lebenshaltung = $("b-lebenshaltung");
  var lebenshaltungManuell = false;
  if (lebenshaltung) lebenshaltung.addEventListener("input", function () { lebenshaltungManuell = true; });
  if (personenSel) personenSel.addEventListener("change", function () {
    if (!lebenshaltungManuell && lebenshaltung) {
      var p = parseInt(personenSel.value, 10) || 1;
      lebenshaltung.value = (p * KOSTEN_PRO_PERSON).toLocaleString("de-DE");
    }
    calc();
  });

  // Variante A/B
  var variant = "B";
  root.querySelectorAll(".seg[data-variant]").forEach(function (s) {
    s.addEventListener("click", function () {
      root.querySelectorAll(".seg[data-variant]").forEach(function (x){ x.classList.remove("sel"); });
      s.classList.add("sel"); variant = s.getAttribute("data-variant");
      $("grp-a").style.display = variant === "A" ? "" : "none";
      $("grp-b").style.display = variant === "B" ? "" : "none";
      calc();
    });
  });

  // Makler-Toggle
  var mt = $("b-makler-toggle");
  if (mt) mt.addEventListener("change", function () {
    $("b-makler-wrap").style.display = mt.checked ? "" : "none"; calc();
  });

  function rateFromInputs() {
    if (variant === "A") return val("b-wunschrate");
    var verfueg = val("b-einkommen") - val("b-lebenshaltung") - val("b-fixkosten") - val("b-kredite");
    var puffer = val("b-puffer");
    verfueg = verfueg * (1 - (puffer > 0 ? puffer : 0) / 100);
    return Math.max(0, verfueg);
  }

  /* Nachvollziehbare Rechnung im Ergebnis anzeigen */
  function renderBreakdown(rate) {
    var box = $("bo-breakdown");
    if (!box) return;
    if (variant !== "B" || val("b-einkommen") <= 0) { box.style.display = "none"; return; }
    var puffer = val("b-puffer");
    var vorPuffer = val("b-einkommen") - val("b-lebenshaltung") - val("b-fixkosten") - val("b-kredite");
    var rows = [
      ["Haushaltsnettoeinkommen", euro.format(val("b-einkommen"))],
      ["− Lebenshaltungskosten (" + (personenSel ? personenSel.options[personenSel.selectedIndex].text : "") + ")", euro.format(val("b-lebenshaltung"))],
      ["− Monatliche Fixkosten", euro.format(val("b-fixkosten"))],
      ["− Bestehende Kreditraten", euro.format(val("b-kredite"))]
    ];
    if (puffer > 0) rows.push(["− Sicherheitspuffer (" + de(puffer) + " %)", euro.format(Math.round(Math.max(0, vorPuffer) * puffer / 100))]);
    rows.push(["= Tragbare Monatsrate", euro.format(Math.round(rate))]);
    box.innerHTML = "<div style='font-weight:600;color:#fff;margin-bottom:8px'>So berechnen wir Ihre Rate:</div>" +
      rows.map(function (r, i) {
        var last = i === rows.length - 1;
        return "<div style='display:flex;justify-content:space-between;gap:12px;padding:3px 0" +
          (last ? ";border-top:1px solid rgba(255,255,255,.18);margin-top:6px;padding-top:8px;color:#fff;font-weight:600" : "") +
          "'><span>" + r[0] + "</span><span>" + r[1] + "</span></div>";
      }).join("");
    box.style.display = "";
  }

  function calc() {
    var rate = rateFromInputs();
    var sollzins = val("b-sollzins"), tilgung = val("b-tilgung");
    var ek = val("b-eigenkapital");
    var grest = GREST[sel.value] || 6.5;
    var notar = val("b-notarprozent"); if (notar <= 0) notar = 2;
    var maklerOn = mt ? mt.checked : false;
    var makler = maklerOn ? val("b-maklerprozent") : 0;
    var nkQuote = (grest + notar + makler) / 100;

    var out = {
      kaufpreis: 0, darlehen: 0, ek: ek, nk: 0, rate: rate, zins1: 0, tilg1: 0, rest: 0, assess: "normal"
    };

    if (rate > 0 && (sollzins + tilgung) > 0) {
      var annual = rate * 12;
      var darlehen = annual / ((sollzins + tilgung) / 100);
      var kaufpreis = (darlehen + ek) / (1 + nkQuote);
      if (kaufpreis < 0) kaufpreis = 0;
      var nk = kaufpreis * nkQuote;
      var zins1 = darlehen * (sollzins / 100) / 12;
      var tilg1 = Math.max(0, rate - zins1);
      out.kaufpreis = kaufpreis; out.darlehen = darlehen; out.nk = nk; out.zins1 = zins1; out.tilg1 = tilg1;

      // Restschuld nach Zinsbindung (monatliche Verzinsung)
      var zb = val("b-zinsbindung") || 10;
      var rest = darlehen, mz = (sollzins / 100) / 12, n = zb * 12;
      for (var i = 0; i < n && rest > 0; i++) { rest = rest + rest * mz - rate; }
      out.rest = Math.max(0, rest);

      // Einschätzung
      var ekAfterNk = ek - nk;
      if (ekAfterNk < 0 || tilg1 <= 0) out.assess = "risk";
      else if (variant === "B") {
        var netto = val("b-einkommen");
        var q = netto > 0 ? rate / netto : 0.35;
        out.assess = q < 0.30 ? "gut" : (q <= 0.40 ? "normal" : "risk");
      } else {
        out.assess = tilgung >= 3 ? "gut" : (tilgung >= 2 ? "normal" : "risk");
      }
    }

    render(out, sollzins, tilgung, grest, notar, makler, maklerOn);
    renderBreakdown(rate);
    return out;
  }

  function render(o, sollzins, tilgung, grest, notar, makler, maklerOn) {
    $("bo-kaufpreis").textContent = o.kaufpreis ? euro.format(round1k(o.kaufpreis)) : "–";
    $("bo-darlehen").textContent  = o.darlehen ? euro.format(round1k(o.darlehen)) : "–";
    $("bo-eigenkapital").textContent = euro.format(o.ek);
    $("bo-nebenkosten").textContent = o.nk ? euro.format(Math.round(o.nk)) : "–";
    $("bo-nk-pct").textContent = o.kaufpreis ? "(" + de((grest + notar + (maklerOn?makler:0)).toFixed(2).replace(/\.00$/,"")) + " %)" : "";
    $("bo-rate").textContent = o.rate ? euro.format(Math.round(o.rate)) : "–";
    $("bo-zins1").textContent = o.zins1 ? euro.format(Math.round(o.zins1)) : "–";
    $("bo-tilgung1").textContent = o.tilg1 ? euro.format(Math.round(o.tilg1)) : "–";
    $("bo-restschuld").textContent = o.darlehen ? euro.format(Math.round(o.rest)) : "–";
    $("bo-restlabel").textContent = "Restschuld nach " + (val("b-zinsbindung")||10) + " Jahren";
    var a = $("bo-assess");
    var map = { gut:["assess assess--gut","konservativ, komfortabler Puffer"],
                normal:["assess assess--normal","normal, solide tragbar"],
                risk:["assess assess--risk","ambitioniert, bitte persönlich prüfen lassen"] };
    var m = map[o.assess] || map.normal;
    a.className = m[0]; a.textContent = m[1];
  }
  function round1k(n){ return Math.round(n/1000)*1000; }

  // Lead
  var leadBtn = $("b-leadbtn");
  if (leadBtn) leadBtn.addEventListener("click", function () {
    var o = calc();
    var name = ($("b-name")||{}).value || "", tel = ($("b-telefon")||{}).value || "", mail = ($("b-email")||{}).value || "";
    var ds = $("b-datenschutz");
    var err = $("b-leaderr");
    if (!name.trim() || !tel.trim()) { err.textContent = "Bitte Name und Telefon angeben."; err.classList.add("show"); return; }
    if (ds && !ds.checked) { err.textContent = "Bitte der Datenschutzerklärung zustimmen."; err.classList.add("show"); return; }
    err.classList.remove("show");
    var summary = [
      "BUDGET-RECHNER (Kaufkraft-Indikation)",
      "Variante: " + (variant === "A" ? "Wunschrate" : "Einnahmen − Ausgaben"),
      "Personen im Haushalt: " + (personenSel ? personenSel.value : "-") +
        " | Lebenshaltung: " + euro.format(val("b-lebenshaltung")) + "/Monat",
      "Tragbare Rate: " + euro.format(Math.round(o.rate)) + "/Monat",
      "Max. Kaufpreis (ca.): " + euro.format(round1k(o.kaufpreis)),
      "Darlehen: " + euro.format(round1k(o.darlehen)) + " | Eigenkapital: " + euro.format(o.ek),
      "Kaufnebenkosten: " + euro.format(Math.round(o.nk)),
      "Objektart: " + (($("b-objektart")||{}).value||"-") + " | Bundesland: " + sel.value,
      "Sollzins: " + de(val("b-sollzins")) + " % | Tilgung: " + de(val("b-tilgung")) + " % | Zinsbindung: " + (val("b-zinsbindung")||10) + " J.",
      "Einschätzung: " + o.assess
    ].join("\n");

    var fd = new FormData();
    fd.append("name", name); fd.append("telefon", tel); fd.append("email", mail);
    fd.append("leistung", "Budget-Rechner / Finanzierungsanfrage");
    fd.append("nachricht", "Anfrage über den Budget-Rechner, bitte Finanzierung persönlich prüfen.");
    fd.append("finanzierungsdaten", summary);
    fd.append("datenschutz", "1");
    fd.append("quelle", location.href);
    fd.append("zeitpunkt", new Date().toLocaleString("de-DE"));
    var box = $("b-leadbox");
    window.HS_submitLead("budgetrechner", fd)
      .then(function (r) { return r.ok ? r.json().catch(function(){return {ok:true};}) : Promise.reject(r); })
      .then(function (res) { if (res && res.ok === false) throw 0;
        box.innerHTML = '<div class="form-success"><div class="fs-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg></div><h3>Vielen Dank für Ihre Anfrage.</h3><p>Wir melden uns zeitnah persönlich bei Ihnen.</p></div>';
        if (typeof gtag === "function") { gtag("event", "generate_lead", { form_name: "budgetrechner" }); } })
      .catch(function () {
        var href = "mailto:info@high-seller.de?subject=" + encodeURIComponent("Budget-Anfrage über high-seller.de") +
          "&body=" + encodeURIComponent("Name: " + name + "\nTelefon: " + tel + "\nE-Mail: " + mail + "\n\n" + summary);
        window.location.href = href;
      });
  });

  // WhatsApp-Link aktualisieren
  var wa = $("b-wa");
  if (wa) { var orig = wa.href; root.addEventListener("change", function () {
    var o = calc();
    wa.href = "https://wa.me/491628811110?text=" + encodeURIComponent(
      "Hallo Highseller, mein Budget-Rechner zeigt einen möglichen Kaufpreis von ca. " +
      euro.format(round1k(o.kaufpreis)) + ". Ich möchte meine Finanzierung prüfen lassen.");
  }); }

  calc();
})();
