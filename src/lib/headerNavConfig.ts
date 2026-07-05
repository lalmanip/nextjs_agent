/**
 * Header nav (Flights, Hotels, Cruises, Holidays) visibility / phased rollout.
 * Prefer non-NEXT_PUBLIC keys in K8s (runtime); NEXT_PUBLIC_* for local dev build.
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
  | "holidays";

const DEFAULT_MODE: HeaderNavMode = "on";

function parseHeaderNavMode(raw: string | undefined): HeaderNavMode {
  if (raw == null || raw === "") return DEFAULT_MODE;
  const v = String(raw).trim().toLowerCase();
  if (v === "hidden" || v === "hide" || v === "off" || v === "false" || v === "0" || v === "no") return "hidden";
  if (v === "maintenance" || v === "disabled" || v === "coming_soon" || v === "soon") return "maintenance";
  return "on";
}

const HEADER_NAV_ENV_BY_KEY: Record<HeaderNavProductKey, readonly string[]> = {
  flights: ["HEADER_NAV_FLIGHTS", "NEXT_PUBLIC_HEADER_NAV_FLIGHTS"],
  hotels: ["HEADER_NAV_HOTELS", "NEXT_PUBLIC_HEADER_NAV_HOTELS"],
  cruises: ["HEADER_NAV_CRUISES", "NEXT_PUBLIC_HEADER_NAV_CRUISES"],
  /** /holidays — India & international location selector */
  holidays: ["HEADER_NAV_HOLIDAYS", "NEXT_PUBLIC_HEADER_NAV_HOLIDAYS"],
};

function readFirstEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function envForNavKey(key: HeaderNavProductKey): string | undefined {
  return readFirstEnv(HEADER_NAV_ENV_BY_KEY[key]);
}

/** Read all nav modes from process.env (works at Docker build time and K8s runtime on the server). */
export function getAllHeaderNavModes(): Record<HeaderNavProductKey, HeaderNavMode> {
  return {
    flights: parseHeaderNavMode(envForNavKey("flights")),
    hotels: parseHeaderNavMode(envForNavKey("hotels")),
    cruises: parseHeaderNavMode(envForNavKey("cruises")),
    holidays: parseHeaderNavMode(envForNavKey("holidays")),
  };
}

export function getHeaderNavMode(key: HeaderNavProductKey): HeaderNavMode {
  return parseHeaderNavMode(envForNavKey(key));
}

export const HEADER_NAV_MAINTENANCE_MESSAGE =
  readFirstEnv(["HEADER_NAV_MAINTENANCE_MESSAGE", "NEXT_PUBLIC_HEADER_NAV_MAINTENANCE_MESSAGE"]) ||
  "This section is under maintenance. We're launching in phases — please check back soon.";
