import type { FlightSearchRequest } from "./api";
import type { SearchState } from "./bookingState";

const FLIGHT_SEARCH_KEY = "vivance_flight_search";

type SavedFlightSearchForm = {
  fromQuery?: string;
  toQuery?: string;
  selectedFrom?: { airportCode?: string; airportName?: string; cityName?: string };
  selectedTo?: { airportCode?: string; airportName?: string; cityName?: string };
  multiCityLegs?: Array<{
    fromQuery?: string;
    toQuery?: string;
    selectedFrom?: { airportCode?: string; airportName?: string };
    selectedTo?: { airportCode?: string; airportName?: string };
  }>;
};

/** Props for `FlightSearchLoading` from results state (optional ±day shift for in-flight overlay). */
export function getFlightSearchLoadingPropsForState(
  state: SearchState,
  dateShiftDays = 0,
) {
  const req = state.lastSearchMeta?.request;
  if (!req?.Segments?.length) return null;

  const shifted =
    dateShiftDays !== 0 ? shiftFlightSearchSegments(req, dateShiftDays) : req;
  const pax = state.passengers;
  const tripType = state.tripType;

  let saved: SavedFlightSearchForm = {};
  try {
    const raw = sessionStorage.getItem(FLIGHT_SEARCH_KEY);
    if (raw) saved = JSON.parse(raw) as SavedFlightSearchForm;
  } catch {
    /* ignore */
  }

  const isMc = tripType === "multicity";
  const mcLegs = saved.multiCityLegs || [];
  const mcFirst = mcLegs[0];
  const mcLast = mcLegs[mcLegs.length - 1];

  const seg0 = shifted.Segments[0];
  const segLast = shifted.Segments[shifted.Segments.length - 1];
  const fromCode = seg0.Origin;
  const toCode = isMc ? segLast.Destination : seg0.Destination;

  const loadingFrom = isMc ? mcFirst?.selectedFrom : saved.selectedFrom;
  const loadingTo = isMc ? mcLast?.selectedTo : saved.selectedTo;
  const loadingFromQuery = isMc ? mcFirst?.fromQuery || "" : saved.fromQuery || "";
  const loadingToQuery = isMc ? mcLast?.toQuery || "" : saved.toQuery || "";

  const airportLabel = (a?: { airportName?: string; airportCode?: string }, fallback = "") => {
    if (a?.airportCode) {
      const name = a.airportName || a.airportCode;
      return `${name} (${a.airportCode})`;
    }
    return fallback;
  };

  const fromLabel =
    airportLabel(loadingFrom, loadingFromQuery) || fromCode || "—";
  const toLabel = airportLabel(loadingTo, loadingToQuery) || toCode || "—";

  return {
    from: loadingFrom?.airportCode || fromCode || "—",
    fromCity: fromLabel,
    to: loadingTo?.airportCode || toCode || "—",
    toCity: toLabel,
    departureDate: isoDepartureToYyyyMmDdUtc(seg0.DepartureDate),
    returnDate:
      shifted.Segments[1] != null
        ? isoDepartureToYyyyMmDdUtc(shifted.Segments[1].DepartureDate)
        : undefined,
    adults: pax.adults,
    children: pax.children,
    infants: pax.infants,
    tripType,
  };
}

/**
 * Calendar YYYY-MM-DD in UTC, matching `new Date("yyyy-mm-dd").toISOString()` from FlightSearch
 * and `formatFlightCalendarDate` (UTC calendar day). Avoids browser-local `getDate()` shifting
 * the label vs API results when the user is not in UTC.
 */
export function isoDepartureToYyyyMmDdUtc(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Deep clone and add `deltaDays` per segment using UTC calendar days (aligned with search payloads). */
export function shiftFlightSearchSegments(req: FlightSearchRequest, deltaDays: number): FlightSearchRequest {
  const next = JSON.parse(JSON.stringify(req)) as FlightSearchRequest;
  for (const seg of next.Segments) {
    const d = new Date(seg.DepartureDate);
    if (isNaN(d.getTime())) continue;
    const utcMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + deltaDays);
    seg.DepartureDate = new Date(utcMs).toISOString();
  }
  return next;
}

/** Mirror `FlightSearch` passenger summary fields after a date shift. */
export function passengersAfterDateShift(
  prevPassengers: Record<string, unknown>,
  shifted: FlightSearchRequest,
): Record<string, unknown> {
  const next = { ...prevPassengers };
  if (shifted.Segments[0]) next.departureDate = isoDepartureToYyyyMmDdUtc(shifted.Segments[0].DepartureDate);
  if (shifted.Segments[1]) next.returnDate = isoDepartureToYyyyMmDdUtc(shifted.Segments[1].DepartureDate);
  const mc = prevPassengers.multiCityLegs;
  if (Array.isArray(mc) && shifted.Segments.length === mc.length) {
    next.multiCityLegs = (mc as { origin: string; destination: string; date: string }[]).map((leg, i) => ({
      ...leg,
      date: isoDepartureToYyyyMmDdUtc(shifted.Segments[i].DepartureDate),
    }));
  }
  return next;
}

/** Keep home-page `FlightSearch` session form dates aligned after ±day search from results. */
export function syncSessionStoredFlightSearchForm(passengers: Record<string, unknown>) {
  try {
    const raw = sessionStorage.getItem(FLIGHT_SEARCH_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    const next: Record<string, unknown> = {
      ...saved,
      departureDate: passengers.departureDate ?? saved.departureDate,
      returnDate: passengers.returnDate ?? saved.returnDate,
    };
    if (Array.isArray(saved.multiCityLegs) && Array.isArray(passengers.multiCityLegs)) {
      next.multiCityLegs = saved.multiCityLegs.map((leg: Record<string, unknown>, i: number) => ({
        ...leg,
        date: (passengers.multiCityLegs as { date?: string }[])?.[i]?.date ?? leg.date,
      }));
    }
    sessionStorage.setItem(FLIGHT_SEARCH_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
