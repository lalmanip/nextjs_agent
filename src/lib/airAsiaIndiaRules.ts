/** AirAsia India (I5) — domestic bookings may include free SSR baggage/meal (price 0). */

import { readSegmentOperatorCode } from "@/lib/spiceJetPassengerRules";

export const AIR_ASIA_INDIA_OPERATOR_CODE = "I5";

export function segmentIsAirAsiaIndia(seg: unknown): boolean {
  if (readSegmentOperatorCode(seg) === AIR_ASIA_INDIA_OPERATOR_CODE) return true;
  if (!seg || typeof seg !== "object") return false;
  const name = String(
    (seg as Record<string, unknown>).OperatorName ??
      (seg as Record<string, unknown>).operatorName ??
      "",
  ).toLowerCase();
  return name.includes("airasia");
}

/** True when any segment in the itinerary is operated by AirAsia India (I5). */
export function flightDetailsIsAirAsiaIndia(details: unknown[][] | undefined | null): boolean {
  if (!Array.isArray(details)) return false;
  for (const leg of details) {
    if (!Array.isArray(leg)) continue;
    for (const seg of leg) {
      if (segmentIsAirAsiaIndia(seg)) return true;
    }
  }
  return false;
}
