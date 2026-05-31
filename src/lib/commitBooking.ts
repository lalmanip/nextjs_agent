import { getFlightDomainTokenCached, invalidateFlightDomainToken } from "@/lib/flightAuth";
import { API_KEY } from "@/lib/config";
import { getFlightDetailsFromFareQuoteData, getBookingDisplayFlightDetails, flightIsInternational, selectedFlightIsLcc } from "@/lib/flightDisplay";
import {
  normalizeLeadPassengerAddress,
  resolveLeadPassengerAddressForLcc,
  validateLeadPassengerAddress,
  type LeadPassengerAddress,
} from "@/lib/leadPassengerAddress";
import { mergePassportFullDetailRequiredAtBook } from "@/lib/passportBookingRules";
import { isFlightHoldFeatureEnabled } from "@/lib/flightHoldConfig";
import { resolvePassengerDateOfBirth } from "@/config/passengerBookingDefaults";

export type CommitBookingPaymentData = {
  passengerDetails: any[];
  guestEmail: string;
  guestMobile: string;
  cellCountryCode: string;
  leadPassengerAddress?: LeadPassengerAddress;
};

function commitBookingClientHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-API-KEY": API_KEY,
    Authorization: `Bearer ${token}`,
  };
}

const COMMIT_BOOKING_LOG_BODY_MAX = 24_000;

function maskSecret(value: string, head = 6, tail = 4): string {
  const s = String(value ?? "");
  if (!s) return "(empty)";
  if (s.length <= head + tail + 1) return "***";
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/** Shallow clone for logs: omit large `Passengers` array. */
function commitBookingBodyForLog(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  if (Array.isArray(out.Passengers)) {
    out.Passengers = `[${out.Passengers.length} passengers — omitted from log]`;
  }
  return out;
}

function commitBookingHeadersForLog(headers: HeadersInit): Record<string, string> {
  const h = new Headers(headers);
  const o: Record<string, string> = {};
  h.forEach((v, k) => {
    const lower = k.toLowerCase();
    if (lower === "authorization") {
      const m = /^Bearer\s+(.+)$/i.exec(v.trim());
      o[k] = m ? `Bearer ${maskSecret(m[1])}` : maskSecret(v);
    } else if (lower === "x-api-key") {
      o[k] = maskSecret(v);
    } else {
      o[k] = v;
    }
  });
  return o;
}

function stringifyCommitBookingLog(value: unknown, maxLen = COMMIT_BOOKING_LOG_BODY_MAX): string {
  try {
    const s = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}\n… (truncated after ${maxLen} chars)`;
  } catch {
    return String(value).slice(0, maxLen);
  }
}

/**
 * POST `/api/flight/commit-booking` with masked outgoing logs and parsed incoming response log.
 */
async function fetchCommitBookingApi(
  logLabel: string,
  token: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const url = "/api/flight/commit-booking";
  const headers = commitBookingClientHeaders(token);
  console.log(
    `\n[commit-booking:${logLabel}] OUTGOING (browser → Next)\n` +
      stringifyCommitBookingLog({
        url,
        method: "POST",
        headers: commitBookingHeadersForLog(headers),
        body: commitBookingBodyForLog(body),
      }),
  );
  /** Full JSON sent as fetch body — includes `Passengers` (PAN, passport, etc.). */
  console.log(
    `[commit-booking:${logLabel}] REQUEST_JSON_FULL (browser → Next)\n` +
      stringifyCommitBookingLog(body),
  );
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const rawText = await res.clone().text();
  let incomingParsed: unknown = rawText.slice(0, COMMIT_BOOKING_LOG_BODY_MAX);
  if (rawText.trim()) {
    try {
      incomingParsed = JSON.parse(rawText) as unknown;
    } catch {
      incomingParsed = rawText.slice(0, COMMIT_BOOKING_LOG_BODY_MAX);
    }
  } else {
    incomingParsed = null;
  }
  console.log(
    `\n[commit-booking:${logLabel}] INCOMING (Next → browser)\n` +
      stringifyCommitBookingLog({
        status: res.status,
        statusText: res.statusText,
        body: incomingParsed,
      }),
  );
  return res;
}

/** When Kong (or similar) times out before the booking API responds — user may still see the booking in My Bookings. */
export const COMMIT_BOOKING_GATEWAY_TIMEOUT_USER_MESSAGE = [
  "We could not confirm within the time limit. Your booking may still be processing.",
  "",
  "Follow the steps below:",
  '1. If you are logged in, open "My Bookings" under your profile icon (top-right corner).',
  "   OR",
  "1. If you have not signed up, please sign up using the same email address.",
  "2. Log in.",
  '3. Open "My Bookings" under your profile icon (top-right corner).',
  "",
  "Check if you see your bookings listed there.",
  "",
  "Warning: Do not pay again until you see a confirmed booking or a clear failure.",
  "",
  "If stuck: bookings@vivancetravels.com / +91 91610-77111",
].join("\n");

export function isCommitBookingGatewayTimeout(res: Response, body: unknown): boolean {
  if (res.status === 504 || res.status === 502 || res.status === 503) return true;
  const o = body as Record<string, unknown> | null | undefined;
  if (o?.gatewayTimeout === true) return true;
  const errStr = String(o?.error ?? "");
  if (/^HTTP\s*50[234]\b/i.test(errStr)) return true;
  const raw = String(o?.raw ?? "").toLowerCase();
  if (
    raw.includes("504 gateway") ||
    raw.includes("gateway time-out") ||
    raw.includes("gateway timeout") ||
    raw.includes("504 gateway time-out") ||
    raw.includes("didn't respond in time") ||
    raw.includes("the server didn't respond in time")
  ) {
    return true;
  }
  const m = String(o?.message ?? o?.Message ?? o?.error ?? "").toLowerCase();
  if (!m) return false;
  if (m.includes("upstream") && (m.includes("timeout") || m.includes("timing out"))) return true;
  return false;
}

export interface CommitResult {
  pnr: string;
  appReference: string;
  ticketDetails: any;
  /** Set when the commit call used this bearer token (e.g. My Bookings SkipBook). */
  domainToken?: string;
}

/**
 * Error thrown by commitBooking that may carry a partially-created booking reference.
 * Populated when the outbound leg committed (so an AppReference/PNR exists) but a later
 * step — inbound leg or ticketing — failed. Lets the failure screen surface these to the user.
 */
export class CommitBookingError extends Error {
  readonly appReference?: string;
  readonly pnr?: string;
  constructor(message: string, opts?: { appReference?: string; pnr?: string }) {
    super(message);
    this.name = "CommitBookingError";
    this.appReference = opts?.appReference || undefined;
    this.pnr = opts?.pnr || undefined;
  }
}

/**
 * Reads `/api/flight/commit-booking` response body once, then parses JSON.
 * Treats HTML or JSON-wrapped HTML gateway 504/502 pages and Kong-style timeouts
 * as the same user-facing "check My Bookings" outcome (not "HTML instead of JSON").
 */
async function parseCommitBookingApiResponse(response: Response, apiLabel: string): Promise<any> {
  const rawBody = await response.text();
  const trimmed = rawBody.trim();
  const lower = trimmed.toLowerCase();

  if (response.status === 504 || response.status === 503 || response.status === 502) {
    throw new Error(COMMIT_BOOKING_GATEWAY_TIMEOUT_USER_MESSAGE);
  }

  if (
    trimmed.startsWith("<") &&
    /504|502|503|gateway|time-?out|timed out|didn't respond|bad gateway/i.test(lower)
  ) {
    throw new Error(COMMIT_BOOKING_GATEWAY_TIMEOUT_USER_MESSAGE);
  }

  if (!trimmed) {
    return {};
  }

  let parsed: any = {};
  const contentType = response.headers.get("content-type") || "";
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[") || contentType.includes("application/json");
  if (looksJson) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new Error(`${apiLabel} returned malformed JSON`);
    }
  } else {
    throw new Error(`${apiLabel} returned unexpected response`);
  }

  if (isCommitBookingGatewayTimeout(response, parsed)) {
    throw new Error(COMMIT_BOOKING_GATEWAY_TIMEOUT_USER_MESSAGE);
  }

  return parsed;
}

function buildPax(
  p: any,
  i: number,
  leg: "ob" | "ib",
  guestMobile: string,
  cellCountryCode: string,
  guestEmail: string,
  leadAddress?: LeadPassengerAddress | null,
  includePassportIssueFields = true,
): any {
  const isLead = i === 0;
  const addr = isLead && leadAddress ? normalizeLeadPassengerAddress(leadAddress) : null;
  const pd: any = {
    IsLeadPax: isLead ? "1" : "0",
    Title: p.title || "Mr",
    FirstName: p.firstName,
    LastName: p.lastName,
    PaxType: p.type === "Adult" ? "1" : p.type === "Child" ? "2" : "3",
    Gender: p.gender === "Female" ? "2" : "1",
    DateOfBirth: resolvePassengerDateOfBirth(p.type, p.dob) || "1990-01-01",
    PassportNumber: p.passport || "",
    PassportExpiry: p.passportExpiry || "",
    CountryName: addr?.countryName || "India",
    CountryCode: addr?.countryCode || "IN",
    ContactNo: guestMobile,
    CellCountryCode: cellCountryCode,
    City: addr?.city || "Mumbai",
    ...(addr?.state ? { State: addr.state } : {}),
    PinCode: addr?.pinCode || "400001",
    AddressLine1: addr?.addressLine1 || "Default Address",
    AddressLine2: addr?.addressLine2 || addr?.addressLine1 || "Default Address",
    Email: guestEmail,
  };
  if (includePassportIssueFields) {
    pd.PassportIssueDate = p.passportIssue || "";
    pd.PassportIssueCountryCode = p.passportIssueCountry || "IN";
  }
  const pan = String(p?.pan ?? p?.PAN ?? "").trim().toUpperCase();
  if (pan) pd.PAN = pan;
  const ffNumber = String(p?.ffNumber ?? p?.FFNumber ?? "").trim();
  const ffAirlineCode = String(p?.ffAirlineCode ?? p?.FFAirlineCode ?? "").trim().toUpperCase();
  if (ffNumber && ffAirlineCode) {
    pd.FFNumber = ffNumber;
    pd.FFAirlineCode = ffAirlineCode;
  }
  if (leg === "ob") {
    if (p.obBaggage && p.type !== "Infant") pd.Baggage = [p.obBaggage];
    if (p.obMeal) pd.MealDynamic = [p.obMeal];
    if (p.obSeat && p.type !== "Infant") pd.SeatDynamic = [p.obSeat];
  } else {
    if (p.ibBaggage && p.type !== "Infant") pd.Baggage = [p.ibBaggage];
    if (p.ibMeal) pd.MealDynamic = [p.ibMeal];
    if (p.ibSeat && p.type !== "Infant") pd.SeatDynamic = [p.ibSeat];
  }
  return pd;
}

export async function commitBooking(
  flightData: any,
  pData: CommitBookingPaymentData,
  tripTypeLocal: string,
): Promise<CommitResult> {
  let token: string = flightData?.domainToken || "";
  if (!token) token = await getFlightDomainTokenCached();

  const flightDetails =
    getFlightDetailsFromFareQuoteData(flightData?.fareQuoteData) ||
    flightData?.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.FlightDetails?.Details;
  const isLcc = selectedFlightIsLcc(flightData, flightDetails);
  const leadAddressOverride =
    pData.leadPassengerAddress ??
    (pData.passengerDetails?.[0]?.leadPassengerAddress as LeadPassengerAddress | undefined);
  const leadAddrForPax = isLcc
    ? resolveLeadPassengerAddressForLcc(leadAddressOverride)
    : null;
  if (isLcc) {
    const addrErr = validateLeadPassengerAddress(leadAddrForPax);
    if (addrErr) throw new Error(addrErr);
  }

  const itineraryForPassport = getBookingDisplayFlightDetails(flightData);
  const isInternational = flightIsInternational(itineraryForPassport);
  const passportFullDetailAtBook = mergePassportFullDetailRequiredAtBook(
    flightData?.fareQuoteData,
    flightData?.returnFareQuoteData,
    isInternational,
  );
  const includePassportIssueInCommit = passportFullDetailAtBook;

  const isRoundtrip =
    tripTypeLocal === "roundtrip" ||
    !!flightData?.selectedReturn ||
    flightData?.advanceRoundtrip === true ||
    !!flightData?.isType2Roundtrip;
  const isType1Roundtrip =
    !!flightData?.selectedReturn || flightData?.advanceRoundtrip === true;
  const isType2RoundtripPaired = flightData?.isType2Roundtrip === true;

  const obResultToken =
    flightData?.resultToken ||
    flightData?.ResultToken ||
    flightData?.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.ResultToken;

  const obPassengers = pData.passengerDetails.map((p, i) =>
    buildPax(
      p,
      i,
      "ob",
      pData.guestMobile,
      pData.cellCountryCode,
      pData.guestEmail,
      leadAddrForPax,
      includePassportIssueInCommit,
    ),
  );
  const ibPassengers = pData.passengerDetails.map((p, i) =>
    buildPax(
      p,
      i,
      "ib",
      pData.guestMobile,
      pData.cellCountryCode,
      pData.guestEmail,
      leadAddrForPax,
      includePassportIssueInCommit,
    ),
  );

  if (isRoundtrip) {
    console.log(
      `[commit-booking] Roundtrip ${isType2RoundtripPaired ? "Type 2 (OB+IB paired) — single call" : "Type 1 (OB/IB separate) — two calls"}`,
    );
  } else {
    console.log("[commit-booking] Oneway — single call");
  }

  const holdBooking = isFlightHoldFeatureEnabled() && flightData?.holdBooking === true;
  if (holdBooking) console.log("[commit-booking] HoldBooking=true — ticketing will be skipped on backend");

  console.log("[commit-booking] OB call — ResultToken:", obResultToken);
  const doObCommit = (t: string) =>
    fetchCommitBookingApi(
      "OB",
      t,
      {
        SequenceNumber: 0,
        ResultToken: obResultToken,
        Passengers: obPassengers,
        ...(holdBooking && { HoldBooking: true }),
      },
    );

  let obCommitRes = await doObCommit(token);
  if (obCommitRes.status === 401) {
    console.warn("[commit-booking] OB token expired (401) — refreshing and retrying");
    invalidateFlightDomainToken();
    token = await getFlightDomainTokenCached();
    obCommitRes = await doObCommit(token);
  }
  const obCommitResult = await parseCommitBookingApiResponse(obCommitRes, "OB commit-booking API");
  if (!obCommitRes.ok) {
    if (isCommitBookingGatewayTimeout(obCommitRes, obCommitResult)) {
      throw new Error(COMMIT_BOOKING_GATEWAY_TIMEOUT_USER_MESSAGE);
    }
    throw new Error(
      obCommitResult?.error ||
        obCommitResult?.Message ||
        `OB commit-booking failed (HTTP ${obCommitRes.status})`,
    );
  }
  if (obCommitResult.Status !== "1" && obCommitResult.Status !== 1) {
    throw new Error(obCommitResult.Message || "OB booking commit failed");
  }

  const obPnr: string = obCommitResult.CommitBooking?.BookingDetails?.PNR || "";
  const obAppReference: string =
    obCommitResult.AppReference ||
    obCommitResult.CommitBooking?.BookingDetails?.AppReference ||
    "";

  console.log("[commit-booking] OB result — PNR:", obPnr, "AppReference:", obAppReference || "(empty)");

  let ibPnr = "";
  let ibAppReference = "";

  if (isRoundtrip && isType1Roundtrip) {
    try {
    const ibResultToken =
      flightData?.returnResultToken ||
      flightData?.returnFareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.ResultToken ||
      flightData?.selectedReturn?.ResultToken ||
      flightData?.selectedReturn?.resultToken;

    if (!ibResultToken) throw new Error("IB result token not found for Type 1 roundtrip booking");

    if (!obAppReference) {
      console.warn("[commit-booking] WARNING: obAppReference is empty — IB call will proceed without it");
    } else {
      console.log("[commit-booking] IB call will include AppReference:", obAppReference);
    }

    const ibBody = {
      SequenceNumber: 1,
      ResultToken: ibResultToken,
      Passengers: ibPassengers,
      ...(obAppReference && { AppReference: obAppReference }),
      ...(holdBooking && { HoldBooking: true }),
    };

    const doIbCommit = (t: string) => fetchCommitBookingApi("IB", t, ibBody);

    let ibCommitRes = await doIbCommit(token);
    if (ibCommitRes.status === 401) {
      console.warn("[commit-booking] IB token expired (401) — refreshing and retrying");
      invalidateFlightDomainToken();
      token = await getFlightDomainTokenCached();
      ibCommitRes = await doIbCommit(token);
    }
    const ibCommitResult = await parseCommitBookingApiResponse(ibCommitRes, "IB commit-booking API");
    if (!ibCommitRes.ok) {
      if (isCommitBookingGatewayTimeout(ibCommitRes, ibCommitResult)) {
        throw new Error(COMMIT_BOOKING_GATEWAY_TIMEOUT_USER_MESSAGE);
      }
      throw new Error(
        ibCommitResult?.error ||
          ibCommitResult?.Message ||
          `IB commit-booking failed (HTTP ${ibCommitRes.status})`,
      );
    }
    if (ibCommitResult.Status !== "1" && ibCommitResult.Status !== 1) {
      throw new Error(ibCommitResult.Message || "IB booking commit failed");
    }
    ibPnr = ibCommitResult.CommitBooking?.BookingDetails?.PNR || "";
    ibAppReference =
      ibCommitResult.AppReference ||
      ibCommitResult.CommitBooking?.BookingDetails?.AppReference ||
      "";
    } catch (e) {
      if (e instanceof CommitBookingError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      // Outbound leg already committed — preserve its reference so support can locate it.
      throw new CommitBookingError(msg, { appReference: obAppReference, pnr: obPnr });
    }
  }

  const finalPnr = isRoundtrip && ibPnr ? `${obPnr} / ${ibPnr}` : obPnr;
  const finalAppReference = obAppReference || ibAppReference;

  let ticketDetails: any = null;
  const ticketRes = await fetch(`/api/flight/ticket-details?appReference=${finalAppReference}`);
  if (ticketRes.ok) {
    const ct = ticketRes.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        ticketDetails = await ticketRes.json();
      } catch {
        const fallback = await ticketRes.text();
        console.warn("[ticket-details] Non-JSON response; continuing.", fallback.slice(0, 200));
      }
    } else {
      const fallback = await ticketRes.text();
      console.warn("[ticket-details] Non-JSON response; continuing.", fallback.slice(0, 200));
    }
  }

  return { pnr: finalPnr, appReference: finalAppReference, ticketDetails };
}

/**
 * My Bookings: finalize ticketing via commit-booking with `SkipBook: true`
 * (same endpoint/response shape as the regular post-payment commit).
 */
export async function commitBookingSkipBook(pnr: string, bookingId: number): Promise<CommitResult> {
  const pnrTrim = String(pnr ?? "").trim();
  if (!pnrTrim) throw new Error("PNR is required to get your ticket.");
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    throw new Error("Invalid booking ID. Please refresh My Bookings and try again.");
  }

  let token: string = await getFlightDomainTokenCached();
  const body = { PNR: pnrTrim, BookingId: bookingId, SkipBook: true as const };

  const post = (t: string) => fetchCommitBookingApi("SkipBook", t, { ...body });

  let res = await post(token);
  if (res.status === 401) {
    console.warn("[commit-booking] SkipBook token expired (401) — refreshing and retrying");
    invalidateFlightDomainToken();
    token = await getFlightDomainTokenCached();
    res = await post(token);
  }

  const parsed = await parseCommitBookingApiResponse(res, "commit-booking API (SkipBook)");
  if (!res.ok) {
    if (isCommitBookingGatewayTimeout(res, parsed)) {
      throw new Error(COMMIT_BOOKING_GATEWAY_TIMEOUT_USER_MESSAGE);
    }
    throw new Error(
      parsed?.error || parsed?.Message || `commit-booking failed (HTTP ${res.status})`,
    );
  }
  if (parsed.Status !== "1" && parsed.Status !== 1) {
    throw new Error(parsed.Message || "Could not complete ticketing for this booking.");
  }

  const obPnr: string = parsed.CommitBooking?.BookingDetails?.PNR || pnrTrim;
  const obAppReference: string =
    parsed.AppReference || parsed.CommitBooking?.BookingDetails?.AppReference || "";

  if (!obAppReference) {
    throw new Error(
      "Ticketing may have succeeded but we could not read the application reference. Please check My Bookings or contact support.",
    );
  }

  let ticketDetails: any = null;
  const ticketRes = await fetch(`/api/flight/ticket-details?appReference=${encodeURIComponent(obAppReference)}`);
  if (ticketRes.ok) {
    const ct = ticketRes.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        ticketDetails = await ticketRes.json();
      } catch {
        const fallback = await ticketRes.text();
        console.warn("[ticket-details] Non-JSON response; continuing.", fallback.slice(0, 200));
      }
    } else {
      const fallback = await ticketRes.text();
      console.warn("[ticket-details] Non-JSON response; continuing.", fallback.slice(0, 200));
    }
  }

  return { pnr: obPnr, appReference: obAppReference, ticketDetails, domainToken: token };
}
