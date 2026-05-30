function truthyApiFlag(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

/** Read `IsPassportFullDetailRequiredAtBook` from an update-fare-quote payload, or null if absent. */
export function readPassportFullDetailRequiredAtBookFromFareQuote(
  fareQuoteData: unknown,
): boolean | null {
  if (!fareQuoteData || typeof fareQuoteData !== "object") return null;
  const root = fareQuoteData as Record<string, unknown>;
  const uq = (root.UpdateFareQuote ?? root.updateFareQuote) as Record<string, unknown> | undefined;
  const fqd = (uq?.FareQuoteDetails ?? uq?.fareQuoteDetails) as Record<string, unknown> | undefined;

  for (const rec of [fqd, uq, root]) {
    if (!rec || typeof rec !== "object") continue;
    if ("IsPassportFullDetailRequiredAtBook" in rec || "isPassportFullDetailRequiredAtBook" in rec) {
      return truthyApiFlag(
        rec.IsPassportFullDetailRequiredAtBook ?? rec.isPassportFullDetailRequiredAtBook,
      );
    }
  }
  return null;
}

/**
 * OB/IB merge for full passport detail at book.
 * International unknown → false (number + expiry only). Domestic unknown → true when passport is shown.
 */
export function mergePassportFullDetailRequiredAtBook(
  obFareQuoteData: unknown,
  ibFareQuoteData: unknown,
  isInternational: boolean,
): boolean {
  const ob = readPassportFullDetailRequiredAtBookFromFareQuote(obFareQuoteData);
  const ib = readPassportFullDetailRequiredAtBookFromFareQuote(ibFareQuoteData);
  if (ob === true || ib === true) return true;
  if (ob === false && ib === false) return false;
  if (ob === false || ib === false) return false;
  return isInternational ? false : true;
}

export type PassportPassengerRow = {
  type?: string;
  index?: number;
  dob?: string;
  passport?: string;
  passportIssue?: string;
  passportExpiry?: string;
  passportIssueCountry?: string;
};

export function passengerHasSubstantivePassportData(p: PassportPassengerRow): boolean {
  return (
    !!String(p?.passport ?? "").trim() ||
    !!String(p?.passportIssue ?? "").trim() ||
    !!String(p?.passportExpiry ?? "").trim()
  );
}

export type ValidatePassportBookingOptions = {
  requiresFullDetail: boolean;
  parseIsoDateOnly: (iso: string | undefined) => Date | null;
  getPassportIssueMinIso: (pax: PassportPassengerRow) => string | undefined;
  getEffectivePassportExpiryMinIso: (details: unknown[][] | undefined) => string;
  flightDetails?: unknown[][] | null;
};

/** Returns an error message, or null when valid. */
export function validatePassportDetailsForBooking(
  passengers: PassportPassengerRow[],
  opts: ValidatePassportBookingOptions,
): string | null {
  const { requiresFullDetail, parseIsoDateOnly, getPassportIssueMinIso, getEffectivePassportExpiryMinIso, flightDetails } =
    opts;

  if (passengers.some((p) => !String(p.passport ?? "").trim())) {
    return "Passport number is required for all passengers";
  }
  if (passengers.some((p) => !String(p.passportExpiry ?? "").trim())) {
    return "Passport expiry date is required for all passengers";
  }

  if (requiresFullDetail) {
    if (passengers.some((p) => !String(p.passportIssue ?? "").trim())) {
      return "Passport issue date is required for all passengers";
    }
    if (passengers.some((p) => !String(p.passportIssueCountry ?? "").trim())) {
      return "Passport issue country is required for all passengers";
    }
  }

  const badIssue = passengers.find((p) => {
    if (!requiresFullDetail && !String(p.passportIssue ?? "").trim()) return false;
    if (!passengerHasSubstantivePassportData(p) && !String(p.passportIssue ?? "").trim()) return false;
    const issue = parseIsoDateOnly(p.passportIssue);
    if (!issue) return requiresFullDetail;
    const dob = parseIsoDateOnly(p.dob);
    if (dob) return issue.getTime() < dob.getTime();
    const fallbackMin = parseIsoDateOnly(getPassportIssueMinIso(p));
    if (!fallbackMin) return false;
    return issue.getTime() < fallbackMin.getTime();
  });
  if (badIssue) {
    const label = `${badIssue.type} ${Number(badIssue.index ?? 0) + 1}`;
    const hasDob = !!String(badIssue.dob || "").trim();
    return hasDob
      ? `Invalid passport details for ${label}.\nPassport issue date cannot be earlier than date of birth.`
      : `Invalid passport details for ${label}.\nPassport issue date is outside the allowed range for this passenger type (or add date of birth for a precise check).`;
  }

  const minIso = getEffectivePassportExpiryMinIso(flightDetails ?? undefined);
  const minD = parseIsoDateOnly(minIso);
  const badExpiry = passengers.find((p) => {
    if (!passengerHasSubstantivePassportData(p)) return false;
    const exp = parseIsoDateOnly(p.passportExpiry);
    if (!exp || !minD) return false;
    return exp.getTime() < minD.getTime();
  });
  if (badExpiry) {
    const label = `${badExpiry.type} ${Number(badExpiry.index ?? 0) + 1}`;
    return `Invalid passport details for ${label}.\nPassport must be valid through at least ${minIso} (covering your travel date and at least 6 months from today).`;
  }

  return null;
}
