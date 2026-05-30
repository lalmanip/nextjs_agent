/**
 * Flight hold ticket feature toggle.
 *
 * Set a single variable in `.env.local` (no leading spaces on the key):
 *   FLIGHT_HOLD_ENABLED=on|off
 *
 * Default when unset: on.
 * Legacy alias `NEXT_PUBLIC_FLIGHT_HOLD_ENABLED` is still accepted.
 */

const DEFAULT_ENABLED = true;

function parseFlightHoldEnabled(raw: string | undefined): boolean {
  if (raw == null || raw === "") return DEFAULT_ENABLED;
  const v = String(raw).trim().replace(/^['"]|['"]$/g, "").toLowerCase();
  if (v === "off" || v === "false" || v === "0" || v === "no" || v === "hidden" || v === "hide") {
    return false;
  }
  if (v === "on" || v === "true" || v === "1" || v === "yes") return true;
  return false;
}

function readFlightHoldRaw(): string | undefined {
  return (
    process.env.FLIGHT_HOLD_ENABLED ?? process.env.NEXT_PUBLIC_FLIGHT_HOLD_ENABLED
  );
}

/** Inlined into the client bundle via next.config.js from FLIGHT_HOLD_ENABLED. */
const FLIGHT_HOLD_RAW_CLIENT = process.env.NEXT_PUBLIC_FLIGHT_HOLD_ENABLED;

/** Resolved once for client components (booking UI, payment screen). */
export const FLIGHT_HOLD_FEATURE_ENABLED = parseFlightHoldEnabled(FLIGHT_HOLD_RAW_CLIENT);

export function isFlightHoldFeatureEnabled(): boolean {
  if (typeof window !== "undefined") {
    return FLIGHT_HOLD_FEATURE_ENABLED;
  }
  return parseFlightHoldEnabled(readFlightHoldRaw());
}

/** Whether an itinerary is in hold-booking mode (feature on + flight marked hold). */
export function isFlightHoldBookingActive(
  flight: { holdBooking?: boolean } | null | undefined,
): boolean {
  return isFlightHoldFeatureEnabled() && flight?.holdBooking === true;
}
