// netlify/functions/gsc-status.js
// Liefert den Google-Search-Console-Status für sc-domain:high-seller.de als JSON.
// Auth: ?key=<GSC_STATUS_TOKEN>  |  Env-Vars: GSC_SA_KEY (Service-Account-JSON), GSC_STATUS_TOKEN
// Keine npm-Abhängigkeiten (nur Node-Bordmittel: crypto + fetch).
const crypto = require("crypto");
const SITE = "sc-domain:high-seller.de";
const SITE_ENC = encodeURIComponent(SITE);
const SITEMAP_URL = "https://high-seller.de/sitemap.xml";
const MAX_URLS = 60; // Sicherheitslimit für URL-Inspection-Aufrufe
const b64url = (input) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Token-Request fehlgeschlagen (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}
async function inspectUrl(url, headers) {
  try {
    const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE }),
    });
    if (!r.ok) return { url, error: `HTTP ${r.status}` };
    const s = (await r.json()).inspectionResult?.indexStatusResult || {};
    return {
      url,
      indexed: s.verdict === "PASS",
      coverage: s.coverageState || null,
      lastCrawl: s.lastCrawlTime || null,
    };
  } catch (e) {
    return { url, error: String(e && e.message ? e.message : e) };
  }
}
exports.handler = async (event) => {
  const given = (event.queryStringParameters && event.queryStringParameters.key) || "";
  const expected = process.env.GSC_STATUS_TOKEN || "";
  if (!expected || given !== expected) {
    return { statusCode: 401, body: JSON.stringify({ error: "unauthorized" }) };
  }
  try {
    const sa = JSON.parse(process.env.GSC_SA_KEY);
    const token = await getAccessToken(sa);
    const h = { Authorization: `Bearer ${token}` };
    // 1) Sitemap-Status laut GSC
    const sitemapsRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${SITE_ENC}/sitemaps`, { headers: h });
    const sitemaps = sitemapsRes.ok ? (await sitemapsRes.json()).sitemap || [] : [];
    // 2) Suchleistung der letzten 7 Tage (GSC-Daten laufen ~2 Tage nach)
    const fmt = (d) => d.toISOString().slice(0, 10);
    const end = new Date(Date.now() - 2 * 864e5);
    const start = new Date(Date.now() - 9 * 864e5);
    const perfRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${SITE_ENC}/searchAnalytics/query`, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end) }),
    });
    const perf = perfRes.ok ? ((await perfRes.json()).rows || [])[0] || null : null;
    // 3) URL-Liste aus der Live-Sitemap ziehen und jede URL inspizieren
    const smText = await (await fetch(SITEMAP_URL)).text();
    const urls = [...smText.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]).slice(0, MAX_URLS);
    const pages = await Promise.all(urls.map((u) => inspectUrl(u, h)));
    const indexed = pages.filter((p) => p.indexed === true).length;
    const errors = pages.filter((p) => p.error).length;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "X-Robots-Tag": "noindex", "Cache-Control": "no-store" },
      body: JSON.stringify(
        {
          site: SITE,
          generatedAt: new Date().toISOString(),
          totals: {
            urlsInSitemap: urls.length,
            indexed,
            notIndexed: urls.length - indexed - errors,
            inspectionErrors: errors,
          },
          sitemapsInGsc: sitemaps.map((s) => ({
            path: s.path,
            lastSubmitted: s.lastSubmitted,
            isPending: s.isPending,
            warnings: s.warnings,
            errors: s.errors,
          })),
          searchPerformanceLast7Days: perf
            ? { clicks: perf.clicks, impressions: perf.impressions, ctr: perf.ctr, position: perf.position }
            : null,
          pages,
        },
        null,
        1
      ),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e && e.message ? e.message : e) }) };
  }
};
