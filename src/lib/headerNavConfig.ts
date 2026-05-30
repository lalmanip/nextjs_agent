/**
 * Header nav (Flights, Hotels, Cruises, Holidays) visibility / phased rollout.
 * Set in `.env.local` / `.env.production` — use NEXT_PUBLIC_* so the client bundle sees values.
 *
 * Per product: `on` | `hidden` | `maintenance`
 * - on: normal behaviour (same as today)
 * - hidden: link is not shown
 * - maintenance: link is shown (muted); click shows NEXT_PUBLIC_HEADER_NAV_MAINTENANCE_MESSAGE
 *
 * Accepted aliases: hidden ← hide, off, false, 0, no
 *                   maintenance ← disabled, coming_soon, soon
 */

export type HeaderNavMode = "on" | "hidden" | "maintenance";

export type HeaderNavProductKey =
  | "flights"
  | "hotels"
  | "cruises"
  | "holidays"
  | "holidayPartners";

const DEFAULT_MODE: HeaderNavMode = "on";

function parseHeaderNavMode(raw: string | undefined): HeaderNavMode {
  if (raw == null || raw === "") return DEFAULT_MODE;
  const v = String(raw).trim().toLowerCase();
  if (v === "hidden" || v === "hide" || v === "off" || v === "false" || v === "0" || v === "no") return "hidden";
  if (v === "maintenance" || v === "disabled" || v === "coming_soon" || v === "soon") return "maintenance";
  return "on";
}

const ENV_BY_KEY: Record<HeaderNavProductKey, string | undefined> = {
  flights: process.env.NEXT_PUBLIC_HEADER_NAV_FLIGHTS,
  hotels: process.env.NEXT_PUBLIC_HEADER_NAV_HOTELS,
  cruises: process.env.NEXT_PUBLIC_HEADER_NAV_CRUISES,
  /** Legacy /holidays page — shown in nav as "Old Holidays". */
  holidays: process.env.NEXT_PUBLIC_HEADER_NAV_HOLIDAYS,
  /** /holiday-partners — shown in nav as "Holidays". */
  holidayPartners: process.env.NEXT_PUBLIC_HEADER_NAV_HOLIDAY_PARTNERS,
};

export function getHeaderNavMode(key: HeaderNavProductKey): HeaderNavMode {
  return parseHeaderNavMode(ENV_BY_KEY[key]);
}

export const HEADER_NAV_MAINTENANCE_MESSAGE =
  process.env.NEXT_PUBLIC_HEADER_NAV_MAINTENANCE_MESSAGE?.trim() ||
  "This section is under maintenance. We're launching in phases — please check back soon.";
