/**
 * Locale-aware date display (dd/mm/yyyy for India, mm/dd/yyyy for US, etc.)
 * based on browser language, region, and timezone — not a fixed en-US format.
 */

const DEFAULT_LOCALE = "en-IN";

/** Map ISO country / region codes to BCP 47 locales used for dates. */
const REGION_TO_LOCALE: Record<string, string> = {
  IN: "en-IN",
  US: "en-US",
  GB: "en-GB",
  AU: "en-AU",
  CA: "en-CA",
  NZ: "en-NZ",
  SG: "en-SG",
  AE: "en-AE",
  DE: "de-DE",
  FR: "fr-FR",
};

let cachedLocale: string | null = null;

function regionFromTimezone(tz: string): string | null {
  if (!tz) return null;
  if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "IN";
  if (tz.startsWith("America/")) return "US";
  if (tz.startsWith("Europe/London") || tz === "Europe/Belfast") return "GB";
  if (tz.startsWith("Australia/")) return "AU";
  if (tz.startsWith("Pacific/Auckland")) return "NZ";
  return null;
}

/** Infer BCP 47 locale for date formatting from browser / environment. */
export function detectDateLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const languages = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter(Boolean) as string[];

  for (const lang of languages) {
    const normalized = lang.trim();
    if (!normalized) continue;
    if (normalized.startsWith("en-IN") || normalized === "hi" || normalized.startsWith("hi-")) {
      return "en-IN";
    }
    if (normalized.startsWith("en-US")) return "en-US";
    if (normalized.startsWith("en-GB")) return "en-GB";
    try {
      const loc = new Intl.Locale(normalized);
      const region = loc.region?.toUpperCase();
      if (region && REGION_TO_LOCALE[region]) return REGION_TO_LOCALE[region];
      if (region) return `en-${region}`;
    } catch {
      if (normalized.includes("-IN") || normalized.endsWith("IN")) return "en-IN";
      if (normalized.includes("-US") || normalized.endsWith("US")) return "en-US";
    }
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  const fromTz = regionFromTimezone(tz);
  if (fromTz && REGION_TO_LOCALE[fromTz]) return REGION_TO_LOCALE[fromTz];

  return DEFAULT_LOCALE;
}

/** Active locale for dates (cached after first client detection). */
export function getDateLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  if (!cachedLocale) cachedLocale = detectDateLocale();
  return cachedLocale;
}

export function setDateLocale(locale: string): void {
  const next = String(locale ?? "").trim() || DEFAULT_LOCALE;
  cachedLocale = next;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
  }
}

/** `lang` for `<input type="date">` (browser uses this for field display). */
export function getDateInputLang(locale?: string): string {
  return locale ?? getDateLocale();
}

/** Human hint under date fields, e.g. DD/MM/YYYY vs MM/DD/YYYY. */
export function getDateFormatHint(locale?: string): string {
  const loc = locale ?? getDateLocale();
  if (loc === "en-US") return "MM/DD/YYYY";
  if (loc === "en-IN" || loc.endsWith("-IN")) return "DD/MM/YYYY";
  if (loc === "en-GB" || loc.endsWith("-GB")) return "DD/MM/YYYY";
  try {
    const parts = new Intl.DateTimeFormat(loc).formatToParts(new Date(2026, 4, 15));
    const order = parts
      .filter((p) => p.type === "day" || p.type === "month" || p.type === "year")
      .map((p) => (p.type === "day" ? "DD" : p.type === "month" ? "MM" : "YYYY"));
    return order.join("/");
  } catch {
    return "DD/MM/YYYY";
  }
}

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s.includes("T") || s.includes(" ") ? s.replace(" ", "T") : s);
  return isNaN(d.getTime()) ? null : d;
}

/** Format a date for display using the user's locale. */
export function formatUserDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {},
  locale?: string,
): string {
  const d = toDate(value);
  if (!d) return "";
  const loc = locale ?? getDateLocale();
  return d.toLocaleDateString(loc, options);
}

/** Short numeric date (locale order: 15/05/2026 vs 05/15/2026). */
export function formatUserDateNumeric(value: string | Date, locale?: string): string {
  return formatUserDate(
    value,
    { day: "2-digit", month: "2-digit", year: "numeric" },
    locale,
  );
}

/** UTC calendar day (flight search YYYY-MM-DD) without timezone shift. */
export function formatUserCalendarDateUtc(
  isoOrYmd: string,
  options: Intl.DateTimeFormatOptions = {},
  locale?: string,
): string {
  if (!isoOrYmd?.trim()) return "";
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoOrYmd.trim());
  if (!ymd) return "";
  const y = Number(ymd[1]);
  const m = Number(ymd[2]);
  const day = Number(ymd[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return "";
  const d = new Date(Date.UTC(y, m - 1, day));
  const loc = locale ?? getDateLocale();
  return d.toLocaleDateString(loc, { timeZone: "UTC", ...options });
}
