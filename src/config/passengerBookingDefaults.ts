/** Default date of birth for adult passengers (15 Jan 2000) — not collected in booking UI. */
export const DEFAULT_ADULT_DATE_OF_BIRTH = "2000-01-15";

export function getDefaultAdultDateOfBirth(): string {
  const v = process.env.NEXT_PUBLIC_DEFAULT_ADULT_DOB?.trim();
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return DEFAULT_ADULT_DATE_OF_BIRTH;
}

/** Adults always use the configured default; children/infants use entered DOB. */
export function resolvePassengerDateOfBirth(
  paxType: string,
  dob?: string | null,
): string {
  if (String(paxType) === "Adult") return getDefaultAdultDateOfBirth();
  return String(dob ?? "").trim();
}
