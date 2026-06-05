/** Passenger DOB vs travel date: Infant &lt; 2y, Child 2y–before 12y, Adult 12y+. */

import { readTravellerDateOfBirthIso } from "@/lib/travellerFields";

export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDateFromIso(iso: string): Date | null {
  const v = String(iso || "").trim();
  if (!v || v.length < 10) return null;
  const [ys, ms, ds] = v.slice(0, 10).split("-");
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  if (!y || !mo || !d) return null;
  const out = new Date(y, mo - 1, d);
  return isNaN(out.getTime()) ? null : out;
}

export function addCalendarDays(d: Date, days: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + days);
  return x;
}

/** Completed years on `refLocal` (birthday on ref day counts as that age). */
export function getCompletedAgeYears(birthLocal: Date, refLocal: Date): number {
  let age = refLocal.getFullYear() - birthLocal.getFullYear();
  const m = refLocal.getMonth() - birthLocal.getMonth();
  if (m < 0 || (m === 0 && refLocal.getDate() < birthLocal.getDate())) age--;
  return age;
}

export type PaxTypeLabel = "Adult" | "Child" | "Infant" | string;

/**
 * Infant: under 2 on travel date (turns 2 → Child).
 * Child: 2 ≤ age &lt; 12 on travel date (turns 12 → Adult).
 * Adult: age ≥ 12.
 */
export function getPaxAgeValidationError(
  paxType: PaxTypeLabel,
  dobIso: string,
  refLocal: Date,
): string | null {
  const birth = parseLocalDateFromIso(dobIso);
  if (!birth) return "Enter a valid date of birth.";
  if (birth.getTime() > refLocal.getTime()) {
    return "Date of birth cannot be after the travel date.";
  }
  const age = getCompletedAgeYears(birth, refLocal);
  if (paxType === "Adult") {
    if (age < 12) return "Adult must be 12 years or older on the travel date.";
    return null;
  }
  if (paxType === "Child") {
    if (age < 2) {
      return "Child must be at least 2 years old on the travel date (under 2 is Infant).";
    }
    if (age >= 12) {
      return "Child must be under 12 years old on the travel date (12 or older is Adult).";
    }
    return null;
  }
  if (paxType === "Infant") {
    if (age >= 2) {
      return "Infant must be under 2 years old on the travel date (2nd birthday is Child).";
    }
    return null;
  }
  return null;
}

export function getDobInputBoundsIso(
  paxType: PaxTypeLabel,
  refLocal: Date,
): { min?: string; max?: string } {
  const y = refLocal.getFullYear();
  const m = refLocal.getMonth();
  const d = refLocal.getDate();
  const onRefDay = new Date(y, m, d);
  const twoYearsBefore = new Date(y - 2, m, d);
  const twelveYearsBefore = new Date(y - 12, m, d);

  if (paxType === "Adult") {
    return { max: toIsoDateLocal(twelveYearsBefore) };
  }
  if (paxType === "Child") {
    return {
      min: toIsoDateLocal(addCalendarDays(twelveYearsBefore, 1)),
      max: toIsoDateLocal(twoYearsBefore),
    };
  }
  if (paxType === "Infant") {
    return {
      min: toIsoDateLocal(addCalendarDays(twoYearsBefore, 1)),
      max: toIsoDateLocal(onRefDay),
    };
  }
  return {};
}

export function clampDobToBounds(
  dobIso: string,
  paxType: PaxTypeLabel,
  refLocal: Date,
): string {
  const v = String(dobIso || "").trim();
  if (!v) return v;
  const { min, max } = getDobInputBoundsIso(paxType, refLocal);
  if (min && v < min) return min;
  if (max && v > max) return max;
  return v;
}

export const PAX_DOB_HINT: Record<string, string> = {
  Infant: "Under 2 years on travel date",
  Child: "2 years up to before 12 years on travel date",
  Adult: "12 years or older on travel date",
};

/** Infer Adult / Child / Infant from DOB on the travel reference date only. */
export function inferPaxTypeFromDob(
  dobIso: string,
  refLocal: Date,
): PaxTypeLabel | null {
  const birth = parseLocalDateFromIso(dobIso);
  if (!birth) return null;
  if (birth.getTime() > refLocal.getTime()) return null;
  const age = getCompletedAgeYears(birth, refLocal);
  if (age >= 12) return "Adult";
  if (age >= 2) return "Child";
  return "Infant";
}

/**
 * Whether a saved traveller fits a booking slot.
 * When DOB is missing (e.g. domestic adult saves), the profile is eligible for Adult slots only.
 */
export function travellerMatchesPaxType(
  member: unknown,
  slotType: PaxTypeLabel,
  refLocal: Date,
): boolean {
  const dob = readTravellerDateOfBirthIso(member);
  if (!dob) return slotType === "Adult";
  const inferred = inferPaxTypeFromDob(dob, refLocal);
  return inferred === slotType;
}
