import type { Context } from "@netlify/functions";

/**
 * Wird von Netlify nach jeder verifizierten Formular-Übermittlung ausgelöst
 * (Event "submission-created", Dateiname muss so heißen).
 *
 * Aufgaben:
 *  1. Baut aus den Formulardaten eine hochwertige, strukturierte HTML-E-Mail
 *     im Highseller-Corporate-Design (dunkelblau + goldene Akzente) und
 *     versendet sie als interne Benachrichtigung an info@high-seller.de.
 *  2. Versendet – sofern eine E-Mail-Adresse übermittelt wurde – eine
 *     professionell gestaltete Eingangsbestätigung an den Interessenten.
 *
 * Versand:
 *  - Wenn RESEND_API_KEY gesetzt ist, werden beide Mails über Resend
 *    (https://resend.com) verschickt (HTML + Plain-Text-Fallback).
 *  - Ist kein Schlüssel gesetzt, greift zusätzlich die native
 *    E-Mail-Benachrichtigung von Netlify Forms (in der Netlify-UI auf
 *    info@high-seller.de einstellen). Die Funktion bricht dann sauber ab.
 *
 * Environment Variables:
 *   RESEND_API_KEY   – API-Schlüssel von Resend (aktiviert das gestaltete Design)
 *   RESEND_FROM      – Absender, Standard: "Highseller Immobilien & Finanzen <website@high-seller.de>"
 *   LEAD_TO          – interner Empfänger, Standard: info@high-seller.de
 */

/* -------------------------------------------------------------------------- */
/* Konstanten / Corporate Design                                              */
/* -------------------------------------------------------------------------- */

const BRAND_NAVY = "#0B1A30";
const BRAND_NAVY_2 = "#13294A";
const BRAND_ACCENT = "#2F7CD3"; // Highseller-Akzentblau
const BRAND_GOLD = "#C9A227"; // goldener Akzent
const PAGE_BG = "#eef2f7"; // sehr helles Grau außerhalb des Inhalts
const LINK_COLOR = "#1E5FA8";

const TO = "info@high-seller.de";
const LOGO_URL = "https://high-seller.de/assets/img/logo.png";
const WEBSITE_URL = "https://high-seller.de";
const COMPANY_NAME = "Highseller Immobilien & Finanzen";
const COMPANY_PHONE = "0162 88111110";
const COMPANY_PHONE_TEL = "+491628811110";
const COMPANY_EMAIL = "info@high-seller.de";
const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Betreff-Präfix je Formular (dynamischer Betreff: "Neue X – Name")
const SUBJECT_LABELS: Record<string, string> = {
  kontakt: "Kontaktanfrage",
  "kontakt-startseite": "Kontaktanfrage",
  kaeuferkartei: "Suchprofil-Anfrage",
  finanzierungsanfrage: "Finanzierungsanfrage",
  immobilienbewertung: "Immobilienbewertung",
  budgetrechner: "Finanzierungsanfrage",
  objektanfrage: "Objektanfrage",
  newsletter: "Newsletter-Anmeldung",
  karriere: "Bewerbung",
};

type Group = "kontakt" | "anfrage" | "technik";

interface FieldDef {
  label: string;
  group: Group;
  type?: "email" | "tel" | "url" | "text";
}

// Feld-Definitionen: Label, Zielbereich und (optional) Typ für klickbare Werte.
const FIELDS: Record<string, FieldDef> = {
  // --- Kontaktdaten ---
  vorname: { label: "Vorname", group: "kontakt" },
  nachname: { label: "Nachname", group: "kontakt" },
  name: { label: "Vollständiger Name", group: "kontakt" },
  telefon: { label: "Telefonnummer", group: "kontakt", type: "tel" },
  email: { label: "E-Mail-Adresse", group: "kontakt", type: "email" },
  kontaktart: { label: "Bevorzugte Kontaktart", group: "kontakt" },
  rueckrufzeit: { label: "Gewünschte Rückrufzeit", group: "kontakt" },

  // --- Anfrage & Immobilie ---
  leistung: { label: "Gewünschte Leistung", group: "anfrage" },
  anfrageart: { label: "Art der Anfrage", group: "anfrage" },
  bereich: { label: "Gewünschter Bereich", group: "anfrage" },
  nachricht: { label: "Nachricht", group: "anfrage" },
  objekt: { label: "Objekt", group: "anfrage" },
  objektart: { label: "Immobilienart", group: "anfrage" },
  objektadresse: { label: "Objektadresse", group: "anfrage" },
  ort: { label: "Ort", group: "anfrage" },
  stadtteil: { label: "Stadtteil", group: "anfrage" },
  kaufpreis: { label: "Kaufpreis", group: "anfrage" },
  preisvorstellung: { label: "Preisvorstellung", group: "anfrage" },
  wert: { label: "Geschätzter Wert", group: "anfrage" },
  wohnflaeche: { label: "Wohnfläche", group: "anfrage" },
  grundstuecksflaeche: { label: "Grundstücksfläche", group: "anfrage" },
  zimmer: { label: "Zimmer", group: "anfrage" },
  baujahr: { label: "Baujahr", group: "anfrage" },
  wunschort: { label: "Wunschort", group: "anfrage" },
  budget: { label: "Budget", group: "anfrage" },
  finanzierung: { label: "Finanzierungsstatus", group: "anfrage" },
  finanzierungsdaten: { label: "Berechnung / Details", group: "anfrage" },
  budgetdaten: { label: "Budget-Berechnung", group: "anfrage" },
  lebenslauf: { label: "Lebenslauf / Unterlagen", group: "anfrage", type: "url" },
  referenznummer: { label: "Referenznummer", group: "anfrage" },
  "objekt-url": { label: "Link zur Immobilie", group: "anfrage", type: "url" },

  // --- Technische Informationen ---
  "objekt-id": { label: "Objekt-ID", group: "technik" },
  zeitpunkt: { label: "Datum / Uhrzeit", group: "technik" },
  quelle: { label: "Herkunftsseite", group: "technik", type: "url" },
  datenschutz: { label: "Einwilligung Datenschutz", group: "technik" },
};

// Felder, die niemals in der Mail auftauchen (technische Steuerfelder).
const HIDDEN = new Set(["form-name", "website", "bot-field", "subject"]);

/* -------------------------------------------------------------------------- */
/* Helfer                                                                     */
/* -------------------------------------------------------------------------- */

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isFilled(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s !== "" && s !== "undefined" && s !== "null";
}

function isValidEmail(v: unknown): boolean {
  const s = String(v ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function fullName(data: Record<string, string>): string {
  if (isFilled(data.name)) return String(data.name).trim();
  const parts = [data.vorname, data.nachname].filter(isFilled).join(" ").trim();
  if (parts) return parts;
  if (isFilled(data.email)) return String(data.email).trim();
  return "Interessent";
}

function subjectFor(formName: string, data: Record<string, string>): string {
  if (isFilled(data.subject)) return String(data.subject).trim();
  const label = SUBJECT_LABELS[formName] || "Anfrage";
  return `Neue ${label} – ${fullName(data)}`;
}

// Wert für die HTML-Darstellung aufbereiten (klickbare Links/Mails/Telefon).
function htmlValue(key: string, raw: string): string {
  const def = FIELDS[key];
  const safe = esc(raw).replace(/\n/g, "<br>");
  if (!def) return safe;
  if (def.type === "email" && isValidEmail(raw)) {
    return `<a href="mailto:${esc(raw)}" style="color:${LINK_COLOR};text-decoration:none;font-weight:600">${safe}</a>`;
  }
  if (def.type === "tel") {
    const tel = String(raw).replace(/[^\d+]/g, "");
    return `<a href="tel:${esc(tel)}" style="color:${LINK_COLOR};text-decoration:none;font-weight:600">${safe}</a>`;
  }
  if (def.type === "url" && /^https?:\/\//i.test(String(raw).trim())) {
    const label = key === "lebenslauf" ? "Datei öffnen" : safe;
    return `<a href="${esc(raw)}" style="color:${LINK_COLOR};text-decoration:none;font-weight:600">${label}</a>`;
  }
  return safe;
}

interface Row {
  key: string;
  label: string;
  value: string;
}

// Übermittelte Felder in die drei Bereiche einsortieren – leere Werte fallen weg.
function groupedRows(data: Record<string, string>): Record<Group, Row[]> {
  const out: Record<Group, Row[]> = { kontakt: [], anfrage: [], technik: [] };
  Object.keys(data).forEach((key) => {
    if (HIDDEN.has(key)) return;
    if (!isFilled(data[key])) return;
    const def = FIELDS[key];
    if (!def) return; // unbekannte / technische Variablennamen nicht anzeigen
    out[def.group].push({ key, label: def.label, value: data[key] });
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/* Wiederverwendbare Layout-Bausteine (Inline-CSS, tabellenbasiert)           */
/* -------------------------------------------------------------------------- */

function shell(inner: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${esc(COMPANY_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAGE_BG};font-size:1px;line-height:1px">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_BG}">
  <tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(11,26,48,.10)">
      <tr><td style="background:${BRAND_NAVY};padding:24px 28px" align="left">
        <img src="${LOGO_URL}" width="168" alt="${esc(COMPANY_NAME)}" style="display:block;border:0;max-width:168px;height:auto">
      </td></tr>
      ${inner}
      <tr><td style="background:${BRAND_NAVY};padding:22px 28px">
        <div style="color:#ffffff;font-size:14px;font-weight:700;font-family:${FONT_STACK}">${esc(COMPANY_NAME)}</div>
        <div style="color:#9fb3d1;font-size:12px;line-height:1.7;margin-top:6px;font-family:${FONT_STACK}">
          Telefon: <a href="tel:${COMPANY_PHONE_TEL}" style="color:#cfe0f5;text-decoration:none">${esc(COMPANY_PHONE)}</a><br>
          E-Mail: <a href="mailto:${COMPANY_EMAIL}" style="color:#cfe0f5;text-decoration:none">${esc(COMPANY_EMAIL)}</a><br>
          Web: <a href="${WEBSITE_URL}" style="color:#cfe0f5;text-decoration:none">high-seller.de</a>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,.12);margin-top:16px;padding-top:14px;color:#7f95b6;font-size:11px;line-height:1.7;font-family:${FONT_STACK}">
          ${esc(COMPANY_NAME)} · Inhaber Baris Ölmez · Im Zollhafen 18, Kranhaus 1, 50678 Köln<br>
          Tätig als Immobilienmakler nach § 34c GewO sowie als Immobiliardarlehensvermittler nach § 34i GewO.
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function sectionCard(title: string, rows: Row[]): string {
  if (!rows.length) return "";
  const body = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:11px 16px;font-size:12px;color:#5a6b83;font-weight:600;font-family:${FONT_STACK};vertical-align:top;width:180px;border-bottom:1px solid #eef2f7">${esc(
        r.label
      )}</td>
        <td style="padding:11px 16px;font-size:15px;color:#12233d;font-family:${FONT_STACK};vertical-align:top;border-bottom:1px solid #eef2f7">${htmlValue(
        r.key,
        r.value
      )}</td>
      </tr>`
    )
    .join("");
  return `
  <tr><td style="padding:0 28px 4px">
    <div style="font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${BRAND_ACCENT};font-family:${FONT_STACK};margin:18px 0 10px">
      ${esc(title)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6ebf2;border-radius:12px;overflow:hidden;background:#fbfcfe">
      ${body}
    </table>
  </td></tr>`;
}

function actionButtons(data: Record<string, string>): string {
  const btns: string[] = [];
  const mk = (href: string, label: string, primary: boolean) =>
    `<a href="${esc(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;font-family:${FONT_STACK};${
      primary
        ? `background:${BRAND_ACCENT};color:#ffffff`
        : `background:#ffffff;color:${BRAND_NAVY};border:1px solid ${BRAND_ACCENT}`
    }">${esc(label)}</a>`;

  if (isFilled(data.telefon)) {
    btns.push(mk("tel:" + String(data.telefon).replace(/[^\d+]/g, ""), "📞 Interessenten anrufen", true));
  }
  if (isValidEmail(data.email)) {
    btns.push(mk("mailto:" + String(data.email).trim(), "✉ E-Mail schreiben", false));
  }
  if (/^https?:\/\//i.test(String(data["objekt-url"] || "").trim())) {
    btns.push(mk(String(data["objekt-url"]).trim(), "🏠 Immobilie öffnen", false));
  }
  if (/^https?:\/\//i.test(String(data.quelle || "").trim())) {
    btns.push(mk(String(data.quelle).trim(), "🔗 Anfrage auf der Website öffnen", false));
  }
  if (!btns.length) return "";
  return `
  <tr><td style="padding:22px 28px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff8e8;border:1px solid ${BRAND_GOLD};border-radius:12px">
      <tr><td style="padding:18px 20px">
        <div style="font-size:15px;font-weight:800;color:${BRAND_NAVY};font-family:${FONT_STACK}">Nächster Schritt</div>
        <div style="font-size:14px;color:#4a5568;font-family:${FONT_STACK};margin:6px 0 12px">
          Bitte diese Anfrage zeitnah prüfen und den Interessenten kontaktieren.
        </div>
        ${btns.join("")}
      </td></tr>
    </table>
  </td></tr>`;
}

/* -------------------------------------------------------------------------- */
/* Interne Benachrichtigungs-Mail                                             */
/* -------------------------------------------------------------------------- */

function buildInternalHtml(formName: string, data: Record<string, string>): string {
  const groups = groupedRows(data);
  const label = SUBJECT_LABELS[formName] || "Anfrage";
  const inner = `
  <tr><td style="padding:24px 28px 0">
    <div style="font-size:22px;font-weight:800;color:${BRAND_NAVY};font-family:${FONT_STACK};line-height:1.25">
      Neue Anfrage über high-seller.de
    </div>
    <span style="display:inline-block;margin-top:10px;background:#ebf3fc;color:${BRAND_ACCENT};font-size:12px;font-weight:700;padding:6px 14px;border-radius:999px;font-family:${FONT_STACK}">${esc(
    label
  )}</span>
  </td></tr>
  ${sectionCard("Kontaktdaten", groups.kontakt)}
  ${sectionCard("Anfrage und Immobilie", groups.anfrage)}
  ${sectionCard("Technische Informationen", groups.technik)}
  ${actionButtons(data)}
  <tr><td style="height:8px"></td></tr>`;
  return shell(inner, `Neue ${label} – ${fullName(data)}`);
}

function buildInternalText(formName: string, data: Record<string, string>): string {
  const groups = groupedRows(data);
  const label = SUBJECT_LABELS[formName] || "Anfrage";
  const lines: string[] = [];
  lines.push("NEUE ANFRAGE ÜBER HIGH-SELLER.DE");
  lines.push(label);
  lines.push("");
  const block = (title: string, rows: Row[]) => {
    if (!rows.length) return;
    lines.push("== " + title + " ==");
    rows.forEach((r) => lines.push(r.label + ": " + String(r.value).replace(/\s+/g, " ").trim()));
    lines.push("");
  };
  block("Kontaktdaten", groups.kontakt);
  block("Anfrage und Immobilie", groups.anfrage);
  block("Technische Informationen", groups.technik);
  lines.push("--");
  lines.push(COMPANY_NAME);
  lines.push("Telefon: " + COMPANY_PHONE + " · " + COMPANY_EMAIL + " · high-seller.de");
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/* Eingangsbestätigung an den Interessenten                                   */
/* -------------------------------------------------------------------------- */

function buildConfirmationHtml(data: Record<string, string>): string {
  const groups = groupedRows(data);
  // Für die Bestätigung nur inhaltlich relevante Angaben zeigen (keine Technik).
  const summary = [...groups.kontakt, ...groups.anfrage].filter(
    (r) => r.key !== "datenschutz"
  );
  const summaryCard = summary.length
    ? sectionCard("Ihre übermittelten Angaben", summary)
    : "";
  const inner = `
  <tr><td style="padding:24px 28px 0">
    <div style="font-size:22px;font-weight:800;color:${BRAND_NAVY};font-family:${FONT_STACK};line-height:1.3">
      Vielen Dank für Ihre Anfrage.
    </div>
    <p style="font-size:15px;color:#3c485e;line-height:1.7;font-family:${FONT_STACK};margin:14px 0 0">
      Wir haben Ihre Nachricht erfolgreich erhalten. Ein Mitarbeiter von ${esc(
        COMPANY_NAME
      )} wird Ihr Anliegen prüfen und sich zeitnah persönlich bei Ihnen melden.
    </p>
  </td></tr>
  ${summaryCard}
  <tr><td style="padding:22px 28px 6px">
    <p style="font-size:15px;color:#3c485e;line-height:1.7;font-family:${FONT_STACK};margin:0">
      Mit freundlichen Grüßen<br>
      <strong style="color:${BRAND_NAVY}">Ihr Team von ${esc(COMPANY_NAME)}</strong>
    </p>
  </td></tr>
  <tr><td style="height:8px"></td></tr>`;
  return shell(inner, "Wir haben Ihre Anfrage erhalten und melden uns zeitnah.");
}

function buildConfirmationText(data: Record<string, string>): string {
  const groups = groupedRows(data);
  const summary = [...groups.kontakt, ...groups.anfrage].filter(
    (r) => r.key !== "datenschutz"
  );
  const lines: string[] = [];
  lines.push("Vielen Dank für Ihre Anfrage.");
  lines.push("");
  lines.push(
    "Wir haben Ihre Nachricht erfolgreich erhalten. Ein Mitarbeiter von " +
      COMPANY_NAME +
      " wird Ihr Anliegen prüfen und sich zeitnah persönlich bei Ihnen melden."
  );
  if (summary.length) {
    lines.push("");
    lines.push("Ihre übermittelten Angaben:");
    summary.forEach((r) =>
      lines.push("- " + r.label + ": " + String(r.value).replace(/\s+/g, " ").trim())
    );
  }
  lines.push("");
  lines.push("Mit freundlichen Grüßen");
  lines.push("Ihr Team von " + COMPANY_NAME);
  lines.push("");
  lines.push(COMPANY_NAME);
  lines.push("Telefon: " + COMPANY_PHONE);
  lines.push("E-Mail: " + COMPANY_EMAIL);
  lines.push("Web: high-seller.de");
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/* Versand                                                                     */
/* -------------------------------------------------------------------------- */

async function sendMail(
  apiKey: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("Resend error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("Send error:", err?.message || err);
    return false;
  }
}

export default async (req: Request, _context: Context) => {
  let payload: any;
  try {
    const body = await req.json();
    payload = body?.payload || body;
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const formName: string =
    payload?.form_name || payload?.data?.["form-name"] || "kontakt";
  const data: Record<string, string> = payload?.data || {};

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Kein Provider konfiguriert: Netlify-native Benachrichtigung übernimmt.
    console.log(
      `submission-created (${formName}) — kein RESEND_API_KEY, native Netlify-Mail aktiv.`
    );
    return new Response("OK (native notification)");
  }

  const from =
    process.env.RESEND_FROM ||
    `${COMPANY_NAME} <website@high-seller.de>`;
  const to = process.env.LEAD_TO || TO;
  const subject = subjectFor(formName, data);

  // 1) Interne Benachrichtigung an das Highseller-Team
  await sendMail(apiKey, {
    from,
    to: [to],
    reply_to: isValidEmail(data.email) ? String(data.email).trim() : undefined,
    subject,
    html: buildInternalHtml(formName, data),
    text: buildInternalText(formName, data),
  });

  // 2) Eingangsbestätigung an den Interessenten (nur bei gültiger E-Mail,
  //    nicht bei der reinen Newsletter-Anmeldung).
  if (isValidEmail(data.email) && formName !== "newsletter") {
    await sendMail(apiKey, {
      from,
      to: [String(data.email).trim()],
      reply_to: COMPANY_EMAIL,
      subject: `Ihre Anfrage bei ${COMPANY_NAME}`,
      html: buildConfirmationHtml(data),
      text: buildConfirmationText(data),
    });
  }

  return new Response("OK");
};
