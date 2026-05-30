import { formatUserCalendarDateUtc, getDateLocale } from "@/lib/dateLocale";

/**
 * Format a flight travel calendar day for display.
 * Search payloads use ISO midnight UTC (e.g. 2026-05-12T00:00:00.000Z) or date-input values (YYYY-MM-DD).
 * Uses the visitor's locale (dd/mm/yyyy in India, mm/dd/yyyy in US, etc.).
 */
export function formatFlightCalendarDate(
  isoOrYmd: string,
  options: Intl.DateTimeFormatOptions = {},
  locale?: string,
): string {
  return formatUserCalendarDateUtc(isoOrYmd, options, locale ?? getDateLocale());
}
