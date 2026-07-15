import type { Context } from "@netlify/functions";
import { getPublishedProperties, type Property } from "./_lib/propstack.mts";

/**
 * Serverseitig gerenderte Detailseite einer Immobilie.
 * Erreichbar über die SEO-URL /immobilien/<slug> (siehe netlify.toml).
 *
 * Vorteile gegenüber reinem Client-Rendering:
 *  - echte, indexierbare HTML-Seite (SEO: Title, Description, Schema.org)
 *  - funktioniert auch ohne JavaScript
 */

const PHONE = "0162 88111110";
const PHONE_HREF = "tel:+491628811110";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function specRow(label: string, value: string | number | null): string {
  if (value === null || value === undefined || value === "" || value === 0) return "";
  return `<div class="pd-spec"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
}

function renderPage(p: Property): string {
  const metaTitle = `${p.title} | Highseller Immobilien & Finanzen`;
  const metaDesc =
    (p.description || `${p.objectType} in ${p.city}. ${p.priceLabel}. Jetzt bei Highseller Immobilien & Finanzen anfragen.`)
      .slice(0, 155);
  const canonical = `https://high-seller.de/immobilien/${p.slug}`;
  const cover = p.images[0]?.url || "https://high-seller.de/assets/img/og-image.jpg";

  const gallery = p.images.length
    ? `<div class="pd-gallery">
        <div class="pd-gallery__main"><img src="${esc(p.images[0].url)}" alt="${esc(p.images[0].alt)}" fetchpriority="high"></div>
        ${p.images.length > 1
          ? `<div class="pd-gallery__thumbs">${p.images
              .slice(1, 7)
              .map(
                (img) =>
                  `<img loading="lazy" src="${esc(img.url)}" alt="${esc(img.alt)}">`
              )
              .join("")}</div>`
          : ""}
      </div>`
    : `<div class="pd-gallery pd-gallery--empty">Fotos auf Anfrage</div>`;

  const schema = {
    "@context": "https://schema.org",
    "@type": ["Product", "Residence"],
    name: p.title,
    description: metaDesc,
    image: p.images.map((i) => i.url).slice(0, 8),
    url: canonical,
    ...(p.price !== null
      ? {
          offers: {
            "@type": "Offer",
            price: p.price,
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            seller: { "@type": "RealEstateAgent", name: "Highseller Immobilien & Finanzen" },
          },
        }
      : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: p.city,
      addressRegion: "NRW",
      addressCountry: "DE",
    },
  };

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(metaTitle)}</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(metaTitle)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:image" content="${esc(cover)}">
<meta property="og:url" content="${esc(canonical)}">
<link rel="icon" href="/assets/icons/favicon-32.png" sizes="32x32">
<link rel="stylesheet" href="/css/styles.css?v=11">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
<header class="header"><div class="header__inner">
  <a href="/index.html" class="brand" aria-label="Highseller Immobilien & Finanzen. Startseite"><img decoding="async" src="/assets/img/logo.png" alt="Highseller Immobilien & Finanzen Logo"></a>
  <div class="header__actions" style="margin-left:auto">
    <a class="tel-link" href="${PHONE_HREF}" style="display:flex"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>${PHONE}<small>Persönliche Beratung</small></span></a>
  </div>
</div></header>
<main>
<nav class="pd-breadcrumb"><div class="container"><a href="/index.html">Start</a> › <a href="/immobilienangebote">Immobilienangebote</a> › <span>${esc(p.title)}</span></div></nav>
<section class="section" style="padding-top:22px"><div class="container">
  <div class="pd-head">
    <div>
      <span class="eyebrow eyebrow--gold">${esc(p.objectType)} · ${esc(p.city)}${p.district ? " · " + esc(p.district) : ""}</span>
      <h1 class="headline" style="margin-bottom:8px">${esc(p.title)}</h1>
      <p class="pd-price">${esc(p.priceLabel)}</p>
    </div>
  </div>
  ${gallery}
  <div class="pd-layout">
    <div class="pd-main">
      <div class="pd-specs">
        ${specRow("Objektart", p.objectType)}
        ${specRow("Wohnfläche", p.livingSpace ? p.livingSpace.toLocaleString("de-DE") + " m²" : null)}
        ${specRow("Zimmer", p.rooms)}
        ${specRow("Grundstück", p.plotArea ? p.plotArea.toLocaleString("de-DE") + " m²" : null)}
        ${specRow("Baujahr", p.constructionYear)}
        ${specRow("Ort", [p.city, p.district].filter(Boolean).join(", "))}
      </div>
      ${p.description ? `<div class="pd-block"><h2>Beschreibung</h2><p>${esc(p.description).replace(/\n/g, "<br>")}</p></div>` : ""}
      ${p.features ? `<div class="pd-block"><h2>Ausstattung</h2><p>${esc(p.features).replace(/\n/g, "<br>")}</p></div>` : ""}
      ${p.location ? `<div class="pd-block"><h2>Lage</h2><p>${esc(p.location).replace(/\n/g, "<br>")}</p></div>` : ""}
      ${
        p.energy.class || p.energy.value || p.energy.type
          ? `<div class="pd-block"><h2>Energieausweis</h2><div class="pd-specs">
              ${specRow("Energieeffizienzklasse", p.energy.class)}
              ${specRow("Energiekennwert", p.energy.value)}
              ${specRow("Ausweistyp", p.energy.type)}
              ${specRow("Energieträger", p.energy.carrier)}
            </div></div>`
          : ""
      }
    </div>
    <aside class="pd-aside">
      <div class="pd-card">
        <h2>Anfrage zu dieser Immobilie</h2>
        <a class="pd-phone" href="${PHONE_HREF}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>Direkt anrufen<b>${PHONE}</b></span></a>
        <form class="form" name="objektanfrage" method="POST" data-netlify="true" netlify-honeypot="website" data-contact novalidate>
          <input type="hidden" name="form-name" value="objektanfrage">
          <input type="hidden" name="objekt" value="${esc(p.title)}">
          <input type="hidden" name="objekt-id" value="${esc(p.id)}">
          <input type="hidden" name="objekt-url" value="${esc(canonical)}">
          <input type="hidden" name="subject" value="Objektanfrage: ${esc(p.title)}">
          <div class="field"><label for="name">Name *</label><input id="name" name="name" type="text" required></div>
          <div class="field"><label for="telefon">Telefon *</label><input id="telefon" name="telefon" type="tel" required></div>
          <div class="field"><label for="email">E-Mail *</label><input id="email" name="email" type="email" required></div>
          <div class="field"><label for="nachricht">Nachricht</label><textarea id="nachricht" name="nachricht" placeholder="Ich interessiere mich für diese Immobilie und bitte um weitere Informationen."></textarea></div>
          <label class="checkbox"><input type="checkbox" name="datenschutz" required><span>Ich habe die <a href="/datenschutz.html" target="_blank">Datenschutzerklärung</a> gelesen. *</span></label>
          <div class="hp" aria-hidden="true"><label>Bitte leer lassen<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
          <input type="hidden" name="quelle" value="${esc(canonical)}">
          <div class="form-status" role="status" aria-live="polite"></div>
          <button type="submit" class="btn btn--gold btn--block btn--lg">Anfrage absenden</button>
          <p class="form-mini">Ihre Anfrage geht direkt an info@high-seller.de</p>
        </form>
      </div>
    </aside>
  </div>
  <p style="margin-top:30px"><a class="btn btn--ghost" href="/immobilienangebote">← Alle Immobilienangebote</a></p>
</div></section>
</main>
<footer class="footer"><div class="container"><div class="footer__legal">
  <span>© Highseller Immobilien &amp; Finanzen · Inhaber Baris Ölmez</span>
  <nav><a href="/impressum.html">Impressum</a><a href="/datenschutz.html">Datenschutz</a><a href="/kontakt.html">Kontakt</a></nav>
</div></div></footer>
<script src="/js/main.js?v=14" defer></script>
</body>
</html>`;
}

function renderMessage(title: string, message: string, status: number): Response {
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | Highseller</title>
<meta name="robots" content="noindex"><link rel="stylesheet" href="/css/styles.css?v=11"></head>
<body><header class="header"><div class="header__inner"><a href="/index.html" class="brand"><img src="/assets/img/logo.png" alt="Highseller Immobilien & Finanzen"></a></div></header>
<main><section class="section"><div class="container" style="text-align:center;max-width:640px">
<h1 class="headline">${esc(title)}</h1><p class="lead">${esc(message)}</p>
<p style="margin-top:24px"><a class="btn btn--gold" href="/immobilienangebote">Alle Immobilienangebote</a>
<a class="btn btn--ghost" href="/kontakt.html">Kontakt aufnehmen</a></p>
</div></section></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  let slug = url.searchParams.get("slug") || "";
  if (!slug) {
    const m = url.pathname.match(/\/immobilien\/([^/]+)/);
    if (m) slug = decodeURIComponent(m[1]);
  }

  if (!slug) {
    return renderMessage("Immobilie nicht gefunden", "Bitte wählen Sie eine Immobilie aus unserer Übersicht.", 404);
  }

  try {
    const properties = await getPublishedProperties();
    // Treffer über den vollständigen Slug oder die angehängte ID.
    const idPart = slug.split("-").pop();
    const property =
      properties.find((p) => p.slug === slug) ||
      properties.find((p) => p.id === idPart);

    if (!property) {
      return renderMessage(
        "Immobilie nicht mehr verfügbar",
        "Diese Immobilie ist aktuell nicht mehr verfügbar. Gerne informieren wir Sie über vergleichbare Objekte.",
        404
      );
    }

    return new Response(renderPage(property), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Netlify-CDN-Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err: any) {
    console.error("property detail error:", err?.message || err);
    return renderMessage(
      "Angebote werden vorbereitet",
      "Aktuell bereiten wir neue Immobilienangebote für Sie vor. Kontaktieren Sie uns gerne direkt für verfügbare Immobilien.",
      200
    );
  }
};
