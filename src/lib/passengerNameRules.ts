/**
 * Airline-dependent first/last name validation for flight booking.
 * Rules mirror supplier GDS constraints (NDC, LCC, regional carriers).
 */

import { readSegmentOperatorCode, segmentIsSpiceJet } from "@/lib/spiceJetPassengerRules";

export const PASSENGER_FIRST_NAME_MIN = 1;
export const PASSENGER_FIRST_NAME_MAX = 32;
export const PASSENGER_LAST_NAME_MIN = 2;
export const PASSENGER_LAST_NAME_MAX = 32;

/** NDC restrict-search / fare-class carriers (see FlightSearch). */
export const NDC_OPERATOR_CODES = new Set(["EK", "LH", "WY", "EY", "GF", "AI"]);

const JAZEERA_AIR_ARABIA_CODES = new Set(["J9", "G9"]);

/** Last name: letters only (no space, no dot). */
const LETTERS_ONLY_LAST_NAME_OPERATOR_CODES = new Set([
  "2S", // TruJet
  "ZO", // Zoom Air
  "KB", // Druk Air (Bhutan)
  "QP", // Air Costa
]);

const FIRST_NAME_NDC_PATTERN = /^[A-Za-z]+$/;
const FIRST_NAME_DEFAULT_PATTERN = /^[A-Za-z](?:[A-Za-z]| [A-Za-z]|\.[A-Za-z])*$/;
const LAST_NAME_LETTERS_ONLY_PATTERN = /^[A-Za-z]+$/;
/** NDC last name: A–Z and spaces only (no periods). */
const LAST_NAME_LETTERS_SPACE_PATTERN = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const LAST_NAME_LETTERS_DOT_PATTERN = /^[A-Za-z]+(?:\.[A-Za-z]+)*$/;
const LAST_NAME_DEFAULT_PATTERN = /^[A-Za-z](?:[A-Za-z]| [A-Za-z]|\.[A-Za-z])*$/;

/** Last name must not contain title tokens with a trailing period (NDC, Bhutan, etc.). */
const LAST_NAME_TITLES_TRAILING_DOT = /(?:Mr|Ms|Miss|Mstr|Mrs)\./i;

/** Last name must not contain title tokens with a leading period (SpiceJet, most others). */
const LAST_NAME_TITLES_LEADING_DOT = /\.(?:Mr|Ms|Miss|Mstr|Mrs)\b/i;

export type LastNameTitleRestriction =
  | "titles_trailing_dot"
  | "titles_leading_dot"
  | "no_leading_dot";

export type PassengerNameRulesContext = {
  /** When true, first name allows A–Z only (any NDC segment or NDC fare class). */
  firstNameNdcLettersOnly: boolean;
  lastNameAllowSpace: boolean;
  lastNameAllowDot: boolean;
  /** NDC (or NDC fare): last name is A–Z with spaces, no periods. */
  lastNameNdcLettersWithSpace: boolean;
  /** Union of per-airline last-name title rules for the booked itinerary. */
  lastNameTitleRestrictions: Set<LastNameTitleRestriction>;
};

function readSegmentOperatorName(seg: unknown): string {
  if (!seg || typeof seg !== "object") return "";
  const s = seg as Record<string, unknown>;
  return String(s.OperatorName ?? s.operatorName ?? "").trim();
}

function segmentMatchesLettersOnlyLastNameRule(seg: unknown): boolean {
  const code = readSegmentOperatorCode(seg);
  if (LETTERS_ONLY_LAST_NAME_OPERATOR_CODES.has(code)) return true;
  const name = readSegmentOperatorName(seg).toLowerCase();
  return (
    name.includes("bhutan") ||
    name.includes("aircosta") ||
    name.includes("air costa") ||
    name.includes("trujet") ||
    name.includes("zoom air") ||
    name.includes("zoomair")
  );
}

function segmentMatchesJazeeraOrAirArabia(seg: unknown): boolean {
  const code = readSegmentOperatorCode(seg);
  if (JAZEERA_AIR_ARABIA_CODES.has(code)) return true;
  const name = readSegmentOperatorName(seg).toLowerCase();
  return name.includes("jazeera") || name.includes("air arabia") || name.includes("airarabia");
}

function segmentMatchesNdcOrBhutanStyleLastNameTitles(seg: unknown): boolean {
  const code = readSegmentOperatorCode(seg);
  if (NDC_OPERATOR_CODES.has(code)) return true;
  return segmentMatchesLettersOnlyLastNameRule(seg);
}

function applyLastNameTitleRestrictionsForSegment(
  seg: unknown,
  restrictions: Set<LastNameTitleRestriction>,
): void {
  if (segmentMatchesNdcOrBhutanStyleLastNameTitles(seg)) {
    restrictions.add("titles_trailing_dot");
    return;
  }
  if (segmentIsSpiceJet(seg)) {
    restrictions.add("titles_leading_dot");
    return;
  }
  if (segmentMatchesJazeeraOrAirArabia(seg)) {
    restrictions.add("no_leading_dot");
    return;
  }
  restrictions.add("titles_leading_dot");
}

function readSupplierFareClassFromFlight(f: unknown): string {
  if (!f || typeof f !== "object") return "";
  const o = f as Record<string, unknown>;
  const attr = (o.Attr ?? o.attr) as Record<string, unknown> | undefined;
  return String(attr?.supplierFareClass ?? attr?.SupplierFareClass ?? "").trim();
}

function flightObjectIsNdcFare(f: unknown): boolean {
  return readSupplierFareClassFromFlight(f).toUpperCase().includes("NDC");
}

function collectFlightsForNdcCheck(selectedFlight: unknown): unknown[] {
  if (!selectedFlight || typeof selectedFlight !== "object") return [];
  const sf = selectedFlight as Record<string, unknown>;
  return [
    selectedFlight,
    sf.selectedReturn,
    sf.outbound,
    sf.inbound,
  ].filter(Boolean);
}

function forEachSegmentInDetails(
  details: unknown[][] | undefined | null,
  fn: (seg: unknown) => void,
): void {
  if (!Array.isArray(details)) return;
  for (const leg of details) {
    if (!Array.isArray(leg)) continue;
    for (const seg of leg) fn(seg);
  }
}

/** Build validation context from booked itinerary + selected fare(s). */
export function buildPassengerNameRulesContext(
  selectedFlight: unknown,
  flightDetails: unknown[][] | undefined | null,
): PassengerNameRulesContext {
  let firstNameNdcLettersOnly = false;
  let lastNameLettersOnlyRequired = false;
  let lastNameDisallowSpace = false;
  let itineraryIncludesNdcLastName = false;
  const lastNameTitleRestrictions = new Set<LastNameTitleRestriction>();

  for (const f of collectFlightsForNdcCheck(selectedFlight)) {
    if (flightObjectIsNdcFare(f)) firstNameNdcLettersOnly = true;
  }

  const applySegment = (seg: unknown) => {
    const code = readSegmentOperatorCode(seg);
    if (NDC_OPERATOR_CODES.has(code)) {
      firstNameNdcLettersOnly = true;
      itineraryIncludesNdcLastName = true;
    } else if (segmentMatchesLettersOnlyLastNameRule(seg)) {
      lastNameLettersOnlyRequired = true;
    } else if (segmentMatchesJazeeraOrAirArabia(seg)) {
      lastNameDisallowSpace = true;
    }

    applyLastNameTitleRestrictionsForSegment(seg, lastNameTitleRestrictions);
  };

  forEachSegmentInDetails(flightDetails, applySegment);

  if (firstNameNdcLettersOnly) {
    itineraryIncludesNdcLastName = true;
    lastNameTitleRestrictions.add("titles_trailing_dot");
  }

  const lastNameAllowSpace = !lastNameLettersOnlyRequired && !lastNameDisallowSpace;
  const lastNameAllowDot = !lastNameLettersOnlyRequired && !itineraryIncludesNdcLastName;
  const lastNameNdcLettersWithSpace =
    itineraryIncludesNdcLastName && !lastNameLettersOnlyRequired && lastNameAllowSpace;

  return {
    firstNameNdcLettersOnly,
    lastNameAllowSpace,
    lastNameAllowDot,
    lastNameNdcLettersWithSpace,
    lastNameTitleRestrictions,
  };
}

function stripToLetters(raw: string): string {
  return raw.replace(/[^A-Za-z]/g, "");
}

function stripToLettersSpace(raw: string): string {
  return raw.replace(/[^A-Za-z ]/g, "");
}

function stripToLettersSpaceDot(raw: string): string {
  return raw.replace(/[^A-Za-z. ]/g, "").replace(/^\.+/, "");
}

function stripToLettersDot(raw: string): string {
  return raw.replace(/[^A-Za-z.]/g, "").replace(/^\.+/, "");
}

export function sanitizePassengerFirstName(
  raw: string,
  ctx: PassengerNameRulesContext,
  maxLength = PASSENGER_FIRST_NAME_MAX,
): string {
  const cleaned = ctx.firstNameNdcLettersOnly
    ? stripToLetters(raw)
    : stripToLettersSpaceDot(raw);
  return cleaned.slice(0, maxLength);
}

export function sanitizePassengerLastName(
  raw: string,
  ctx: PassengerNameRulesContext,
  maxLength = PASSENGER_LAST_NAME_MAX,
): string {
  let cleaned: string;
  if (!ctx.lastNameAllowSpace && !ctx.lastNameAllowDot) {
    cleaned = stripToLetters(raw);
  } else if (ctx.lastNameNdcLettersWithSpace) {
    cleaned = stripToLettersSpace(raw);
  } else if (!ctx.lastNameAllowSpace && ctx.lastNameAllowDot) {
    cleaned = stripToLettersDot(raw);
  } else {
    cleaned = stripToLettersSpaceDot(raw);
  }
  return cleaned.slice(0, maxLength);
}

function firstNamePattern(ctx: PassengerNameRulesContext): RegExp {
  return ctx.firstNameNdcLettersOnly ? FIRST_NAME_NDC_PATTERN : FIRST_NAME_DEFAULT_PATTERN;
}

function lastNamePattern(ctx: PassengerNameRulesContext): RegExp {
  if (!ctx.lastNameAllowSpace && !ctx.lastNameAllowDot) return LAST_NAME_LETTERS_ONLY_PATTERN;
  if (ctx.lastNameNdcLettersWithSpace) return LAST_NAME_LETTERS_SPACE_PATTERN;
  if (!ctx.lastNameAllowSpace && ctx.lastNameAllowDot) return LAST_NAME_LETTERS_DOT_PATTERN;
  return LAST_NAME_DEFAULT_PATTERN;
}

function firstNameFormatHint(ctx: PassengerNameRulesContext): string {
  if (ctx.firstNameNdcLettersOnly) {
    return "letters A–Z only (no spaces or periods)";
  }
  return "letters A–Z; spaces and periods allowed between parts; cannot start with a period";
}

function lastNameFormatHint(ctx: PassengerNameRulesContext): string {
  const parts: string[] = [];
  if (!ctx.lastNameAllowSpace && !ctx.lastNameAllowDot) {
    parts.push("letters A–Z only (no spaces or periods)");
  } else if (ctx.lastNameNdcLettersWithSpace) {
    parts.push("letters A–Z and spaces (no periods)");
  } else if (!ctx.lastNameAllowSpace && ctx.lastNameAllowDot) {
    parts.push("letters A–Z and periods only (no spaces)");
  } else {
    parts.push("letters A–Z; spaces and periods allowed between parts");
  }
  const titleHint = lastNameTitleRestrictionsHint(ctx.lastNameTitleRestrictions);
  if (titleHint) parts.push(titleHint);
  return parts.join("; ");
}

function lastNameTitleRestrictionsHint(restrictions: Set<LastNameTitleRestriction>): string {
  const parts: string[] = [];
  if (restrictions.has("titles_trailing_dot")) {
    parts.push("no Mr., Ms., Miss., Mstr., or Mrs.");
  }
  if (restrictions.has("titles_leading_dot")) {
    parts.push("no .Mr, .Ms, .Miss, .Mstr, or .Mrs");
  }
  if (restrictions.has("no_leading_dot")) {
    parts.push("cannot start with a period");
  }
  return parts.length ? parts.join("; ") : "";
}

function getLastNameTitleValidationError(
  value: string,
  fieldLabel: string,
  restrictions: Set<LastNameTitleRestriction>,
): string | null {
  const t = value.trim();
  if (!t) return null;

  if (restrictions.has("titles_trailing_dot") && LAST_NAME_TITLES_TRAILING_DOT.test(t)) {
    return `${fieldLabel} must not include Mr., Ms., Miss., Mstr., or Mrs. (with a period after the title).`;
  }
  if (restrictions.has("titles_leading_dot") && LAST_NAME_TITLES_LEADING_DOT.test(t)) {
    return `${fieldLabel} must not include .Mr, .Ms, .Miss, .Mstr, or .Mrs.`;
  }
  if (restrictions.has("no_leading_dot") && t.startsWith(".")) {
    return `${fieldLabel} must not start with a period (.).`;
  }
  return null;
}

export function getPassengerFirstNameValidationError(
  value: string,
  fieldLabel: string,
  ctx: PassengerNameRulesContext,
  minLength = PASSENGER_FIRST_NAME_MIN,
  maxLength = PASSENGER_FIRST_NAME_MAX,
): string | null {
  const t = value.trim();
  if (t.length < minLength || t.length > maxLength) {
    return `${fieldLabel} must be ${minLength}–${maxLength} characters (${firstNameFormatHint(ctx)}).`;
  }
  if (!firstNamePattern(ctx).test(t)) {
    return `${fieldLabel} may only use ${firstNameFormatHint(ctx)}.`;
  }
  return null;
}

export function getPassengerLastNameValidationError(
  value: string,
  fieldLabel: string,
  ctx: PassengerNameRulesContext,
  minLength = PASSENGER_LAST_NAME_MIN,
  maxLength = PASSENGER_LAST_NAME_MAX,
): string | null {
  const t = value.trim();
  if (t.length < minLength || t.length > maxLength) {
    return `${fieldLabel} must be ${minLength}–${maxLength} characters (${lastNameFormatHint(ctx)}).`;
  }
  if (!lastNamePattern(ctx).test(t)) {
    return `${fieldLabel} may only use ${lastNameFormatHint(ctx)}.`;
  }
  const titleErr = getLastNameTitleValidationError(t, fieldLabel, ctx.lastNameTitleRestrictions);
  if (titleErr) return titleErr;
  return null;
}
