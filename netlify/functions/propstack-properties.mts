import type { Context } from "@netlify/functions";
import { loadProperties } from "./_lib/propstack.mts";

/**
 * Öffentlicher Endpunkt für das Frontend:
 *   GET /.netlify/functions/propstack-properties
 *
 * Liefert ausschließlich die für die Webseite freigegebenen Immobilien.
 * Der Propstack API-Schlüssel bleibt serverseitig und wird nie ausgeliefert
 * oder geloggt.
 *
 * Antwort bei Erfolg:
 *   { ok: true, properties: [...], diagnostics: {...} }
 *
 * Antwort bei Fehler (immer mit konkretem Fehlercode + Diagnose):
 *   { ok: false, properties: [], error, hint, status?, diagnostics }
 *
 * Mögliche error-Werte:
 *   missing_api_key              – PROPSTACK_API_KEY fehlt in Netlify
 *   propstack_http_error         – Propstack antwortete mit HTTP-Fehler (siehe status)
 *   propstack_invalid_json       – Antwort war kein gültiges JSON
 *   propstack_empty_response     – Propstack lieferte keine Objekte
 *   propstack_filter_removed_all – alle Objekte wurden ausgefiltert
 *
 * Es wird immer HTTP 200 zurückgegeben, damit die Diagnose im Browser sichtbar
 * ist und die Webseite nie "kaputt" wirkt. Das Frontend zeigt bei ok:false
 * eine freundliche Meldung an; die Diagnose hilft beim Konfigurieren.
 */
export default async (_req: Request, _context: Context) => {
  const noStore = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };

  // ?debug=1 legt ein vollständiges Rohobjekt in diagnostics.rawSample, damit
  // sich die Propstack-Feldnamen (u. a. das Status-Feld) prüfen lassen.
  const debug = new URL(_req.url).searchParams.get("debug") === "1";

  try {
    const result = await loadProperties({ debug });

    if (result.ok) {
      return new Response(
        JSON.stringify({
          ok: true,
          properties: result.properties,
          diagnostics: result.diagnostics,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            // Edge-Cache: 10 Min. frisch, danach im Hintergrund erneuern.
            "Netlify-CDN-Cache-Control":
              "public, max-age=600, stale-while-revalidate=3600",
            "Cache-Control": "public, max-age=300",
          },
        }
      );
    }

    // Fehlerfall: konkreten Fehlercode + Diagnose ausgeben (nie den Key).
    console.error(
      "propstack-properties:",
      result.error,
      "http:",
      result.diagnostics.httpStatus,
      "raw:",
      result.diagnostics.rawCount,
      "filtered:",
      result.diagnostics.filteredCount
    );

    return new Response(
      JSON.stringify({
        ok: false,
        properties: [],
        error: result.error,
        ...(result.status !== undefined ? { status: result.status } : {}),
        hint: result.hint,
        diagnostics: result.diagnostics,
      }),
      { status: 200, headers: noStore }
    );
  } catch (err: any) {
    // Nur unerwartete Netzwerk-/Laufzeitfehler landen hier.
    console.error("propstack-properties fatal:", err?.message || err);
    return new Response(
      JSON.stringify({
        ok: false,
        properties: [],
        error: "propstack_http_error",
        hint: "Propstack konnte nicht erreicht werden (Netzwerkfehler).",
        diagnostics: {
          endpoint:
            process.env.PROPSTACK_API_URL || "https://api.propstack.de/v1/units",
          httpStatus: null,
          rawCount: 0,
          filteredCount: 0,
          publishFieldSet: Boolean(process.env.PROPSTACK_PUBLISH_FIELD),
          authMethod: "x-api-key",
        },
      }),
      { status: 200, headers: noStore }
    );
  }
};
