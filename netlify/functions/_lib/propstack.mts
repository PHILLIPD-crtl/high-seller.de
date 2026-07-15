/**
 * Gemeinsame Propstack-Anbindung für die Netlify Functions.
 *
 * Wichtig: Diese Datei läuft ausschließlich serverseitig. Der API-Schlüssel
 * (PROPSTACK_API_KEY) wird nur hier gelesen und niemals geloggt oder an das
 * Frontend ausgegeben.
 *
 * ---------------------------------------------------------------------------
 * Datenmodell (wichtig!)
 * ---------------------------------------------------------------------------
 * Der Endpoint wird mit `expand=1` aufgerufen. Propstack liefert dann viele
 * Felder NICHT als reinen Wert, sondern als Objekt `{ label, value }`, z. B.:
 *     "price": { "label": "Preis", "value": 222066 }
 *     "living_space": { "label": "Wohnfläche ca.", "value": 56.9 }
 * Strukturfelder (id, city, marketing_type, object_type, rs_type, images,
 * property_status …) bleiben dagegen einfache Werte. Deshalb werden alle
 * inhaltlichen Felder über {@link raw} entpackt, das sowohl `{label,value}`
 * als auch einfache Werte verarbeitet.
 *
 * ---------------------------------------------------------------------------
 * Konfiguration über Netlify Environment Variables (alle optional)
 * ---------------------------------------------------------------------------
 *   PROPSTACK_API_KEY        (Pflicht)  – Propstack API-Schlüssel
 *   PROPSTACK_API_URL        – Standard: https://api.propstack.de/v1/units
 *
 *   Freigabe / Sichtbarkeit (Status):
 *   Es werden ausschließlich Objekte angezeigt, deren Propstack-Status exakt
 *   "Vermarktung" ist (Feld `property_status.name`).
 *   PROPSTACK_STATUS_ALLOW   – Überschreibt die erlaubten Status-Namen
 *                              (kommagetrennt, exakter Vergleich, ohne
 *                              Groß-/Kleinschreibung). Standard: "Vermarktung".
 *   PROPSTACK_PUBLISH_FIELD  – Alternativ: eigenes Freigabe-Feld erzwingen.
 *   PROPSTACK_PUBLISH_VALUE  – erwarteter Wert für "freigegeben".
 *
 *   Qualitäts-Gates (Standard: AUS, damit wirklich alle "Vermarktung"-Objekte
 *   erscheinen; auf "1" setzen zum Aktivieren):
 *   PROPSTACK_REQUIRE_IMAGE  – Objekte ohne Bild ausblenden (Standard aus)
 *   PROPSTACK_REQUIRE_PRICE  – Objekte ohne Preis/Miete ausblenden (Standard aus)
 *   PROPSTACK_REQUIRE_AREA   – Objekte ohne Fläche ausblenden (Standard aus)
 *
 *   Diagnose:
 *   Der Endpunkt /.netlify/functions/propstack-properties?debug=1 gibt in
 *   `diagnostics.rawSample` ein vollständiges Rohobjekt aus, um Feldnamen zu
 *   prüfen. `diagnostics.availableStatuses` listet immer alle vorkommenden
 *   Status-Namen mit Anzahl.
 *
 * Authentifizierung: Schlüssel im Header X-API-KEY (Standard), bei 401/403
 * Fallback über den Query-Parameter api_key. KEIN "Authorization: Bearer".
 * Der Schlüssel wird in keinem Fall geloggt oder in der Antwort ausgegeben.
 */

// Basis-Endpoint für Objekte (Immobilien). Laut Propstack-Doku:
//   GET https://api.propstack.de/v1/units
const DEFAULT_API_URL = "https://api.propstack.de/v1/units";

/** Maschinenlesbare Fehlercodes für Frontend und Diagnose. */
export type PropstackError =
  | "missing_api_key"
  | "propstack_http_error"
  | "propstack_invalid_json"
  | "propstack_empty_response"
  | "propstack_filter_removed_all";

/**
 * Verwendete Authentifizierungsmethode für die Diagnose.
 * Enthält NIEMALS den API-Schlüssel selbst – nur die verwendete Methode.
 */
export type AuthMethod = "x-api-key" | "api_key_query_fallback";

/** Diagnosewerte – enthalten niemals den API-Schlüssel. */
export interface Diagnostics {
  /** Aufgerufener Endpoint OHNE API-Schlüssel. */
  endpoint: string;
  /** HTTP-Status der Propstack-Antwort (null, wenn kein Request erfolgte). */
  httpStatus: number | null;
  /** Anzahl der von Propstack gelieferten Rohobjekte. */
  rawCount: number;
  /** Anzahl der Objekte nach der Freigabe-/Qualitätsfilterung. */
  filteredCount: number;
  /** Ob eine PROPSTACK_PUBLISH_FIELD-Variable gesetzt ist. */
  publishFieldSet: boolean;
  /** Zuletzt getestete Authentifizierungsmethode (ohne Schlüssel). */
  authMethod: AuthMethod;
  /** Aufschlüsselung, warum Objekte aussortiert wurden (nur Zähler/Namen). */
  excluded?: {
    archived: number;
    testData: number;
    status: number;
    noImage: number;
    noPrice: number;
    noArea: number;
  };
  /** Welche Status-Namen angezeigt bzw. ausgeblendet wurden (Name -> Anzahl). */
  statusesShown?: Record<string, number>;
  statusesExcluded?: Record<string, number>;
  /** Alle in der Rohantwort vorkommenden Status-Namen (Name -> Anzahl). */
  availableStatuses?: Record<string, number>;
  /** Vollständiges Rohobjekt zur Feldprüfung – nur bei ?debug=1. */
  rawSample?: unknown;
}

/** Ergebnis eines Ladevorgangs – Erfolg oder klar benannter Fehler. */
export interface LoadResult {
  ok: boolean;
  properties: Property[];
  error?: PropstackError;
  /** HTTP-Status bei propstack_http_error. */
  status?: number;
  /** Menschenlesbarer Hinweis zur Ursache. */
  hint?: string;
  diagnostics: Diagnostics;
}

export interface Property {
  id: string;
  slug: string;
  title: string;
  city: string;
  district: string;
  address: string;
  marketingType: "kauf" | "miete";
  price: number | null;
  priceLabel: string;
  livingSpace: number | null;
  plotArea: number | null;
  rooms: number | null;
  constructionYear: number | null;
  objectType: string;
  description: string;
  location: string;
  features: string;
  energy: { class: string; value: string; type: string; carrier: string };
  images: { url: string; alt: string }[];
  /** Öffentliche Propstack-Exposé-URL (falls vorhanden). */
  exposeUrl: string;
}

/**
 * Endpoint-URL OHNE API-Schlüssel aufbauen.
 * Der Schlüssel wird ausschließlich per Header übertragen.
 */
function buildEndpoint(): URL {
  const base = process.env.PROPSTACK_API_URL || DEFAULT_API_URL;
  const url = new URL(base);
  // Möglichst viele Objekte auf einmal + ausführliches JSON (Beschreibungen,
  // Energie, custom Felder). Ohne expand fehlen viele Textfelder.
  if (!url.searchParams.has("per")) url.searchParams.set("per", "200");
  url.searchParams.set("expand", "1");
  // Sicherheit: einen evtl. konfigurierten Key-Query-Parameter für die
  // Diagnose-Ausgabe entfernen (der Key gehört ausschließlich in den Header).
  url.searchParams.delete("api_key");
  return url;
}

/** Passenden Hinweis-Text zu einem HTTP-Status ermitteln (ohne Key). */
function hintForStatus(status: number): string {
  if (status === 401 || status === 403) return "API Key ungültig oder nicht berechtigt.";
  if (status === 404) return "Endpoint falsch.";
  if (status === 429) return "Zu viele Anfragen – Propstack Rate-Limit erreicht.";
  if (status >= 500) return "Propstack-Server antwortet mit einem Fehler.";
  return "Unerwarteter HTTP-Status von Propstack.";
}

/**
 * Optionen für {@link loadProperties}.
 */
export interface LoadOptions {
  /** Wenn true: ein vollständiges Rohobjekt in diagnostics.rawSample ausgeben. */
  debug?: boolean;
  /**
   * Erlaubte Status-Namen (kleingeschrieben, exakter Vergleich). Überschreibt
   * die Standard-Freigabe ("Vermarktung") und die Env-Variable
   * PROPSTACK_STATUS_ALLOW. Wird u. a. für die "Verkauft"-Referenzen genutzt.
   * Bei gesetztem allow wird ein evtl. PROPSTACK_PUBLISH_FIELD ignoriert, da
   * die Auswahl bewusst rein über den Status erfolgt.
   */
  allow?: string[];
}

/**
 * Objekte von Propstack laden, filtern und normalisieren.
 *
 * Gibt IMMER ein LoadResult mit gefüllten Diagnosewerten zurück – auch im
 * Fehlerfall. Wirft nur bei unerwarteten Netzwerkfehlern (fetch), die von den
 * aufrufenden Functions abgefangen werden.
 */
export async function loadProperties(options: LoadOptions = {}): Promise<LoadResult> {
  const publishFieldSet = Boolean(process.env.PROPSTACK_PUBLISH_FIELD);
  const url = buildEndpoint();
  const endpoint = url.toString();

  const diagnostics: Diagnostics = {
    endpoint,
    httpStatus: null,
    rawCount: 0,
    filteredCount: 0,
    publishFieldSet,
    authMethod: "x-api-key",
  };

  // 1) API-Schlüssel muss vorhanden sein.
  const apiKey = process.env.PROPSTACK_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      properties: [],
      error: "missing_api_key",
      hint: "PROPSTACK_API_KEY ist in Netlify Functions nicht verfügbar.",
      diagnostics,
    };
  }

  // 2) Anfrage an Propstack (Schlüssel im Header, Fallback als Query-Parameter).
  diagnostics.authMethod = "x-api-key";
  let res = await fetch(endpoint, {
    headers: { "X-API-KEY": apiKey, Accept: "application/json" },
  });

  if (res.status === 401 || res.status === 403) {
    const fallbackUrl = new URL(endpoint);
    fallbackUrl.searchParams.set("api_key", apiKey);
    diagnostics.authMethod = "api_key_query_fallback";
    res = await fetch(fallbackUrl.toString(), { headers: { Accept: "application/json" } });
  }

  diagnostics.httpStatus = res.status;

  // 3) HTTP-Status sichtbar machen.
  if (!res.ok) {
    return {
      ok: false,
      properties: [],
      error: "propstack_http_error",
      status: res.status,
      hint: hintForStatus(res.status),
      diagnostics,
    };
  }

  // 4) Antwort als JSON parsen.
  let json: any;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      properties: [],
      error: "propstack_invalid_json",
      hint: "Antwort von Propstack war kein gültiges JSON.",
      diagnostics,
    };
  }

  // Propstack antwortet je nach Endpunkt mit einem Array oder { data: [...] }.
  const list = Array.isArray(json) ? json : json?.data ?? json?.units ?? [];
  const units: any[] = Array.isArray(list) ? list : [];
  diagnostics.rawCount = units.length;

  // Immer alle vorkommenden Status-Namen erfassen (Feldprüfung/Transparenz).
  const availableStatuses: Record<string, number> = {};
  for (const u of units) bump(availableStatuses, statusNameOf(u));
  diagnostics.availableStatuses = availableStatuses;

  // Auf Wunsch (?debug=1) ein vollständiges Rohobjekt beilegen, damit sich die
  // Feldnamen (u. a. das Status-Feld) im Response prüfen lassen.
  if (options.debug && units.length) diagnostics.rawSample = units[0];

  // 5) Leere Antwort (keine Rohobjekte).
  if (units.length === 0) {
    return {
      ok: false,
      properties: [],
      error: "propstack_empty_response",
      hint: "Propstack lieferte keine Objekte zurück.",
      diagnostics,
    };
  }

  // 6) Freigabe- und Qualitätsfilterung mit Diagnose-Zählern.
  const excluded = { archived: 0, testData: 0, status: 0, noImage: 0, noPrice: 0, noArea: 0 };
  const statusesShown: Record<string, number> = {};
  const statusesExcluded: Record<string, number> = {};
  // Qualitäts-Gates standardmäßig AUS: es sollen wirklich alle Objekte mit
  // Status "Vermarktung" erscheinen. Per Env-Variable aktivierbar.
  const requireImage = envFlag("PROPSTACK_REQUIRE_IMAGE", false);
  const requirePrice = envFlag("PROPSTACK_REQUIRE_PRICE", false);
  const requireArea = envFlag("PROPSTACK_REQUIRE_AREA", false);

  const properties: Property[] = [];
  for (const unit of units) {
    const statusName = statusNameOf(unit);

    // a) Freigabe/Status/Test.
    const verdict = publishVerdict(unit, options.allow);
    if (!verdict.ok) {
      excluded[verdict.reason]++;
      bump(statusesExcluded, statusName);
      continue;
    }

    // b) Normalisieren und Qualitäts-Gates auf den sauberen Daten prüfen.
    const p = normalize(unit);
    if (requireImage && p.images.length === 0) {
      excluded.noImage++;
      bump(statusesExcluded, statusName);
      continue;
    }
    if (requirePrice && p.price === null) {
      excluded.noPrice++;
      bump(statusesExcluded, statusName);
      continue;
    }
    if (requireArea && p.livingSpace === null && p.plotArea === null) {
      excluded.noArea++;
      bump(statusesExcluded, statusName);
      continue;
    }

    bump(statusesShown, statusName);
    properties.push(p);
  }

  diagnostics.filteredCount = properties.length;
  diagnostics.excluded = excluded;
  diagnostics.statusesShown = statusesShown;
  diagnostics.statusesExcluded = statusesExcluded;

  if (properties.length === 0) {
    const allowNames = (options.allow && options.allow.length
      ? options.allow
      : splitList(process.env.PROPSTACK_STATUS_ALLOW).length
        ? splitList(process.env.PROPSTACK_STATUS_ALLOW)
        : DEFAULT_ALLOW
    ).join(", ");
    return {
      ok: false,
      properties: [],
      error: "propstack_filter_removed_all",
      hint: publishFieldSet && !(options.allow && options.allow.length)
        ? "Alle Objekte wurden durch PROPSTACK_PUBLISH_FIELD ausgefiltert."
        : `Kein Objekt hat den Status "${allowNames}" (siehe diagnostics.availableStatuses).`,
      diagnostics,
    };
  }

  return { ok: true, properties, diagnostics };
}

/** Umgebungsvariable als Boolean lesen ("0"/"false"/"no" = aus). */
function envFlag(name: string, dflt: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return dflt;
  return !/^(0|false|no|off)$/i.test(v.trim());
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] || 0) + 1;
}

/**
 * Status-Namen aus Propstack lesen.
 * Das Feld heißt `property_status` (Objekt mit `name`), ältere Endpunkte
 * liefern evtl. `status` als String oder Objekt.
 */
function statusNameOf(unit: any): string {
  const s = unit?.property_status ?? unit?.status;
  if (s && typeof s === "object") return String(s.name ?? "").trim() || "(ohne Status)";
  const str = String(s ?? "").trim();
  return str || "(ohne Status)";
}

// Standard: nur Objekte mit Propstack-Status exakt "Vermarktung" anzeigen.
// (kleingeschrieben, da der Vergleich case-insensitive erfolgt).
const DEFAULT_ALLOW = ["vermarktung"];

function splitList(v: string | undefined): string[] {
  return (v || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

interface PublishVerdict {
  ok: boolean;
  reason: "archived" | "testData" | "status";
}

/**
 * Entscheidet, ob ein Objekt öffentlich angezeigt werden darf.
 * Reihenfolge: archiviert -> Testdaten -> Status-Freigabe.
 *
 * `allowOverride` erzwingt eine bestimmte Status-Auswahl (z. B. ["verkauft"])
 * und hat Vorrang vor PROPSTACK_PUBLISH_FIELD und PROPSTACK_STATUS_ALLOW.
 */
function publishVerdict(unit: any, allowOverride?: string[]): PublishVerdict {
  // Archivierte Objekte nie anzeigen.
  if (unit?.archived === true) return { ok: false, reason: "archived" };

  // Test-/Musterobjekte erkennen (Name ist bei Propstack das interne Feld).
  if (isTestData(unit)) return { ok: false, reason: "testData" };

  const hasOverride = Array.isArray(allowOverride) && allowOverride.length > 0;

  // Explizit konfiguriertes Freigabe-Feld hat Vorrang – außer bei einer
  // expliziten Status-Auswahl (z. B. "Verkauft"-Referenzen).
  const field = process.env.PROPSTACK_PUBLISH_FIELD;
  if (field && !hasOverride) {
    return isPublishedByField(unit, field) ? { ok: true, reason: "status" } : { ok: false, reason: "status" };
  }

  const statusName = statusNameOf(unit).trim().toLowerCase();

  // Erlaubte Status – Override > Env > Standard ("Vermarktung").
  // Exakter Vergleich (keine Teiltreffer), ohne Groß-/Kleinschreibung.
  const allow = hasOverride
    ? allowOverride!.map((s) => s.trim().toLowerCase())
    : splitList(process.env.PROPSTACK_STATUS_ALLOW);
  const allowed = allow.length ? allow : DEFAULT_ALLOW;
  const ok = allowed.includes(statusName);
  return { ok, reason: "status" };
}

/** Prüft ein explizit konfiguriertes Freigabe-Feld. */
function isPublishedByField(unit: any, field: string): boolean {
  const expected = process.env.PROPSTACK_PUBLISH_VALUE;
  const value = raw(getNested(unit, field));
  if (expected !== undefined) {
    return String(value).toLowerCase() === String(expected).toLowerCase();
  }
  return Boolean(value) && value !== "false" && value !== 0;
}

/** Rückwärtskompatibel: einfache Freigabe-Prüfung (nur Status/Archiv). */
export function isPublished(unit: any): boolean {
  return publishVerdict(unit).ok;
}

const TEST_RE =
  /mustermann|musterfrau|musterhaus|musterstr|musterobjekt|musterwohnung|\bmuster\b|\btest\b|testobjekt|beispielobjekt|\bbeispiel\b|\bdummy\b|lorem ipsum|\bvorlage\b|max mustermann/i;

/** Erkennt offensichtliche Test-/Musterobjekte anhand von Name/Titel/Adresse. */
function isTestData(unit: any): boolean {
  const haystack = [
    unit?.name,
    raw(unit?.title),
    unit?.city,
    unit?.street,
    unit?.address,
    raw(unit?.description_note),
  ]
    .map((v) => (v == null ? "" : String(v)))
    .join(" ");
  return TEST_RE.test(haystack);
}

function getNested(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/**
 * Wert entpacken: Propstack liefert mit `expand=1` viele Felder als
 * `{ label, value }`. Diese Funktion gibt in dem Fall `value` zurück,
 * ansonsten den Wert unverändert.
 */
function raw(v: any): any {
  if (v && typeof v === "object" && !Array.isArray(v) && "value" in v) return v.value;
  return v;
}

const UMLAUT: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

export function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[äöüß]/g, (m) => UMLAUT[m] || m)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function num(v: any): number | null {
  const val = raw(v);
  if (val === null || val === undefined || val === "") return null;
  const n =
    typeof val === "number"
      ? val
      : parseFloat(String(val).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function euro(n: number | null): string {
  if (n === null) return "Preis auf Anfrage";
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function firstString(...vals: any[]): string {
  for (const v of vals) {
    const val = raw(v);
    if (typeof val === "string" && val.trim()) return val.trim();
    if (typeof val === "number" && !Number.isNaN(val)) return String(val);
  }
  return "";
}

// Propstack-Objekttypen (rs_type) in deutsche Bezeichnungen übersetzen.
const RS_TYPE_LABEL: Record<string, string> = {
  APARTMENT: "Wohnung",
  HOUSE: "Haus",
  TRADE_SITE: "Grundstück",
  GARAGE: "Stellplatz / Garage",
  SHORT_TERM_ACCOMODATION: "Wohnen auf Zeit",
  OFFICE: "Büro / Praxis",
  GASTRONOMY: "Gastronomie",
  INDUSTRY: "Industrie / Halle",
  STORE: "Ladenlokal",
  SPECIAL_PURPOSE: "Spezialobjekt",
  INVESTMENT: "Anlageobjekt",
};

function objectTypeLabel(unit: any): string {
  const rs = String(raw(unit.rs_type) || "").toUpperCase();
  if (RS_TYPE_LABEL[rs]) return RS_TYPE_LABEL[rs];
  // Fallback über die Oberkategorie object_type.
  const ot = String(raw(unit.object_type) || "").toUpperCase();
  if (ot === "COMMERCIAL") return "Gewerbe";
  if (ot === "INVESTMENT") return "Anlageobjekt";
  return firstString(unit.rs_category, "Immobilie");
}

/** Energiekennwert lesbar formatieren (z. B. 160 -> "160 kWh/(m²·a)"). */
function energyValue(unit: any): string {
  const n = num(unit.thermal_characteristic ?? unit.energy_efficiency_value);
  if (n === null) {
    return firstString(unit.thermal_characteristic, unit.energy_efficiency_value);
  }
  return `${n.toLocaleString("de-DE")} kWh/(m²·a)`;
}

/** Ein Propstack-Objekt in unser stabiles, frontend-sicheres Format überführen. */
export function normalize(unit: any): Property {
  const city = firstString(unit.city, "Köln");
  const district = firstString(unit.district, unit.sublocality_level_1, unit.region);
  const street = firstString(unit.street);
  const houseNo = firstString(unit.house_number);
  // Adresse nur zusammenbauen, wenn eine Straße vorhanden ist.
  const address = street ? [street, houseNo].filter(Boolean).join(" ").trim() : "";

  const marketing = String(raw(unit.marketing_type) || "").toUpperCase();
  const isRent = marketing === "RENT";

  const price = isRent
    ? num(unit.base_rent ?? unit.total_rent)
    : num(unit.price ?? unit.valuation_price);

  const objectType = objectTypeLabel(unit);

  const title =
    firstString(unit.title, unit.headline) ||
    `${objectType} in ${city}`;

  // Bilder: private und Nicht-Exposé-Bilder aussortieren, nach Position sortieren.
  const rawImages: any[] = Array.isArray(unit.images) ? unit.images.slice() : [];
  const images = rawImages
    .filter((img) => img && img.is_private !== true && img.is_not_for_exposee !== true)
    .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
    .map((img: any) => firstString(img?.url, img?.big_url, img?.original, img?.medium_url))
    .filter(Boolean)
    .map((url: string, i: number) => ({ url, alt: `${title} – Foto ${i + 1}` }));

  const slugBase = [objectType, city, district || street].filter(Boolean).join("-");
  const slug = `${slugify(slugBase)}-${unit.id}`;

  return {
    id: String(unit.id),
    slug,
    title,
    city,
    district,
    address,
    marketingType: isRent ? "miete" : "kauf",
    price,
    priceLabel: euro(price) + (isRent && price !== null ? " / Monat" : ""),
    livingSpace: num(unit.living_space),
    plotArea: num(unit.plot_area),
    rooms: num(unit.number_of_rooms),
    constructionYear: num(unit.construction_year),
    objectType,
    description: firstString(unit.description_note, unit.long_description_note),
    location: firstString(unit.location_note, unit.long_location_note),
    features: firstString(unit.furnishing_note, unit.long_furnishing_note),
    energy: {
      class: firstString(unit.energy_efficiency_class),
      value: energyValue(unit),
      type: firstString(unit.building_energy_rating_type, unit.energy_certificate_availability),
      carrier: firstString(unit.firing_types, unit.heating_type),
    },
    images,
    exposeUrl: firstString(unit.public_expose_url),
  };
}

/**
 * Alle freigegebenen Objekte laden und normalisieren.
 *
 * Komfort-Wrapper um {@link loadProperties}. Bei "keine Objekte"-Situationen
 * wird eine leere Liste zurückgegeben; bei echten Fehlern (fehlender Key,
 * HTTP-/JSON-Fehler) wird der Fehlercode geworfen.
 */
export async function getPublishedProperties(): Promise<Property[]> {
  const result = await loadProperties();
  if (result.ok) return result.properties;
  if (
    result.error === "propstack_empty_response" ||
    result.error === "propstack_filter_removed_all"
  ) {
    return [];
  }
  throw new Error(result.error || "unavailable");
}
