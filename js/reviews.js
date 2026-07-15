/* ==========================================================================
   Highseller — Google-Bewertungen
   --------------------------------------------------------------------------
   Lädt Google-Bewertungen ausschließlich über die eigene, sichere
   Netlify Function „/.netlify/functions/google-reviews“. Der Browser baut
   KEINE direkte Verbindung zu Google auf – die Daten werden serverseitig
   abgerufen, anonymisiert und zwischengespeichert. Dadurch ist der Bereich
   DSGVO-freundlich und benötigt keine gesonderte Marketing-Einwilligung.

   Merkmale:
   - Lazy Loading: der Abruf startet erst, wenn der Bereich in Sichtweite kommt.
   - Ladezustand (Skeleton-Karten), Erfolgszustand, Fallback-Zustand.
   - Ruhige, elegante Marquee-Animation (pausiert beim Hover, respektiert
     „prefers-reduced-motion“).
   - Es werden ausschließlich die echten, von Google gelieferten Daten
     angezeigt – keine erfundenen Namen, Texte oder Zahlen.
   ========================================================================== */
(function () {
  "use strict";

  var ENDPOINT = "/.netlify/functions/google-reviews";

  // Feste Google-Links als Ausfallsicherung (falls die Function nicht antwortet).
  var PLACE_ID = "ChIJee8v30G_8IQRtnGkH8lyO3Y";
  var FALLBACK_REVIEWS_URL =
    "https://search.google.com/local/reviews?placeid=" + PLACE_ID;

  var section = document.getElementById("bewertungen");
  var grid = document.getElementById("google-reviews");
  var summary = document.getElementById("google-rating-summary");
  var ctaLink = document.getElementById("gr-cta-link");
  if (!grid) return;

  var scoreEl = document.getElementById("gr-score");
  var starsEl = document.getElementById("gr-stars");
  var metaEl = document.getElementById("gr-meta");

  var STAR =
    '<svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';
  var GOOGLE_G =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2 3.7-5 3.7-8.6z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.1 0-5.8-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z"/><path fill="#EA4335" d="M12 4.6c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c1-2.9 3.7-5 6.8-5z"/></svg>';

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function stars(n) {
    var count = Math.max(0, Math.min(5, Math.round(n || 0)));
    var out = "";
    for (var i = 0; i < count; i++) out += STAR;
    return out;
  }

  function fmtScore(n) {
    return Number(n).toLocaleString("de-DE", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  /* ---- Zustände ---------------------------------------------------------- */

  function setLoading() {
    grid.className = "reviews reviews--loading";
    var card =
      '<div class="review review--skeleton" aria-hidden="true">' +
      '<span class="sk sk--stars"></span>' +
      '<span class="sk sk--line"></span>' +
      '<span class="sk sk--line"></span>' +
      '<span class="sk sk--line sk--short"></span>' +
      '<span class="sk sk--who"></span>' +
      "</div>";
    grid.innerHTML = card + card + card;
    grid.setAttribute("aria-busy", "true");
  }

  function showFallback() {
    if (summary) summary.style.display = "none";
    grid.removeAttribute("aria-busy");
    grid.className = "reviews-fallback";
    grid.innerHTML =
      '<p class="reviews-fallback__msg">Unsere Google-Bewertungen konnten gerade nicht geladen werden. ' +
      "Sie können diese direkt bei Google ansehen.</p>";
  }

  function renderSummary(data) {
    if (!summary) return;
    if (!data.rating) {
      summary.style.display = "none";
      return;
    }
    if (scoreEl) scoreEl.textContent = fmtScore(data.rating);
    if (starsEl) starsEl.innerHTML = stars(data.rating);
    if (metaEl) {
      metaEl.textContent = data.count
        ? "basierend auf " + data.count + " Google-Bewertungen"
        : "Google-Bewertung";
    }
    summary.style.display = "";
  }

  function card(r) {
    var name = r.author || "Google-Nutzer";
    var initial = name.trim().charAt(0).toUpperCase() || "G";
    var when = r.date ? " · " + esc(r.date) : "";
    return (
      '<figure class="review">' +
      (r.rating
        ? '<div class="stars" aria-label="' +
          esc(r.rating) +
          ' von 5 Sternen">' +
          stars(r.rating) +
          "</div>"
        : "") +
      "<p class=\"rv-text\">" +
      esc(r.text) +
      "</p>" +
      '<div class="who"><div class="av">' +
      esc(initial) +
      "</div><div><b>" +
      esc(name) +
      "</b>" +
      '<span class="google-badge">' +
      GOOGLE_G +
      "Google-Bewertung" +
      when +
      "</span></div></div>" +
      "</figure>"
    );
  }

  function renderCards(reviews) {
    grid.removeAttribute("aria-busy");
    var cards = reviews.map(card);

    // Ruhige Endlos-Marquee nur bei genügend Karten und ohne
    // „prefers-reduced-motion“. Sonst ruhiges Karten-Raster.
    if (reduce || cards.length < 3) {
      grid.className = "reviews";
      grid.innerHTML = cards.join("");
      addExpanders();
      return;
    }
    var html = cards.join("");
    // Ruhiges Tempo: ca. 9 Sekunden pro Karte, mindestens 45 Sekunden.
    var duration = Math.max(45, cards.length * 9);
    grid.className = "review-marquee";
    grid.innerHTML =
      '<div class="review-marquee__track" style="animation-duration:' +
      duration +
      's">' +
      html +
      '<div aria-hidden="true" style="display:contents">' +
      html +
      "</div>" +
      "</div>";
    addExpanders();
    enableTouchPause();
  }

  // Lange Bewertungstexte sauber kürzen und bei Bedarf aufklappen.
  function addExpanders() {
    var texts = grid.querySelectorAll(".rv-text");
    for (var i = 0; i < texts.length; i++) {
      (function (p) {
        if (p.scrollHeight - p.clientHeight <= 4) return; // nicht abgeschnitten
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "rv-more";
        btn.textContent = "Mehr anzeigen";
        btn.setAttribute("aria-expanded", "false");
        btn.addEventListener("click", function () {
          var open = p.classList.toggle("is-open");
          btn.textContent = open ? "Weniger anzeigen" : "Mehr anzeigen";
          btn.setAttribute("aria-expanded", open ? "true" : "false");
        });
        if (p.parentNode) p.parentNode.insertBefore(btn, p.nextSibling);
      })(texts[i]);
    }
  }

  // Auf Touch-Geräten pausiert die Laufbewegung bei Berührung (analog zum Hover).
  var touchBound = false;
  function enableTouchPause() {
    if (touchBound) return;
    touchBound = true;
    var pause = function () { grid.classList.add("is-touched"); };
    var resume = function () { grid.classList.remove("is-touched"); };
    grid.addEventListener("touchstart", pause, { passive: true });
    grid.addEventListener("touchend", resume, { passive: true });
    grid.addEventListener("touchcancel", resume, { passive: true });
  }

  function apply(data) {
    // Google-Links auf den CTA-Button übernehmen.
    if (ctaLink && data && (data.reviewsUrl || data.profileUrl)) {
      ctaLink.href = data.reviewsUrl || data.profileUrl;
    }

    if (!data || data.ok === false) {
      showFallback();
      return;
    }

    renderSummary(data);

    if (Array.isArray(data.reviews) && data.reviews.length) {
      renderCards(data.reviews);
    } else if (data.rating) {
      // Google liefert Wertung, aber keine Rezensionstexte: Gesamtbewertung
      // und Button anzeigen, keine leeren Karten.
      grid.removeAttribute("aria-busy");
      grid.className = "reviews-fallback";
      grid.innerHTML =
        '<p class="reviews-fallback__msg">Lesen Sie die einzelnen Bewertungen direkt in unserem Google-Profil.</p>';
    } else {
      showFallback();
    }
  }

  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    setLoading();

    var controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, 8000)
      : null;

    fetch(ENDPOINT, {
      headers: { Accept: "application/json" },
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (timer) clearTimeout(timer);
        apply(data);
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        // Netzwerkfehler: Button trotzdem korrekt verlinken.
        if (ctaLink && !ctaLink.getAttribute("href")) {
          ctaLink.href = FALLBACK_REVIEWS_URL;
        }
        showFallback();
      });
  }

  // Lazy Loading: Abruf erst, wenn der Bereich in Sichtweite kommt.
  var trigger = section || grid;
  if ("IntersectionObserver" in window && trigger) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            io.disconnect();
            load();
          }
        });
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(trigger);
  } else {
    load();
  }
})();
