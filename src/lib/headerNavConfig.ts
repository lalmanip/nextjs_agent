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
  | "holidayPartners";

const DEFAULT_MODE: HeaderNavMode = "on";

function parseHeaderNavMode(raw: string | undefined): HeaderNavMode {
  if (raw == null || raw === "") return DEFAULT_MODE;
  const v = String(raw).trim().toLowerCase();
  if (v === "hidden" || v === "hide" || v === "off" || v === "false" || v === "0" || v === "no") return "hidden";
  if (v === "maintenance" || v === "disabled" || v === "coming_soon" || v === "soon") return "maintenance";
  return "on";
}

function envForNavKey(key: HeaderNavProductKey): string | undefined {
  switch (key) {
    case "flights":
      return process.env.NEXT_PUBLIC_HEADER_NAV_FLIGHTS;
    case "hotels":
      return process.env.NEXT_PUBLIC_HEADER_NAV_HOTELS;
    case "cruises":
      return process.env.NEXT_PUBLIC_HEADER_NAV_CRUISES;
    /** /holiday-partners — shown in nav as "Holidays". */
    case "holidayPartners":
      return (
        process.env.NEXT_PUBLIC_HEADER_NAV_HOLIDAY_PARTNERS ??
        process.env.NEXT_PUBLIC_HEADER_NAV_HOLIDAYS_PARTNERS
      );
    default:
      return undefined;
  }
}

/** Read all nav modes from process.env (works at Docker build time and K8s runtime on the server). */
export function getAllHeaderNavModes(): Record<HeaderNavProductKey, HeaderNavMode> {
  return {
    flights: parseHeaderNavMode(envForNavKey("flights")),
    hotels: parseHeaderNavMode(envForNavKey("hotels")),
    cruises: parseHeaderNavMode(envForNavKey("cruises")),
    holidayPartners: parseHeaderNavMode(envForNavKey("holidayPartners")),
  };
}

export function getHeaderNavMode(key: HeaderNavProductKey): HeaderNavMode {
  return parseHeaderNavMode(envForNavKey(key));
}

export const HEADER_NAV_MAINTENANCE_MESSAGE =
  process.env.NEXT_PUBLIC_HEADER_NAV_MAINTENANCE_MESSAGE?.trim() ||
  "This section is under maintenance. We're launching in phases — please check back soon.";
