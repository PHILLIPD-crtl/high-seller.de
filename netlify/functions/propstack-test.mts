import type { Context } from "@netlify/functions";

/**
 * Diagnose-Endpunkt für die Propstack-Anbindung:
 *   GET /.netlify/functions/propstack-test
 *
 * Zweck: schnell prüfen, ob der PROPSTACK_API_KEY in Netlify gesetzt ist und
 * ob Propstack antwortet. Im Gegensatz zu `propstack-properties` werden die
 * Objekte hier ROH und UNGEFILTERT zurückgegeben – nützlich zum Debuggen der
 * Verbindung, aber nicht für die öffentliche Immobilien-Anzeige gedacht.
 *
 * Der API-Schlüssel bleibt serverseitig und wird niemals geloggt oder in der
 * Antwort ausgegeben.
 */
export default async (_req: Request, _context: Context) => {
  const noStore = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };

  const apiKey = Netlify.env.get("PROPSTACK_API_KEY");

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "missing_api_key",
        hint: "PROPSTACK_API_KEY ist in Netlify nicht gesetzt.",
      }),
      { status: 500, headers: noStore }
    );
  }

  try {
    const response = await fetch(
      "https://api.propstack.de/v1/units?per=60&expand=1",
      {
        method: "GET",
        headers: {
          "X-API-KEY": apiKey,
          Accept: "application/json",
        },
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "propstack_http_error",
          status: response.status,
          hint:
            response.status === 401
              ? "API-Schlüssel ungültig, falsch eingetragen oder nicht berechtigt."
              : "Propstack hat einen Fehler zurückgegeben.",
          data,
        }),
        { status: response.status, headers: noStore }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        properties: data,
      }),
      { status: 200, headers: noStore }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "server_error",
        message: error?.message ?? String(error),
      }),
      { status: 500, headers: noStore }
    );
  }
};
