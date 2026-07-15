import type { Context } from "@netlify/functions";
import { loadProperties } from "./_lib/propstack.mts";

/**
 * Öffentlicher Endpunkt für die Referenz-Seite "Verkaufte Objekte":
 *   GET /.netlify/functions/propstack-sold-properties
 *
 * Liefert ausschließlich Immobilien, deren Propstack-Status "Verkauft" ist.
 * Es werden bewusst KEINE Exposé-Links ausgeliefert – verkaufte Objekte
 * werden nur als sachliche Referenz dargestellt, nicht mehr beworben.
 *
 * Der Propstack API-Schlüssel bleibt serverseitig und wird nie ausgeliefert
 * oder geloggt. Die Antwortstruktur entspricht propstack-properties, damit das
 * Frontend dieselbe Diagnose-/Fehlerlogik nutzen kann.
 *
 * Die erlaubten Status-Namen lassen sich per Env-Variable überschreiben:
 *   PROPSTACK_STATUS_SOLD  – Standard: "Verkauft" (kommagetrennt möglich).
 */
export default async (_req: Request, _context: Context) => {
  const noStore = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };

  const debug = new URL(_req.url).searchParams.get("debug") === "1";

  // Nur der Status "Verkauft" (case-insensitive, exakter Vergleich).
  const allow = (process.env.PROPSTACK_STATUS_SOLD || "Verkauft")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const result = await loadProperties({ debug, allow });

    if (result.ok) {
      // Exposé-Daten für verkaufte Objekte entfernen: keine Weiterleitung,
      // kein "Exposé ansehen". Nur Referenz-Felder bleiben erhalten.
      const properties = result.properties.map((p) => ({
        ...p,
        exposeUrl: "",
      }));

      return new Response(
        JSON.stringify({
          ok: true,
          properties,
          diagnostics: result.diagnostics,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Netlify-CDN-Cache-Control":
              "public, max-age=600, stale-while-revalidate=3600",
            "Cache-Control": "public, max-age=300",
          },
        }
      );
    }

    console.error(
      "propstack-sold-properties:",
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
    console.error("propstack-sold-properties fatal:", err?.message || err);
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
