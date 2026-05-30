/** Trip type query param for MT `initiatePayment` (advance return → roundtrip). */
export function getPaymentTripTypeForInitiate(
  selectedFlight: Record<string, unknown> | null | undefined,
  searchTripType?: string,
): string {
  const sf = selectedFlight ?? {};
  if (sf.advanceRoundtrip === true) return "roundtrip";
  if (sf.isType2Roundtrip === true || sf.selectedReturn) return "roundtrip";
  if (searchTripType === "specialreturn") return "specialreturn";
  if (searchTripType === "advance") return "oneway";
  return searchTripType || "oneway";
}

export function getObResultTokenForPayment(selectedFlight: Record<string, unknown> | null | undefined): string {
  const sf = selectedFlight ?? {};
  return String(
    sf.resultToken ||
      sf.ResultToken ||
      (sf.fareQuoteData as { UpdateFareQuote?: { FareQuoteDetails?: { ResultToken?: string } } })
        ?.UpdateFareQuote?.FareQuoteDetails?.ResultToken ||
      "",
  ).trim();
}

export function getIbResultTokenForPayment(
  selectedFlight: Record<string, unknown> | null | undefined,
): string | undefined {
  const sf = selectedFlight ?? {};
  const token = String(
    sf.returnResultToken ||
      (sf.returnFareQuoteData as { UpdateFareQuote?: { FareQuoteDetails?: { ResultToken?: string } } })
        ?.UpdateFareQuote?.FareQuoteDetails?.ResultToken ||
      (sf.selectedReturn as { ResultToken?: string; resultToken?: string })?.ResultToken ||
      (sf.selectedReturn as { resultToken?: string })?.resultToken ||
      "",
  ).trim();
  return token || undefined;
}

export function isSeparateLegRoundtripPayment(
  selectedFlight: Record<string, unknown> | null | undefined,
): boolean {
  const sf = selectedFlight ?? {};
  return !!(sf.selectedReturn || sf.advanceRoundtrip);
}
