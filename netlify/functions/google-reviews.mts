import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

/**
 * Sichere, serverseitige Anbindung der echten Google-Bewertungen.
 *
 *   GET /.netlify/functions/google-reviews
 *
 * Der Google-API-Schlüssel (Environment-Variable GOOGLE_MAPS_API_KEY) bleibt
 * ausschließlich serverseitig und wird niemals ausgeliefert oder geloggt. Das
 * Frontend spricht nur diesen Endpunkt an – es besteht KEINE direkte Verbindung
 * des Browsers zu Google. Damit ist der Bereich DSGVO-freundlich (keine
 * Übertragung personenbezogener Daten des Besuchers an Google).
 *
 * Antwort bei Erfolg:
 *   {
 *     ok: true,
 *     rating: number | null,          // Durchschnittsbewertung (1–5)
 *     count: number | null,           // Anzahl aller Google-Bewertungen
 *     reviews: [ { author, rating, text, date } ],  // Namen anonymisiert („M. K.“)
 *     profileUrl: string,             // Google-Unternehmensprofil
 *     reviewsUrl: string,             // direkt zu allen Google-Rezensionen
 *     source: "google",
 *     cachedAt: string                // ISO-Zeitstempel des letzten Abrufs
 *   }
 *
 * Antwort bei Fehler (immer HTTP 200, damit das Frontend sauber einen Fallback
 * zeigen kann – nie ein „kaputter“ Bereich):
 *   { ok: false, error, profileUrl, reviewsUrl }
 *
 * Caching: Die Antwort wird in Netlify Blobs zwischengespeichert und nur alle
 * paar Stunden bei Google erneuert. So entstehen keine unnötigen API-Abfragen
 * bei jedem Seitenaufruf. Zusätzlich wird ein CDN-Cache-Header gesetzt.
 */

// Feste Place-ID von Highseller Immobilien & Finanzen.
const DEFAULT_PLACE_ID = "ChIJee8v30G_8IQRtnGkH8lyO3Y";

// Wie lange gilt der zwischengespeicherte Wert als „frisch“ (in Millisekunden).
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 Stunden

// Anzahl der Rezensionen, die maximal angezeigt werden (Google liefert i. d. R.
// bis zu 5 zurück).
const MAX_REVIEWS = 5;

type NormReview = {
  author: string;
  rating: number | null;
  text: string;
  date: string | null;
};

type Payload = {
  ok: true;
  rating: number | null;
  count: number | null;
  reviews: NormReview[];
  profileUrl: string;
  reviewsUrl: string;
  source: "google";
  cachedAt: string;
};

type CacheEntry = { fetchedAt: number; payload: Payload };

/* --------------------------------------------------------------------------
   Hilfsfunktionen
   -------------------------------------------------------------------------- */

// Kanonische Google-Links, die ausschließlich aus der Place-ID gebildet werden
// (funktionieren auch, wenn die API keine URL zurückgibt).
function profileUrlFor(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
}
function reviewsUrlFor(placeId: string): string {
  return `https://search.google.com/local/reviews?placeid=${placeId}`;
}

// Namen anonymisieren: „Max Mustermann“ -> „M. M.“, „Max“ -> „M.“
function anonymize(name: string | undefined | null): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "Google-Nutzer";
  const initials = [parts[0], parts.length > 1 ? parts[parts.length - 1] : null]
    .filter(Boolean)
    .map((p) => {
      const ch = String(p).replace(/[^\p{L}]/gu, "").charAt(0);
      return ch ? ch.toUpperCase() + "." : "";
    })
    .filter(Boolean);
  return initials.length ? initials.join(" ") : "Google-Nutzer";
}

// Aus einem Datum (RFC3339-String oder Unix-Sekunden) ein deutsches
// „Monat Jahr“ formatieren, z. B. „März 2024“.
function formatDate(value: string | number | undefined | null): string | null {
  if (value == null) return null;
  let d: Date;
  if (typeof value === "number") {
    d = new Date(value * 1000); // Google (Legacy) liefert Unix-Sekunden
  } else {
    const t = Date.parse(value);
    if (Number.isNaN(t)) return null;
    d = new Date(t);
  }
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("de-DE", {
      month: "long",
      year: "numeric",
      timeZone: "Europe/Berlin",
    }).format(d);
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------------
   Google Places API – neue Variante (places.googleapis.com/v1)
   -------------------------------------------------------------------------- */
async function fetchViaPlacesV1(
  placeId: string,
  apiKey: string,
): Promise<Payload | null> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=de`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,rating,userRatingCount,googleMapsUri,reviews",
    },
  });
  if (!res.ok) return null;
  const data: any = await res.json().catch(() => null);
  if (!data || data.error) return null;

  const reviews: NormReview[] = Array.isArray(data.reviews)
    ? data.reviews
        .map((r: any): NormReview => {
          const text =
            (r.originalText && r.originalText.text) ||
            (r.text && r.text.text) ||
            "";
          return {
            author: anonymize(r.authorAttribution && r.authorAttribution.displayName),
            rating: typeof r.rating === "number" ? r.rating : null,
            text: String(text || "").trim(),
            date: formatDate(r.publishTime),
          };
        })
        .filter((r: NormReview) => r.text.length > 0)
        .slice(0, MAX_REVIEWS)
    : [];

  return {
    ok: true,
    rating: typeof data.rating === "number" ? data.rating : null,
    count: typeof data.userRatingCount === "number" ? data.userRatingCount : null,
    reviews,
    profileUrl: data.googleMapsUri || profileUrlFor(placeId),
    reviewsUrl: reviewsUrlFor(placeId),
    source: "google",
    cachedAt: "",
  };
}

/* --------------------------------------------------------------------------
   Google Places API – Legacy-Variante (maps.googleapis.com/.../details)
   Fallback, falls auf dem Schlüssel nur die klassische Places-API aktiv ist.
   -------------------------------------------------------------------------- */
async function fetchViaPlacesLegacy(
  placeId: string,
  apiKey: string,
): Promise<Payload | null> {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=rating,user_ratings_total,reviews,url` +
    `&reviews_sort=newest&language=de&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: any = await res.json().catch(() => null);
  if (!data || data.status !== "OK" || !data.result) return null;

  const result = data.result;
  const reviews: NormReview[] = Array.isArray(result.reviews)
    ? result.reviews
        .map((r: any): NormReview => ({
          author: anonymize(r.author_name),
          rating: typeof r.rating === "number" ? r.rating : null,
          text: String(r.text || "").trim(),
          date: formatDate(typeof r.time === "number" ? r.time : r.relative_time_description),
        }))
        .filter((r: NormReview) => r.text.length > 0)
        .slice(0, MAX_REVIEWS)
    : [];

  return {
    ok: true,
    rating: typeof result.rating === "number" ? result.rating : null,
    count:
      typeof result.user_ratings_total === "number"
        ? result.user_ratings_total
        : null,
    reviews,
    profileUrl: result.url || profileUrlFor(placeId),
    reviewsUrl: reviewsUrlFor(placeId),
    source: "google",
    cachedAt: "",
  };
}

/* --------------------------------------------------------------------------
   Endpunkt
   -------------------------------------------------------------------------- */
export default async (req: Request, _context: Context) => {
  const placeId =
    new URL(req.url).searchParams.get("placeId") || DEFAULT_PLACE_ID;
  const forceRefresh = new URL(req.url).searchParams.get("refresh") === "1";

  // Bei jeder Fehlerantwort weiterhin die Google-Links mitgeben, damit das
  // Frontend den Button „Alle Google-Bewertungen ansehen“ zeigen kann.
  const failure = (error: string) =>
    new Response(
      JSON.stringify({
        ok: false,
        error,
        profileUrl: profileUrlFor(placeId),
        reviewsUrl: reviewsUrlFor(placeId),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      },
    );

  let store: ReturnType<typeof getStore> | null = null;
  try {
    store = getStore("google-reviews");
  } catch {
    store = null; // Blobs nicht verfügbar (z. B. lokal ohne Setup) -> ohne Cache weiter
  }
  const cacheKey = `place-${placeId}`;

  // 1) Frischen Cache-Wert direkt ausliefern.
  let cached: CacheEntry | null = null;
  if (store) {
    cached = (await store.get(cacheKey, { type: "json" }).catch(() => null)) as
      | CacheEntry
      | null;
    if (
      !forceRefresh &&
      cached &&
      cached.payload &&
      Date.now() - cached.fetchedAt < CACHE_TTL_MS
    ) {
      return new Response(JSON.stringify(cached.payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=21600, s-maxage=43200",
        },
      });
    }
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // Kein Schlüssel konfiguriert: falls ein (auch älterer) Cache existiert,
    // diesen zeigen, sonst sauberer Fehler-Fallback.
    if (cached && cached.payload) {
      return new Response(JSON.stringify(cached.payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=1800",
        },
      });
    }
    return failure("missing_api_key");
  }

  // 2) Frisch bei Google abrufen (neue API zuerst, dann Legacy als Fallback).
  let payload: Payload | null = null;
  try {
    payload = await fetchViaPlacesV1(placeId, apiKey);
    if (!payload) payload = await fetchViaPlacesLegacy(placeId, apiKey);
  } catch {
    payload = null;
  }

  if (!payload) {
    // Abruf fehlgeschlagen: lieber einen vorhandenen (auch älteren) Cache
    // ausliefern als einen leeren Bereich zu zeigen.
    if (cached && cached.payload) {
      return new Response(JSON.stringify(cached.payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=1800",
        },
      });
    }
    return failure("google_unavailable");
  }

  payload.cachedAt = new Date().toISOString();

  // 3) Ergebnis für die nächsten Aufrufe zwischenspeichern.
  if (store) {
    await store
      .setJSON(cacheKey, { fetchedAt: Date.now(), payload } as CacheEntry)
      .catch(() => {});
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=21600, s-maxage=43200",
    },
  });
};
