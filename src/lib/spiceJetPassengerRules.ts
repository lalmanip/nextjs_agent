/** SpiceJet (SG) — each passenger must have a distinct first + last name combination. */

export const SPICEJET_OPERATOR_CODE = "SG";

export function readSegmentOperatorCode(seg: unknown): string {
  if (!seg || typeof seg !== "object") return "";
  const s = seg as Record<string, unknown>;
  const raw =
    s.OperatorCode ??
    s.operatorCode ??
    String(s.FlightNumber ?? s.flightNumber ?? "").slice(0, 2);
  return String(raw).trim().toUpperCase();
}

export function segmentIsSpiceJet(seg: unknown): boolean {
  if (readSegmentOperatorCode(seg) === SPICEJET_OPERATOR_CODE) return true;
  if (!seg || typeof seg !== "object") return false;
  const name = String(
    (seg as Record<string, unknown>).OperatorName ??
      (seg as Record<string, unknown>).operatorName ??
      "",
  ).toLowerCase();
  return name.includes("spicejet");
}

/** True when any segment in the itinerary is operated by SpiceJet. */
export function flightDetailsIsSpiceJet(details: unknown[][] | undefined | null): boolean {
  if (!Array.isArray(details)) return false;
  for (const leg of details) {
    if (!Array.isArray(leg)) continue;
    for (const seg of leg) {
      if (segmentIsSpiceJet(seg)) return true;
    }
  }
  return false;
}

export function normalizePassengerFullNameKey(firstName: string, lastName: string): string {
  const fn = String(firstName ?? "").trim().toLowerCase();
  const ln = String(lastName ?? "").trim().toLowerCase();
  return `${fn}|${ln}`;
}

export type PassengerNameRow = {
  firstName?: string;
  lastName?: string;
  type?: string;
  index?: number;
};

/**
 * Returns an error message when two or more passengers share the same first + last name.
 * SpiceJet-only rule; call only when {@link flightDetailsIsSpiceJet} is true.
 */
export function getSpiceJetDistinctPassengerNamesError(
  passengers: PassengerNameRow[],
): string | null {
  const seen = new Map<string, string>();
  for (const p of passengers) {
    const fn = String(p.firstName ?? "").trim();
    const ln = String(p.lastName ?? "").trim();
    if (!fn || !ln) continue;
    const key = normalizePassengerFullNameKey(fn, ln);
    const label = `${p.type || "Passenger"} ${Number(p.index ?? 0) + 1}`;
    const previous = seen.get(key);
    if (previous) {
      return (
        `SpiceJet requires each passenger to have a unique name (first and last name combined). ` +
        `${previous} and ${label} cannot share the same name.`
      );
    }
    seen.set(key, label);
  }
  return null;
}
