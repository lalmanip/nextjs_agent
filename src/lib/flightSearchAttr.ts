import { formatCabinClassLabel, readTerminalFromEndpoint } from "@/lib/flightDisplay";

/** Search-result `Attr` / `segments` helpers (baggage, mini fare rules). */

export type SectorBaggageRow = {
  sector: string;
  value: string;
};

export type MiniFareRuleRow = {
  journeyPoints: string;
  type: string;
  from: string;
  to: string;
  unit: string;
  details: string;
};

function readAttr(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return {};
  const o = obj as Record<string, unknown>;
  return (o.Attr ?? o.attr ?? {}) as Record<string, unknown>;
}

/** `segments` / `Segments` on search result (array of journey legs, each leg = segment[]). */
export function segmentsFromVariant(variant: unknown): unknown[][] {
  if (!variant || typeof variant !== "object") return [];
  const v = variant as Record<string, unknown>;
  const raw = v.segments ?? v.Segments;
  if (!Array.isArray(raw)) return [];
  return raw.map((leg) => (Array.isArray(leg) ? leg : []));
}

function sectorLabelFromFlightDetailsSegment(seg: unknown): string {
  if (!seg || typeof seg !== "object") return "—";
  const s = seg as Record<string, unknown>;
  const origin = s.Origin ?? s.origin;
  const dest = s.Destination ?? s.destination;
  const oCode =
    (origin as Record<string, unknown> | undefined)?.AirportCode ??
    (origin as Record<string, unknown> | undefined)?.airportCode;
  const dCode =
    (dest as Record<string, unknown> | undefined)?.AirportCode ??
    (dest as Record<string, unknown> | undefined)?.airportCode;
  if (oCode && dCode) return `${String(oCode)}-${String(dCode)}`;
  return "—";
}

/** Sector label from search `segments` node (camelCase or PascalCase). */
function sectorLabelFromSearchSegment(seg: unknown): string {
  if (!seg || typeof seg !== "object") return "—";
  const s = seg as Record<string, unknown>;

  const origin = s.origin ?? s.Origin;
  const dest = s.destination ?? s.Destination;
  if (origin && dest && typeof origin === "object" && typeof dest === "object") {
    const o = origin as Record<string, unknown>;
    const d = dest as Record<string, unknown>;
    const oAp = (o.airport ?? o.Airport) as Record<string, unknown> | undefined;
    const dAp = (d.airport ?? d.Airport) as Record<string, unknown> | undefined;
    const oCode =
      oAp?.airportCode ??
      oAp?.AirportCode ??
      o.airportCode ??
      o.AirportCode;
    const dCode =
      dAp?.airportCode ??
      dAp?.AirportCode ??
      d.airportCode ??
      d.AirportCode;
    if (oCode && dCode) return `${String(oCode)}-${String(dCode)}`;
  }

  return sectorLabelFromFlightDetailsSegment(seg);
}

function baggageFromSearchSegment(seg: unknown, kind: "cabin" | "checkin"): string {
  if (!seg || typeof seg !== "object") return "";
  const s = seg as Record<string, unknown>;
  const raw =
    kind === "cabin"
      ? s.cabinBaggage ?? s.CabinBaggage
      : s.baggage ?? s.Baggage;
  return raw != null && String(raw).trim() !== "" ? String(raw).trim() : "";
}

function flightDetailsFromVariant(variant: unknown): unknown[][] | undefined {
  if (!variant || typeof variant !== "object") return undefined;
  const v = variant as Record<string, unknown>;
  const fd = v.FlightDetails ?? v.flightDetails;
  if (!fd || typeof fd !== "object") return undefined;
  const details = (fd as Record<string, unknown>).Details ?? (fd as Record<string, unknown>).details;
  return Array.isArray(details) ? (details as unknown[][]) : undefined;
}

function rowsFromSearchSegments(
  variant: unknown,
  kind: "cabin" | "checkin",
  fallback: unknown,
): SectorBaggageRow[] {
  const fb =
    fallback != null && String(fallback).trim() !== "" ? String(fallback).trim() : "";
  const rows: SectorBaggageRow[] = [];
  const segmentLegs = segmentsFromVariant(variant);

  for (const journey of segmentLegs) {
    for (const seg of journey) {
      const value = baggageFromSearchSegment(seg, kind) || fb;
      rows.push({
        sector: sectorLabelFromSearchSegment(seg),
        value: value || "Not specified",
      });
    }
  }

  return rows;
}

function rowsFromFlightDetails(
  variant: unknown,
  kind: "cabin" | "checkin",
  fallback: unknown,
): SectorBaggageRow[] {
  const fb =
    fallback != null && String(fallback).trim() !== "" ? String(fallback).trim() : "";
  const rows: SectorBaggageRow[] = [];
  const details = flightDetailsFromVariant(variant);

  if (Array.isArray(details)) {
    for (const journey of details) {
      if (!Array.isArray(journey)) continue;
      for (const seg of journey) {
        const attr = readAttr(seg);
        const raw =
          kind === "cabin"
            ? attr.CabinBaggage ?? attr.cabinBaggage ?? fb
            : attr.Baggage ?? attr.baggage ?? fb;
        const value = raw != null && String(raw).trim() !== "" ? String(raw).trim() : "";
        rows.push({
          sector: sectorLabelFromFlightDetailsSegment(seg),
          value: value || "Not specified",
        });
      }
    }
  }

  return rows;
}

/** Sector-wise cabin or check-in baggage (per passenger) from search `segments`, then fallbacks. */
export function getSectorBaggageRows(
  variant: unknown,
  kind: "cabin" | "checkin",
): SectorBaggageRow[] {
  const variantAttr = readAttr(variant);
  const fallback =
    kind === "cabin"
      ? variantAttr.CabinBaggage ?? variantAttr.cabinBaggage
      : variantAttr.Baggage ?? variantAttr.baggage;

  let rows = rowsFromSearchSegments(variant, kind, fallback);

  if (rows.length === 0) {
    rows = rowsFromFlightDetails(variant, kind, fallback);
  }

  if (rows.length === 0) {
    const fb =
      fallback != null && String(fallback).trim() !== "" ? String(fallback).trim() : "";
    rows.push({
      sector: "All sectors",
      value: fb || "Not specified",
    });
  }

  return rows;
}

export function variantHasSectorBaggage(variant: unknown, kind: "cabin" | "checkin"): boolean {
  const rows = getSectorBaggageRows(variant, kind);
  return rows.some((r) => r.value !== "Not specified");
}

function seatCountFromSegment(seg: unknown): number | null {
  if (!seg || typeof seg !== "object") return null;
  const s = seg as Record<string, unknown>;
  const attr = readAttr(seg);
  const raw =
    s.noOfSeatAvailable ??
    s.NoOfSeatAvailable ??
    s.noOfSeatsAvailable ??
    s.availableSeats ??
    s.AvailableSeats ??
    attr.AvailableSeats ??
    attr.availableSeats;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function minSeatCountInSegments(segments: unknown[]): number | null {
  let min: number | null = null;
  for (const seg of segments) {
    const n = seatCountFromSegment(seg);
    if (n == null) continue;
    min = min == null ? n : Math.min(min, n);
  }
  return min;
}

/** Minimum `noOfSeatAvailable` across segments in a journey (connecting flights use lowest). */
export function getSeatsAvailableForJourney(
  variant: unknown,
  journeyIndex = 0,
): number | null {
  const legs = segmentsFromVariant(variant);
  const journey = legs[journeyIndex];
  if (journey?.length) {
    const fromSegments = minSeatCountInSegments(journey);
    if (fromSegments != null) return fromSegments;
  }

  const details = flightDetailsFromVariant(variant);
  const fdJourney = details?.[journeyIndex];
  if (Array.isArray(fdJourney) && fdJourney.length) {
    const fromDetails = minSeatCountInSegments(fdJourney);
    if (fromDetails != null) return fromDetails;
  }

  const attr = readAttr(variant);
  const fallback = attr.AvailableSeats ?? attr.availableSeats;
  const n = Number(fallback);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function formatSeatsAvailableLabel(count: number): string {
  return count === 1 ? "1 seat left" : `${count} seat(s) left`;
}

function terminalFromSearchSegment(seg: unknown, which: "origin" | "destination"): string | null {
  if (!seg || typeof seg !== "object") return null;
  const s = seg as Record<string, unknown>;
  const pt = s[which] ?? s[which === "origin" ? "Origin" : "Destination"];
  return readTerminalFromEndpoint(pt);
}

/** Departure / arrival terminal for a journey from `segments`, then `FlightDetails`. */
export function getJourneyEndpointTerminals(
  variant: unknown,
  journeyIndex = 0,
): { departureTerminal: string | null; arrivalTerminal: string | null } {
  const legs = segmentsFromVariant(variant);
  const journey = legs[journeyIndex];
  if (journey?.length) {
    const first = journey[0];
    const last = journey[journey.length - 1];
    return {
      departureTerminal: terminalFromSearchSegment(first, "origin"),
      arrivalTerminal: terminalFromSearchSegment(last, "destination"),
    };
  }

  const details = flightDetailsFromVariant(variant);
  const fdJourney = details?.[journeyIndex];
  if (Array.isArray(fdJourney) && fdJourney.length) {
    const first = fdJourney[0] as Record<string, unknown>;
    const last = fdJourney[fdJourney.length - 1] as Record<string, unknown>;
    return {
      departureTerminal: readTerminalFromEndpoint(first?.Origin ?? first?.origin),
      arrivalTerminal: readTerminalFromEndpoint(last?.Destination ?? last?.destination),
    };
  }

  return { departureTerminal: null, arrivalTerminal: null };
}

function cabinClassFromSearchSegment(seg: unknown): string | null {
  if (!seg || typeof seg !== "object") return null;
  const s = seg as Record<string, unknown>;
  return formatCabinClassLabel(s.cabinClass ?? s.CabinClass);
}

function cabinClassFromFlightDetailsSegment(seg: unknown): string | null {
  if (!seg || typeof seg !== "object") return null;
  const s = seg as Record<string, unknown>;
  const attr = readAttr(seg);
  return formatCabinClassLabel(
    s.CabinClass ?? s.cabinClass ?? attr.CabinClass ?? attr.cabinClass,
  );
}

/** Cabin class label for a journey (first segment), from `segments` then `FlightDetails`. */
export function getJourneyCabinClassLabel(
  variant: unknown,
  journeyIndex = 0,
): string | null {
  const legs = segmentsFromVariant(variant);
  const journey = legs[journeyIndex];
  if (journey?.length) {
    for (const seg of journey) {
      const label = cabinClassFromSearchSegment(seg);
      if (label) return label;
    }
  }

  const details = flightDetailsFromVariant(variant);
  const fdJourney = details?.[journeyIndex];
  if (Array.isArray(fdJourney) && fdJourney.length) {
    for (const seg of fdJourney) {
      const label = cabinClassFromFlightDetailsSegment(seg);
      if (label) return label;
    }
  }

  const attr = readAttr(variant);
  return formatCabinClassLabel(attr.CabinClass ?? attr.cabinClass);
}

function fareClassFromSearchSegment(seg: unknown): string | null {
  if (!seg || typeof seg !== "object") return null;
  const s = seg as Record<string, unknown>;
  const airline = (s.airline ?? s.Airline) as Record<string, unknown> | undefined;
  const raw =
    s.fareClass ??
    s.FareClass ??
    airline?.fareClass ??
    airline?.FareClass;
  const t = String(raw ?? "").trim();
  return t || null;
}

function fareClassFromFlightDetailsSegment(seg: unknown): string | null {
  if (!seg || typeof seg !== "object") return null;
  const s = seg as Record<string, unknown>;
  const attr = readAttr(seg);
  const raw =
    s.FareClass ??
    s.fareClass ??
    s.bookingClass ??
    s.BookingClass ??
    attr.FareClass ??
    attr.fareClass ??
    attr.BookingClass ??
    attr.bookingClass;
  const t = String(raw ?? "").trim();
  return t || null;
}

/** Booking fare class for a journey (e.g. `K`), from `segments.airline.fareClass` then `FlightDetails`. */
export function getJourneyFareClassLabel(
  variant: unknown,
  journeyIndex = 0,
): string | null {
  const legs = segmentsFromVariant(variant);
  const journey = legs[journeyIndex];
  if (journey?.length) {
    for (const seg of journey) {
      const label = fareClassFromSearchSegment(seg);
      if (label) return label;
    }
  }

  const details = flightDetailsFromVariant(variant);
  const fdJourney = details?.[journeyIndex];
  if (Array.isArray(fdJourney) && fdJourney.length) {
    for (const seg of fdJourney) {
      const label = fareClassFromFlightDetailsSegment(seg);
      if (label) return label;
    }
  }

  const attr = readAttr(variant);
  const t = String(
    attr.FareClass ??
      attr.fareClass ??
      attr.BookingClass ??
      attr.bookingClass ??
      "",
  ).trim();
  return t || null;
}

function normalizeMiniFareRule(raw: unknown): MiniFareRuleRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const journeyPoints = String(r.JourneyPoints ?? r.journeyPoints ?? "").trim();
  const type = String(r.Type ?? r.type ?? "").trim();
  const details = String(r.Details ?? r.details ?? "").trim();
  if (!journeyPoints && !type && !details) return null;
  return {
    journeyPoints: journeyPoints || "—",
    type: type || "—",
    from: String(r.From ?? r.from ?? "").trim(),
    to: String(r.To ?? r.to ?? "").trim(),
    unit: String(r.Unit ?? r.unit ?? "DAYS").trim() || "DAYS",
    details: details || "—",
  };
}

/** `MiniFareRules` from variant `Attr` — array of per-journey rule lists. */
export function getMiniFareRulesByJourney(variant: unknown): MiniFareRuleRow[][] {
  const attr = readAttr(variant);
  const raw = attr.MiniFareRules ?? attr.miniFareRules;
  if (!Array.isArray(raw)) return [];
  return raw.map((leg) => {
    if (!Array.isArray(leg)) return [];
    return leg.map(normalizeMiniFareRule).filter((x): x is MiniFareRuleRow => x != null);
  });
}

export function variantHasMiniFareRules(variant: unknown): boolean {
  return getMiniFareRulesByJourney(variant).some((leg) => leg.length > 0);
}

export function formatMiniFareRuleWindow(from: string, to: string, unit: string): string {
  const f = String(from ?? "").trim();
  const t = String(to ?? "").trim();
  const u = String(unit ?? "DAYS").trim() || "DAYS";
  if (f && t) return `from ${f} To ${t} ${u} before dept`;
  if (f) return `from ${f} ${u} & above before dept`;
  return "";
}

/** Group rules by sector for Cancellation / Reissue columns. */
export function groupMiniFareRulesForDisplay(rulesByJourney: MiniFareRuleRow[][]): {
  sector: string;
  cancellation: MiniFareRuleRow[];
  reissue: MiniFareRuleRow[];
}[] {
  const map = new Map<string, { cancellation: MiniFareRuleRow[]; reissue: MiniFareRuleRow[] }>();

  for (const leg of rulesByJourney) {
    for (const rule of leg) {
      const sector = rule.journeyPoints || "—";
      if (!map.has(sector)) map.set(sector, { cancellation: [], reissue: [] });
      const bucket = map.get(sector)!;
      const t = rule.type.toLowerCase();
      if (t.includes("cancel")) bucket.cancellation.push(rule);
      else if (t.includes("reissue") || t.includes("change")) bucket.reissue.push(rule);
      else bucket.cancellation.push(rule);
    }
  }

  return Array.from(map.entries()).map(([sector, v]) => ({
    sector,
    cancellation: v.cancellation,
    reissue: v.reissue,
  }));
}
