/* ==========================================================================
   Highseller Immobilien & Finanzen — main.js
   Loader · Header · Mobile-Menü · Reveal · FAQ · Maps · Cookies · Formular
   ========================================================================== */
(function () {
  "use strict";
  var doc = document;
  var $  = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var on = function (el, ev, fn) { if (el) el.addEventListener(ev, fn); };

  /* ==========================================================================
     Zentrale Link-Konfiguration
     --------------------------------------------------------------------------
     Einzige Quelle der Wahrheit für die offiziellen Highseller-Profile und den
     direkten Google-Bewertungslink. Änderungen bitte AUSSCHLIESSLICH hier
     vornehmen – die Werte werden beim Laden automatisch auf alle passenden
     Elemente ([data-portal-link], [data-review-link]) angewendet und die
     Sicherheitsattribute (target/rel) erzwungen. Die identischen URLs sind
     zusätzlich statisch im HTML hinterlegt, damit die Links auch ohne
     JavaScript funktionieren.
     ========================================================================== */
  var HS_LINKS = {
    portals: {
      immoscout: "https://www.immobilienscout24.de/anbieter/profil/highseller-immobilien-und-finanzen",
      immowelt: "https://www.immowelt.de/profil/156e7c6439c042c6a6bc0f736075b070",
      kleinanzeigen: "https://www.kleinanzeigen.de/pro/Highseller-Immobilien-Baris-Oelmez"
    },
    googlePlaceId: "ChIJee8v30G_8IQRtnGkH8lyO3Y",
    // Direkter Link zum Abgeben einer Google-Bewertung (öffnet das Bewertungsfenster)
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJee8v30G_8IQRtnGkH8lyO3Y"
  };
  window.HS_LINKS = HS_LINKS;

  function applyCentralLinks() {
    // Portal-Links (ImmoScout24, Immowelt, Kleinanzeigen) zentral setzen.
    $$("[data-portal-link]").forEach(function (a) {
      var key = a.getAttribute("data-portal-link");
      var url = HS_LINKS.portals[key];
      if (url) a.setAttribute("href", url);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
    // Direkter Google-Bewertungsbutton zentral setzen.
    $$("[data-review-link]").forEach(function (a) {
      if (HS_LINKS.googleReviewUrl) a.setAttribute("href", HS_LINKS.googleReviewUrl);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
  }

  /* ---- sicherer Storage (bricht in Sandboxes nicht) ---- */
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---- Loader ---- */
  function hideLoader() {
    var l = $("#loader");
    if (l) l.classList.add("hide");
  }
  if (doc.readyState === "complete") setTimeout(hideLoader, 200);
  else on(window, "load", function () { setTimeout(hideLoader, 250); });
  // Fallback, falls load nicht feuert
  setTimeout(hideLoader, 2600);

  doc.addEventListener("DOMContentLoaded", function () {
    /* ---- Jahr im Footer ---- */
    $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

    /* ---- Zentrale Links (Portale, Google-Bewertung) anwenden ---- */
    applyCentralLinks();

    /* ---- Header beim Scrollen ---- */
    var header = $(".header");
    var onScroll = function () { if (header) header.classList.toggle("scrolled", window.scrollY > 12); };
    on(window, "scroll", onScroll, { passive: true }); onScroll();

    /* ---- Mobile-Menü ---- */
    var burger = $(".hamburger");
    on(burger, "click", function () {
      var open = doc.body.classList.toggle("nav-open");
      burger.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
    });
    $$(".mobile-menu a").forEach(function (a) {
      on(a, "click", function () { doc.body.classList.remove("nav-open"); });
    });
    /* Mobile Untermenüs aufklappen */
    $$(".m-group > button").forEach(function (btn) {
      on(btn, "click", function () {
        var g = btn.parentNode;
        var open = g.classList.contains("open");
        $$(".m-group").forEach(function (x) { x.classList.remove("open"); });
        g.classList.toggle("open", !open);
      });
    });
    on(doc, "keydown", function (e) { if (e.key === "Escape") doc.body.classList.remove("nav-open"); });

    /* ---- Reveal-Animationen ----
       Drei Sicherungen, weil unsichtbarer Inhalt schlimmer ist als ein
       fehlender Effekt: kein Observer verfuegbar, Nutzer moechte weniger
       Bewegung, oder der Observer feuert wider Erwarten nicht. */
    var revealEls = $$(".reveal");
    function alleZeigen() { revealEls.forEach(function (el) { el.classList.add("in"); }); }
    var wenigerBewegung = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (wenigerBewegung || !("IntersectionObserver" in window) || !revealEls.length) {
      alleZeigen();
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      revealEls.forEach(function (el) { io.observe(el); });
      // Rueckfall: Was nach drei Sekunden noch verborgen ist, wird gezeigt.
      setTimeout(alleZeigen, 3000);
    }

    /* ---- Kontaktleiste unten (Handy) ----
       Erst ab 600 px Scrolltiefe einblenden: Im Hero stehen dieselben Aufrufe
       bereits gross, dort waere die Leiste nur verdeckte Flaeche. Ohne JS
       bleibt sie sichtbar - die Verschiebung haengt im CSS an .js. */
    var leiste = doc.querySelector(".mobile-bar");
    if (leiste) {
      var SCHWELLE = 600;
      var leisteZeigen = function () {
        leiste.classList.toggle("is-in", (window.pageYOffset || doc.documentElement.scrollTop) > SCHWELLE);
      };
      leisteZeigen();
      /* Bewusst nicht ueber on(): dort fehlt der dritte Parameter, und
         passive:true haelt das Scrollen auf schwachen Geraeten fluessig. */
      window.addEventListener("scroll", leisteZeigen, { passive: true });
      /* Klicks messen - gtag existiert nur nach Einwilligung als echtes Tag,
         davor ist es die Warteschlange und der Aufruf bleibt folgenlos. */
      on(leiste, "click", function (e) {
        var a = e.target.closest ? e.target.closest("a") : null;
        if (!a || typeof window.gtag !== "function") return;
        window.gtag("event", "kontaktleiste_klick", {
          ziel: a.className || "", link_text: (a.textContent || "").trim()
        });
      });
    }

    /* ---- FAQ: Accordion ---- */
    $$(".faq-q").forEach(function (btn) {
      on(btn, "click", function () {
        var expanded = btn.getAttribute("aria-expanded") === "true";
        // andere im selben Container schließen (sauberes Akkordeon)
        $$(".faq-q").forEach(function (b) { if (b !== btn) b.setAttribute("aria-expanded", "false"); });
        btn.setAttribute("aria-expanded", expanded ? "false" : "true");
      });
    });
    /* ---- FAQ: Kategorie-Filter ---- */
    $$(".faq-cat").forEach(function (tab) {
      on(tab, "click", function () {
        var cat = tab.getAttribute("data-cat");
        $$(".faq-cat").forEach(function (t) { t.classList.toggle("active", t === tab); });
        $$(".faq-item").forEach(function (item) {
          var show = cat === "all" || item.getAttribute("data-cat") === cat;
          item.classList.toggle("hidden", !show);
          if (!show) { var q = $(".faq-q", item); if (q) q.setAttribute("aria-expanded", "false"); }
        });
      });
    });

    /* ---- Google Maps: erst nach Klick ODER nach Marketing-Einwilligung laden ---- */
    $$("[data-map-load]").forEach(function (btn) {
      on(btn, "click", function () {
        var wrap = btn.closest(".map-wrap");
        loadMap(wrap);
        // Ein bewusster Klick auf „Karte laden“ gilt als Einwilligung für externe
        // Medien und wird gespeichert (jederzeit über Cookie-Einstellungen widerrufbar).
        Consent.grant("marketing");
      });
    });

    /* ---- Cookie-Consent (Ablehnung als Standard) ---- */
    initCookies();

    /* ---- Kontaktformulare ---- */
    $$("form[data-contact]").forEach(initForm);

    /* ---- Formular-Segmente: Immobilie vs. Finanzierung ---- */
    $$("[data-segments]").forEach(function (wrap) {
      var form = wrap.closest("form");
      var leistung = form ? form.querySelector("[name=leistung]") : null;
      $$(".seg", wrap).forEach(function (btn) {
        on(btn, "click", function () {
          $$(".seg", wrap).forEach(function (x) { x.classList.remove("sel"); });
          btn.classList.add("sel");
          var seg = btn.getAttribute("data-segment");
          if (form) $$("[data-seg]", form).forEach(function (fld) {
            fld.style.display = fld.getAttribute("data-seg") === seg ? "" : "none";
          });
          if (leistung) leistung.value = seg === "finanzierung" ? "Baufinanzierung prüfen" : "Immobilie verkaufen";
        });
      });
    });
  });

  /* ====================== Cookie-Consent (DSGVO) ======================
     Kategorien: necessary (immer aktiv), statistics (z. B. Google Analytics),
     marketing (externe Medien: YouTube, Google Maps, Meta Pixel …).
     Kein externer Dienst wird ohne aktive Einwilligung geladen. Die Auswahl
     wird lokal gespeichert und ist über die Cookie-Einstellungen widerrufbar. */
  /* v3 seit 2026-07-28: Bis dahin lud Google Analytics fest im <head> jeder
     Seite — also auch bei abgelehnter Statistik. Die unter v2 eingeholte
     Zustimmung beschrieb damit nicht, was tatsaechlich passierte, und wird
     deshalb nicht uebernommen. Bestehende Besucher werden einmal neu gefragt. */
  var CONSENT_KEY = "hs_consent_v3";
  // Google-Analytics-4-Mess-ID. Wird erst nach Einwilligung in die Kategorie
  // "statistics" geladen (siehe applyConsent/loadAnalytics). Ohne ID kein Tracking.
  var GA_ID = "G-24CQ7EWJZ3";
  var analyticsLoaded = false;

  var Consent = (function () {
    var state = null; // {necessary:true, statistics:bool, marketing:bool} | null
    function read() { try { return JSON.parse(store.get(CONSENT_KEY) || "null"); } catch (e) { return null; } }
    return {
      load: function () { state = read(); return state; },
      current: function () { return state || { necessary: true, statistics: false, marketing: false }; },
      has: function (cat) { return !!(state && state[cat]); },
      set: function (obj) {
        state = { necessary: true, statistics: !!obj.statistics, marketing: !!obj.marketing };
        store.set(CONSENT_KEY, JSON.stringify(state));
        applyConsent();
        try { doc.dispatchEvent(new CustomEvent("hs:consent", { detail: state })); } catch (e) {}
      },
      grant: function (cat) { var c = this.current(); c[cat] = true; this.set(c); }
    };
  })();
  // Öffentliche API für künftige Einbindungen (z. B. YouTube-Video nach Zustimmung)
  window.HSConsent = Consent;

  function applyConsent() {
    var c = Consent.current();
    if (c.statistics) loadAnalytics(); else unloadAnalytics();
    if (c.marketing) { $$(".map-wrap").forEach(loadMap); loadEmbeds(); }
  }

  /* Google-Maps-Einbettung erzeugen (nur nach Einwilligung/Klick) */
  function loadMap(wrap) {
    if (!wrap || wrap.querySelector("iframe")) return;
    var src = wrap.getAttribute("data-map-src");
    if (!src) return;
    var consent = $(".map-consent", wrap);
    if (consent) consent.remove();
    var ifr = doc.createElement("iframe");
    ifr.src = src; ifr.loading = "lazy"; ifr.title = "Standort Highseller Immobilien & Finanzen";
    ifr.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    ifr.setAttribute("allowfullscreen", "");
    wrap.appendChild(ifr);
  }

  /* Generische externe Medien (Platzhalter mit data-embed-src) nach Einwilligung laden */
  function loadEmbeds() {
    $$("[data-embed-src]").forEach(function (el) {
      if (el.getAttribute("data-loaded")) return;
      el.setAttribute("data-loaded", "1");
      var ifr = doc.createElement("iframe");
      ifr.src = el.getAttribute("data-embed-src");
      ifr.loading = "lazy";
      ifr.title = el.getAttribute("data-embed-title") || "Externer Inhalt";
      ifr.setAttribute("allowfullscreen", "");
      ifr.setAttribute("frameborder", "0");
      el.innerHTML = ""; el.appendChild(ifr);
    });
  }

  /* gtag ist bereits im <head> jeder Seite definiert (Consent Mode v2, alle
     Kategorien auf "denied"). Hier nur absichern, falls das Inline-Skript
     einmal fehlt — niemals neu definieren, sonst ginge die Warteschlange
     der bereits gesetzten Defaults verloren. */
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }

  function loadAnalytics() {
    if (!GA_ID) return;
    // Einwilligung an Google melden. Muss auch dann laufen, wenn der Tag schon
    // geladen ist (Widerruf und erneute Zustimmung in derselben Sitzung).
    window.gtag("consent", "update", { analytics_storage: "granted" });
    if (analyticsLoaded) return;
    analyticsLoaded = true;
    // Offizielles Google-Tag (gtag.js) — asynchron nachladen
    var s = doc.createElement("script");
    s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    doc.head.appendChild(s);
    window.gtag("js", new Date());
    // Standard-Konfiguration: sendet auf jeder (voll geladenen) Seite einen page_view.
    // Da die Website eine klassische Multi-Page-Site ist, wird jeder Seitenwechsel
    // als vollständiger Seitenaufruf gemessen.
    window.gtag("config", GA_ID, { anonymize_ip: true });
  }

  /* Widerruf: Google die Rücknahme melden und die bereits gesetzten
     Analytics-Cookies entfernen. Ohne das Löschen bliebe die Kennung des
     Besuchers ein Jahr lang im Browser stehen. */
  function unloadAnalytics() {
    window.gtag("consent", "update", { analytics_storage: "denied" });
    var namen = doc.cookie.split(";").map(function (c) { return c.split("=")[0].trim(); })
      .filter(function (n) { return n === "_ga" || n === "_gid" || n.indexOf("_ga_") === 0; });
    var hosts = [location.hostname, "." + location.hostname];
    var basis = location.hostname.replace(/^www\./, "");
    hosts.push(basis, "." + basis);
    namen.forEach(function (n) {
      hosts.forEach(function (h) {
        doc.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=" + h;
      });
      doc.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    });
  }

  function initCookies() {
    var root = $("#cookie-consent");
    if (!root) return;
    var banner = $(".cc__banner", root);
    var modal  = $(".cc__modal", root);
    var scrim  = $(".cc__scrim", root);
    var boxes  = $$("[data-cc-cat]", root);

    function show()    { root.hidden = false; requestAnimationFrame(function () { root.classList.add("cc--show"); }); }
    function hideAll() { root.classList.remove("cc--show", "cc--modal-open"); root.hidden = true; doc.body.classList.remove("cc-lock"); }

    function openModal() {
      var c = Consent.current();
      boxes.forEach(function (b) { b.checked = !!c[b.getAttribute("data-cc-cat")]; });
      root.hidden = false;
      if (banner) banner.hidden = true;
      if (modal)  modal.hidden  = false;
      if (scrim)  scrim.hidden  = false;
      root.classList.add("cc--show", "cc--modal-open");
      doc.body.classList.add("cc-lock");
      var first = modal && modal.querySelector("button,input");
      if (first) { try { first.focus(); } catch (e) {} }
    }
    function closeModal() {
      doc.body.classList.remove("cc-lock");
      if (!Consent.load()) { // noch keine Entscheidung -> zurück zum Banner
        if (modal) modal.hidden = true;
        if (scrim) scrim.hidden = true;
        if (banner) banner.hidden = false;
        root.classList.remove("cc--modal-open");
      } else { hideAll(); }
    }

    function acceptAll() { Consent.set({ statistics: true, marketing: true }); hideAll(); }
    function rejectAll() { Consent.set({ statistics: false, marketing: false }); hideAll(); }
    function saveSelection() {
      var sel = {};
      boxes.forEach(function (b) { sel[b.getAttribute("data-cc-cat")] = b.checked; });
      Consent.set(sel); hideAll();
    }

    $$("[data-cc-accept]",  root).forEach(function (b) { on(b, "click", acceptAll); });
    $$("[data-cc-reject]",  root).forEach(function (b) { on(b, "click", rejectAll); });
    $$("[data-cc-save]",    root).forEach(function (b) { on(b, "click", saveSelection); });
    $$("[data-cc-dismiss]", root).forEach(function (b) { on(b, "click", closeModal); });
    // „Cookie-Einstellungen“-Trigger auch außerhalb des Banners (z. B. Footer)
    $$("[data-cc-open]").forEach(function (b) { on(b, "click", function (e) { e.preventDefault(); openModal(); }); });
    on(doc, "keydown", function (e) { if (e.key === "Escape" && root.classList.contains("cc--modal-open")) closeModal(); });

    // Erstaufruf: Banner zeigen, wenn keine Entscheidung gespeichert ist
    if (!Consent.load()) { if (banner) banner.hidden = false; setTimeout(show, 700); }
    else { applyConsent(); }
  }

  /* ====================== Kontaktformular ====================== */
  function initForm(form) {
    // Netlify Forms verarbeitet POSTs an "/" (statische Seite). Der frühere
    // PHP-Endpunkt entfällt.
    var endpoint = "/";
    var status = $(".form-status", form);
    var submitBtn = $("button[type=submit]", form);

    // Quelle / Zeitpunkt automatisch füllen
    var qf = form.querySelector("[name=quelle]");   if (qf) qf.value = location.href;
    var zf = form.querySelector("[name=zeitpunkt]"); if (zf) zf.value = new Date().toLocaleString("de-DE");

    // Live: Fehlermarkierung entfernen
    $$("input,select,textarea", form).forEach(function (input) {
      on(input, "input", function () {
        var f = input.closest(".field, .checkbox"); if (f) f.classList.remove("invalid");
      });
    });

    function setStatus(type, msg) {
      if (!status) return;
      status.className = "form-status " + type;
      status.textContent = msg;
    }

    on(form, "submit", function (e) {
      e.preventDefault();

      // Honeypot
      var hp = form.querySelector(".hp input");
      if (hp && hp.value) { setStatus("ok", "Vielen Dank für Ihre Nachricht."); return; }

      // Validierung
      var valid = true;
      $$("[required]", form).forEach(function (input) {
        var ok = input.type === "checkbox" ? input.checked
               : input.type === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())
               : input.value.trim() !== "";
        var field = input.closest(".field, .checkbox");
        if (field) field.classList.toggle("invalid", !ok);
        if (!ok) valid = false;
      });

      // Mindestens eine Angabe aus einer Gruppe (z. B. Telefon ODER E-Mail)
      var reqOne = form.getAttribute("data-require-one");
      if (reqOne) {
        var names = reqOne.split(/[\s,]+/).filter(Boolean);
        var oneFilled = names.some(function (n) {
          var el = form.querySelector('[name="' + n + '"]');
          return el && el.value.trim() !== "";
        });
        names.forEach(function (n) {
          var el = form.querySelector('[name="' + n + '"]');
          if (!el) return;
          var field = el.closest(".field, .checkbox");
          // Ungültig, wenn keins gefüllt ist – oder eine ausgefüllte E-Mail ungültig ist
          var bad = !oneFilled;
          if (n === "email" && el.value.trim() !== "" &&
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim())) bad = true;
          if (field) field.classList.toggle("invalid", bad);
          if (bad) valid = false;
        });
        if (!oneFilled) { setStatus("error", "Bitte geben Sie eine Telefonnummer oder E-Mail-Adresse an."); return; }
      }

      if (!valid) { setStatus("error", "Bitte füllen Sie die markierten Pflichtfelder aus."); return; }

      if (zf) zf.value = new Date().toLocaleString("de-DE");
      var data = new FormData(form);
      if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.label = submitBtn.textContent; submitBtn.textContent = "Wird gesendet …"; }
      setStatus("", "");

      // Formulare mit Datei-Upload müssen als multipart/form-data gesendet werden
      // (kein Content-Type-Header setzen -> der Browser ergänzt die Boundary).
      // Alle übrigen Formulare weiterhin klassisch als urlencoded.
      var hasFile = !!form.querySelector('input[type="file"]');
      var fetchOpts = hasFile
        ? { method: "POST", headers: { "Accept": "application/json" }, body: data }
        : {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
            body: new URLSearchParams(data).toString()
          };

      fetch(endpoint, fetchOpts)
        .then(function (r) { if (!r.ok) return Promise.reject(r); return true; })
        .then(function () {
          form.innerHTML = '<div class="form-success" role="status">' +
            '<div class="fs-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg></div>' +
            '<h3>Vielen Dank für Ihre Anfrage.</h3>' +
            '<p>Wir melden uns zeitnah persönlich bei Ihnen.</p></div>';
          if (typeof gtag === "function") { gtag("event", "generate_lead", { form_name: form.getAttribute("name") || "" }); }
          form.scrollIntoView({ behavior: "smooth", block: "center" });
        })
        .catch(function () {
          /* Fallback: E-Mail-Programm oeffnen. Die Telefonnummer gehoert in
             die Meldung - wer hier strandet, hat kein eingerichtetes
             Mailprogramm oder bricht ab, und beides kostet den Kontakt. */
          setStatus("error", "Der direkte Versand ist momentan nicht möglich. Wir öffnen Ihr E-Mail-Programm, bitte die Nachricht abschicken. Sie erreichen uns auch telefonisch unter +49 162 8811110.");
          mailtoFallback(data);
        })
        .then(function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset.label || "Anfrage absenden"; }
        });
    });
  }

  /* Shared: Lead aus den Rechnern (FormData) an Netlify Forms senden.
     formName muss einem im Build erkannten Formular entsprechen
     (siehe __forms.html). */
  window.HS_submitLead = function (formName, formData) {
    var params = new URLSearchParams();
    params.append("form-name", formName);
    formData.forEach(function (v, k) { params.append(k, v); });
    return fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: params.toString()
    });
  };

  function mailtoFallback(data) {
    var lines = [];
    var labels = {
      name: "Name", vorname: "Vorname", nachname: "Nachname", telefon: "Telefon", email: "E-Mail",
      leistung: "Leistung", bereich: "Gewünschter Bereich",
      kontaktart: "Kontaktart", objektart: "Immobilienart", objektadresse: "Objektadresse",
      wert: "Geschätzter Wert", nachricht: "Nachricht", finanzierungsdaten: "Finanzierungsdaten",
      wunschort: "Wunschort", budget: "Budget", finanzierung: "Finanzierungsstatus", budgetdaten: "Budget-Berechnung"
    };
    Object.keys(labels).forEach(function (k) {
      var v = data.get(k);
      if (v) lines.push(labels[k] + ": " + v);
    });
    var subject = "Anfrage über high-seller.de";
    var href = "mailto:info@high-seller.de?subject=" + encodeURIComponent(subject) +
               "&body=" + encodeURIComponent(lines.join("\n"));
    window.location.href = href;
  }

  /* Karriere: Klick auf eine Stellenanzeige wählt die Stelle im Formular vor,
     damit die Zuordnung nicht beim Sprung zum Formular verloren geht. */
  $$("[data-stelle]").forEach(function (link) {
    on(link, "click", function () {
      var sel = $("#bereich");
      if (sel) sel.value = link.getAttribute("data-stelle");
    });
  });

  /* Einstiege in den Wertrechner.
     --------------------------------------------------------------------------
     Zwei Wege führen hinein: die Karte im Hero derselben Seite (data-wert-start)
     und die Stadtteilseiten, die per Adressparameter ?art=… herüberschicken.
     Beide wählen am Ende dieselbe Kachel im echten Rechner an — der Zustand
     lebt ausschließlich in wertrechner.js, sonst laufen die Stellen auseinander. */
  /* Rückgabe ist bewusst das ERGEBNIS, nicht nur "Kachel gefunden": main.js wird
     vor wertrechner.js geladen. Ein Klick zu früh verpufft, weil der Zuhörer dort
     noch nicht registriert ist — die Kachel bliebe stumm zurück. */
  function wertrechnerVorwaehlen(art, springen) {
    var kachel = $('.tile[data-type="' + art + '"]');
    if (!kachel) return false;
    kachel.click();
    if (springen) {
      var rechner = $("#wertrechner");
      if (rechner) rechner.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return kachel.classList.contains("sel");
  }

  $$("[data-wert-start]").forEach(function (btn) {
    on(btn, "click", function () {
      wertrechnerVorwaehlen(btn.getAttribute("data-wert-start"), true);
    });
  });

  /* Ankunft von einer Stadtteilseite: /immobilie-bewerten.html?art=efh
     Nur bekannte Werte zulassen — der Parameter kommt aus der Adresszeile. */
  (function () {
    var treffer = /[?&]art=([a-z]+)/.exec(location.search);
    if (!treffer) return;
    var erlaubt = ["wohnung", "efh", "dhh", "reihenhaus", "mfh", "grundstueck", "gewerbe"];
    if (erlaubt.indexOf(treffer[1]) === -1) return;
    // Der Rechner baut sich erst auf; deshalb kurz warten statt sofort zugreifen.
    var versuche = 0;
    (function probieren() {
      if (wertrechnerVorwaehlen(treffer[1], false)) return;
      if (++versuche < 20) setTimeout(probieren, 100);
    })();
  })();

  /* ==========================================================================
     Sprungleiste (Handy): markiert den Abschnitt, in dem man gerade steht.
     --------------------------------------------------------------------------
     Bewusst kein IntersectionObserver: Die Abschnitte sind teils höher als der
     Bildschirm, teils niedriger, und mehrere sind gleichzeitig sichtbar. Ein
     Observer müsste dann doch entscheiden, welcher davon "der aktuelle" ist.
     Hier gilt schlicht: der letzte Abschnitt, dessen Oberkante die Leiste
     bereits passiert hat.
     ========================================================================== */
  /* Kopfhöhe als CSS-Variable — unabhängig von der Sprungleiste, weil auch
     jede andere Seite sie für den Abstand bei Ankersprüngen braucht. */
  (function () {
    var kopf = $(".header");
    if (!kopf) return;
    function setzen() {
      doc.documentElement.style.setProperty("--header-h", kopf.offsetHeight + "px");
    }
    setzen();
    on(window, "resize", setzen);
    if (window.ResizeObserver) new ResizeObserver(setzen).observe(kopf);
  })();

  (function () {
    var bar = $("#jumpbar");
    if (!bar) return;

    var links = $$("a", bar);
    var ziele = links.map(function (a) { return $(a.getAttribute("href")); });
    var aktiv = -1;
    function markieren() {
      var grenze = bar.getBoundingClientRect().bottom + 8;
      var jetzt = -1;
      for (var i = 0; i < ziele.length; i++) {
        if (ziele[i] && ziele[i].getBoundingClientRect().top <= grenze) jetzt = i;
      }
      if (jetzt === aktiv) return;
      if (aktiv > -1) links[aktiv].classList.remove("is-hier");
      aktiv = jetzt;
      if (aktiv < 0) return;
      var a = links[aktiv];
      a.classList.add("is-hier");
      // aktiven Chip in Sicht holen, ohne die Seite selbst zu verschieben
      var spur = a.parentElement;
      var soll = a.offsetLeft - (spur.clientWidth - a.offsetWidth) / 2;
      spur.scrollTo({ left: Math.max(0, soll), behavior: "smooth" });
    }

    var wartet = false;
    on(window, "scroll", function () {
      if (wartet) return;
      wartet = true;
      requestAnimationFrame(function () { markieren(); wartet = false; });
    });
    markieren();
  })();
})();
