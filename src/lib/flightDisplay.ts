/**
 * `details` from search / fare-quote: outer = journey leg (OB, IB, multicity…),
 * inner = ordered segments (connections). Length − 1 = number of stops.
 */
export function formatConnectionStopsLabel(segmentCount: number): string {
  const n = Math.max(0, Math.floor(segmentCount || 0));
  if (n <= 1) return "Non-stop";
  const stops = n - 1;
  return stops === 1 ? "1 stop" : `${stops} stops`;
}

/** One journey (`details[i]`): ordered connecting segments. Origin/destination are first leg → last leg. */
export function getJourneyEndpoints(journeyLegs: any[] | undefined | null) {
  const legs = Array.isArray(journeyLegs) ? journeyLegs.filter(Boolean) : [];
  if (!legs.length) return null;
  const first = legs[0];
  const last = legs[legs.length - 1];
  const origin = first?.Origin || first?.origin;
  const destination = last?.Destination || last?.destination;
  if (!origin || !destination) return null;
  return {
    legs,
    first,
    last,
    origin,
    destination,
    segmentCount: legs.length,
    stopsLabel: formatConnectionStopsLabel(legs.length),
  };
}

/** Fare-quote payload (e.g. `selectedFlight.fareQuoteData`) → `FlightDetails.Details` matrix, or undefined. */
export function getFlightDetailsFromFareQuoteData(fareQuoteData: any): any[][] | undefined {
  if (!fareQuoteData) return undefined;
  const uq = fareQuoteData.UpdateFareQuote ?? fareQuoteData.updateFareQuote;
  const fqd = uq?.FareQuoteDetails ?? uq?.fareQuoteDetails;
  if (!fqd) return undefined;

  const direct = fqd.FlightDetails?.Details ?? fqd.flightDetails?.details;
  if (Array.isArray(direct) && direct.length > 0) return direct;

  const jl = fqd.JourneyList ?? fqd.journeyList;
  if (jl && typeof jl === "object" && !Array.isArray(jl)) {
    const nested = jl.FlightDetails?.Details ?? jl.flightDetails?.details;
    if (Array.isArray(nested) && nested.length > 0) return nested;
  }
  if (Array.isArray(jl)) {
    const out: any[][] = [];
    for (const j of jl) {
      const nested = j?.FlightDetails?.Details ?? j?.flightDetails?.details;
      if (!Array.isArray(nested)) continue;
      for (const leg of nested) {
        out.push(Array.isArray(leg) ? leg : [leg]);
      }
    }
    return out.length > 0 ? out : undefined;
  }
  return undefined;
}

function firstJourneyFromDetailsMatrix(details: unknown): any[] | undefined {
  if (!Array.isArray(details) || details.length === 0) return undefined;
  const journey = details[0];
  return Array.isArray(journey) && journey.length > 0 ? journey : undefined;
}

/** Advance / price-RBD payload → booking segment matrix (PascalCase, matches fare-quote shape). */
export function journeyDetailsFromPricedSegments(priced: any): any[][] | undefined {
  const journeys = priced?.Segments;
  if (!Array.isArray(journeys) || journeys.length === 0) return undefined;
  const attr = priced?.Attr ?? priced?.attr;
  const mapped = journeys.map((leg: any[]) =>
    (Array.isArray(leg) ? leg : []).map((s: any) => ({
      Origin: {
        AirportCode: s.Origin?.Airport?.AirportCode,
        CityName: s.Origin?.Airport?.CityName,
        DateTime: String(s.Origin?.DepTime || "").replace("T", " "),
      },
      Destination: {
        AirportCode: s.Destination?.Airport?.AirportCode,
        CityName: s.Destination?.Airport?.CityName,
        DateTime: String(s.Destination?.ArrTime || "").replace("T", " "),
      },
      OperatorCode: s.Airline?.AirlineCode,
      OperatorName: s.Airline?.AirlineName,
      FlightNumber: s.Airline?.FlightNumber,
      ...(attr ? { Attr: attr } : {}),
    })),
  );
  return mapped.length > 0 ? mapped : undefined;
}

export function buildFlightDetailsFromPriced(priced: any): { details: any[][] } | undefined {
  const details = journeyDetailsFromPricedSegments(priced);
  if (!details?.length) return undefined;
  return { details };
}

function resolveAdvanceRoundtripLeg(
  storedDetails: unknown,
  priced: any,
  fareQuoteData: any,
): any[] | undefined {
  return (
    firstJourneyFromDetailsMatrix(storedDetails) ||
    firstJourneyFromDetailsMatrix(journeyDetailsFromPricedSegments(priced)) ||
    firstJourneyFromDetailsMatrix(getFlightDetailsFromFareQuoteData(fareQuoteData))
  );
}

/** OB/IB journey matrix for booking UI (matches `FlightBooking` displayFlightDetails). */
export function getBookingDisplayFlightDetails(selectedFlight: unknown): any[][] | undefined {
  if (!selectedFlight || typeof selectedFlight !== "object") return undefined;
  const sf = selectedFlight as Record<string, any>;

  if (sf.advanceRoundtrip === true) {
    const ob = resolveAdvanceRoundtripLeg(
      sf.flightDetails?.details,
      sf.selectedOnward ?? sf.selectedOnwardPriced,
      sf.fareQuoteData,
    );
    const ib = resolveAdvanceRoundtripLeg(
      sf.returnFlightDetails?.details,
      sf.selectedReturn,
      sf.returnFareQuoteData,
    );
    if (ob?.length && ib?.length) return [ob, ib];
  }

  const flightDetails =
    getFlightDetailsFromFareQuoteData(sf.fareQuoteData) ||
    sf.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.FlightDetails?.Details ||
    sf.fareQuoteData?.updateFareQuote?.fareQuoteDetails?.flightDetails?.details ||
    sf.flightDetails?.details ||
    sf.FlightDetails?.Details ||
    sf.flightDetails?.details;

  if (!Array.isArray(flightDetails) || flightDetails.length === 0) return undefined;

  const isType1Roundtrip = !!sf.selectedReturn || sf.advanceRoundtrip === true;
  const isType2RoundtripPaired = sf.isType2Roundtrip === true;

  if (isType1Roundtrip) {
    const returnDetails =
      sf.returnFlightDetails?.details ||
      journeyDetailsFromPricedSegments(sf.selectedReturn) ||
      getFlightDetailsFromFareQuoteData(sf.returnFareQuoteData) ||
      sf.returnFareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.FlightDetails?.Details ||
      sf.returnFareQuoteData?.updateFareQuote?.fareQuoteDetails?.flightDetails?.details ||
      sf.returnFareQuoteData?.FlightDetails?.Details ||
      sf.returnFareQuoteData?.flightDetails?.details ||
      sf.selectedReturn?.FlightDetails?.Details ||
      sf.selectedReturn?.flightDetails?.details;
    const obLeg = flightDetails[0];
    const ibLeg = firstJourneyFromDetailsMatrix(returnDetails);
    if (ibLeg?.length && obLeg) {
      return [obLeg, ibLeg];
    }
    return flightDetails;
  }

  if (isType2RoundtripPaired && flightDetails.length >= 2) {
    return [flightDetails[0], flightDetails[1]];
  }

  return flightDetails;
}

/** `FareQuoteDetails.JourneyList.Price` whether JourneyList is an object or array. */
export function getFareQuoteJourneyPrice(fareQuoteData: any): any | undefined {
  if (!fareQuoteData) return undefined;
  const uq = fareQuoteData.UpdateFareQuote ?? fareQuoteData.updateFareQuote;
  const fqd = uq?.FareQuoteDetails ?? uq?.fareQuoteDetails;
  if (!fqd) return undefined;
  const jl = fqd.JourneyList ?? fqd.journeyList;
  if (!jl) return undefined;
  if (jl.Price) return jl.Price;
  if (Array.isArray(jl)) {
    for (const j of jl) {
      if (j?.Price) return j.Price;
    }
  }
  return undefined;
}

function publishedFareFromPricedLeg(priced: any): number {
  const f = priced?.Fare ?? priced?.fare;
  return Number(f?.PublishedFare ?? f?.publishedFare ?? 0) || 0;
}

/** Base + tax from advance price-RBD / priced leg (`Fare.BaseFare`, `Fare.Tax`, etc.). */
export function fareAmountsFromPricedLeg(priced: any): {
  total: number;
  basic: number;
  tax: number;
} | null {
  const f = priced?.Fare ?? priced?.fare;
  if (!f || typeof f !== "object") return null;
  const basic = Number(
    f.BaseFare ?? f.baseFare ?? f.BasicFare ?? f.basicFare ?? 0,
  );
  const tax = Number(f.Tax ?? f.tax ?? 0);
  const published = Number(f.PublishedFare ?? f.publishedFare ?? 0);
  const total = published > 0 ? published : basic + tax;
  if (basic <= 0 && tax <= 0 && total <= 0) return null;
  return {
    total: total > 0 ? total : basic + tax,
    basic: basic > 0 ? basic : Math.max(0, total - tax),
    tax: tax > 0 ? tax : Math.max(0, total - (basic > 0 ? basic : 0)),
  };
}

function legFareAmounts(priceBlock: any | undefined, pricedLeg: any | undefined) {
  const fromPricedLeg = fareAmountsFromPricedLeg(pricedLeg);
  if (fromPricedLeg) {
    return { ...fromPricedLeg, priceBlock };
  }
  const total = Number(priceBlock?.TotalDisplayFare ?? priceBlock?.totalDisplayFare ?? 0) || 0;
  const basic =
    Number(priceBlock?.PriceBreakup?.BasicFare ?? priceBlock?.priceBreakup?.basicFare ?? 0) ||
    0;
  const tax =
    Number(priceBlock?.PriceBreakup?.Tax ?? priceBlock?.priceBreakup?.tax ?? 0) ||
    Math.max(0, total - basic);
  return { total: total || basic + tax, basic, tax, priceBlock };
}

export type ResolvedBookingFares = {
  onwardPrice: any;
  returnPrice: any | null;
  totalFare: number;
  baseFare: number;
  taxFare: number;
  obBaseFare?: number;
  obTax?: number;
  ibBaseFare?: number;
  ibTax?: number;
};

/** OB/IB (or oneway) fare totals for booking & payment screens. */
export function resolveRoundtripBookingFares(selectedFlight: any): ResolvedBookingFares {
  const sf = selectedFlight ?? {};
  const advance = sf.advanceRoundtrip === true;
  const type1 = !!sf.selectedReturn || advance;
  const type2 = sf.isType2Roundtrip === true;

  const obQuote = getFareQuoteJourneyPrice(sf.fareQuoteData);
  const ibQuote = type1 ? getFareQuoteJourneyPrice(sf.returnFareQuoteData) : undefined;
  const obLeg = legFareAmounts(obQuote, sf.selectedOnward);
  const ibLeg = legFareAmounts(ibQuote, sf.selectedReturn);

  const storedTotal = Number(sf.price?.totalDisplayFare ?? sf.price?.TotalDisplayFare ?? 0);

  if (type1) {
    const obPriced = fareAmountsFromPricedLeg(sf.selectedOnward);
    const ibPriced = fareAmountsFromPricedLeg(sf.selectedReturn);

    const obTotal = advance
      ? (obPriced?.total ?? publishedFareFromPricedLeg(sf.selectedOnward)) || obLeg.total
      : obLeg.total;
    const ibTotal = advance
      ? (ibPriced?.total ?? publishedFareFromPricedLeg(sf.selectedReturn)) || ibLeg.total
      : ibLeg.total;

    const obBasic = obPriced?.basic ?? obLeg.basic;
    const obTax = obPriced?.tax ?? obLeg.tax;
    const ibBasic = ibPriced?.basic ?? ibLeg.basic;
    const ibTax = ibPriced?.tax ?? ibLeg.tax;

    const baseFare = obBasic + ibBasic;
    const taxFare = obTax + ibTax;
    const totalFare =
      storedTotal > 0
        ? storedTotal
        : baseFare + taxFare > 0
          ? baseFare + taxFare
          : obTotal + ibTotal;

    return {
      onwardPrice: obQuote ?? sf.selectedOnward?.Fare ?? sf.price,
      returnPrice: ibQuote ?? sf.selectedReturn?.Fare ?? null,
      totalFare,
      baseFare,
      taxFare,
      ...(advance && {
        obBaseFare: obBasic,
        obTax,
        ibBaseFare: ibBasic,
        ibTax,
      }),
    };
  }

  if (type2) {
    const jl = sf.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.JourneyList;
    const ibFromJl = Array.isArray(jl) ? jl[1]?.Price : undefined;
    const combined = obQuote ?? ibFromJl ?? getFareQuoteJourneyPrice(sf.fareQuoteData);
    const totalFare =
      Number(combined?.TotalDisplayFare ?? combined?.totalDisplayFare ?? 0) || storedTotal;
    const baseFare =
      Number(combined?.PriceBreakup?.BasicFare ?? combined?.priceBreakup?.basicFare ?? 0) || 0;
    return {
      onwardPrice: combined,
      returnPrice: ibFromJl ?? null,
      totalFare,
      baseFare: baseFare || Math.max(0, totalFare * 0.7),
      taxFare: Math.max(0, totalFare - (baseFare || 0)),
    };
  }

  const totalFare = obLeg.total || storedTotal;
  const baseFare = obLeg.basic || Math.max(0, totalFare - obLeg.tax);
  return {
    onwardPrice: obQuote ?? sf.price,
    returnPrice: null,
    totalFare,
    baseFare,
    taxFare: Math.max(0, totalFare - baseFare),
  };
}

/**
 * Formats an airport for result tiles: "City (CODE)" when both are present.
 * Accepts common flight API shapes (Pascal/camel, optional nested `Airport`).
 */
export function formatAirportWithCity(airportLike: any): string {
  if (airportLike == null) return "";
  const code =
    airportLike.AirportCode ??
    airportLike.airportCode ??
    airportLike.Airport?.AirportCode ??
    "";
  const city =
    airportLike.CityName ??
    airportLike.cityName ??
    airportLike.Airport?.CityName ??
    airportLike.Airport?.cityName ??
    airportLike.AirportName ??
    airportLike.airportName ??
    airportLike.Airport?.AirportName ??
    airportLike.Airport?.airportName ??
    "";
  const trimmedCity = typeof city === "string" ? city.trim() : "";
  const trimmedCode = typeof code === "string" ? code.trim() : "";
  if (trimmedCity && trimmedCode) return `${trimmedCity} (${trimmedCode})`;
  return trimmedCode || trimmedCity || "";
}

/** Read terminal from Origin/Destination or nested `airport` (search `segments` shape). */
export function readTerminalFromEndpoint(pt: unknown): string | null {
  if (pt == null || typeof pt !== "object") return null;
  const p = pt as Record<string, unknown>;
  const airport = (p.airport ?? p.Airport) as Record<string, unknown> | undefined;
  const raw = p.Terminal ?? p.terminal ?? airport?.Terminal ?? airport?.terminal;
  const t = String(raw ?? "").trim();
  return t || null;
}

/** API cabin class codes (FlightCabinClass / segment `cabinClass`). */
const CABIN_CLASS_CODE_LABELS: Record<number, string> = {
  2: "Economy",
  3: "Premium Economy",
  4: "Business",
  6: "First",
};

/** Normalize numeric or text cabin class from search / fare-quote segments. */
export function formatCabinClassLabel(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return CABIN_CLASS_CODE_LABELS[raw] ?? null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const asNum = Number(s);
  if (Number.isFinite(asNum) && CABIN_CLASS_CODE_LABELS[asNum]) {
    return CABIN_CLASS_CODE_LABELS[asNum];
  }
  return s;
}

export function formatTerminalLabel(terminal: string): string {
  const t = terminal.trim();
  if (!t) return "";
  if (/^terminal\b/i.test(t)) return t;
  if (/^t[\s.-]*/i.test(t)) return `Terminal ${t.replace(/^t[\s.-]*/i, "")}`;
  return `Terminal ${t}`;
}

function truthyApiFlag(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

/** Read `isHoldAllowed` from update-fare-quote payload (several nesting/casing variants). */
export function readIsHoldAllowedFromFareQuote(fareQuoteData: unknown): boolean | null {
  if (!fareQuoteData || typeof fareQuoteData !== "object") return null;
  const root = fareQuoteData as Record<string, unknown>;

  const fromRecord = (rec: Record<string, unknown> | null | undefined): boolean | null => {
    if (!rec) return null;
    if ("isHoldAllowed" in rec || "IsHoldAllowed" in rec) {
      return truthyApiFlag(rec.isHoldAllowed ?? rec.IsHoldAllowed);
    }
    return null;
  };

  const direct = fromRecord(root);
  if (direct !== null) return direct;

  const uq = (root.UpdateFareQuote ?? root.updateFareQuote) as Record<string, unknown> | undefined;
  const fromUq = fromRecord(uq);
  if (fromUq !== null) return fromUq;

  const fqd = (uq?.FareQuoteDetails ?? uq?.fareQuoteDetails) as Record<string, unknown> | undefined;
  const fromFqd = fromRecord(fqd);
  if (fromFqd !== null) return fromFqd;

  const jl = fqd?.JourneyList ?? fqd?.journeyList;
  if (jl && typeof jl === "object" && !Array.isArray(jl)) {
    const fromJl = fromRecord(jl as Record<string, unknown>);
    if (fromJl !== null) return fromJl;
  }

  return null;
}

/**
 * Whether Hold is offered on booking review — from update-fare-quote `isHoldAllowed`.
 * Roundtrip with separate IB quote requires both legs to allow hold.
 */
/** True when any segment origin/destination country is outside India (ISO not IN). */
export function flightIsInternational(details: any[][] | undefined | null): boolean {
  const allLegs: any[][] = Array.isArray(details) ? details : [];
  for (const leg of allLegs) {
    const segs: any[] = Array.isArray(leg) ? leg : [];
    for (const seg of segs) {
      const o = seg?.Origin || seg?.origin;
      const d = seg?.Destination || seg?.destination;
      const isoFrom = (pt: any) =>
        String(pt?.isoCountryCode ?? pt?.IsoCountryCode ?? pt?.ISOCountryCode ?? "")
          .trim()
          .toUpperCase();
      const oIso = isoFrom(o);
      const dIso = isoFrom(d);
      if (oIso && oIso !== "IN") return true;
      if (dIso && dIso !== "IN") return true;
    }
  }
  return false;
}

function readTruthyLccFlag(raw: unknown): boolean | null {
  if (raw === true || raw === 1 || raw === "1" || raw === "true") return true;
  if (raw === false || raw === 0 || raw === "0" || raw === "false") return false;
  return null;
}

function readIsLccFromRecord(rec: Record<string, unknown> | undefined): boolean | null {
  if (!rec) return null;
  const attr = (rec.Attr ?? rec.attr) as Record<string, unknown> | undefined;
  return (
    readTruthyLccFlag(attr?.IsLCC ?? attr?.isLCC) ??
    readTruthyLccFlag(rec.IsLCC ?? rec.isLCC)
  );
}

/** True when the selected itinerary is operated by a low-cost carrier (LCC). */
export function selectedFlightIsLcc(
  selectedFlight: unknown,
  flightDetails?: unknown[][] | null,
): boolean {
  if (selectedFlight && typeof selectedFlight === "object") {
    const sf = selectedFlight as Record<string, unknown>;
    const fromRoot = readIsLccFromRecord(sf);
    if (fromRoot === true) return true;
    if (fromRoot === false) return false;

    const obFq = sf.fareQuoteData;
    const ibFq = sf.returnFareQuoteData;
    for (const fq of [obFq, ibFq]) {
      if (!fq || typeof fq !== "object") continue;
      const uq = (fq as Record<string, unknown>).UpdateFareQuote ?? (fq as Record<string, unknown>).updateFareQuote;
      const fqd =
        (uq as Record<string, unknown> | undefined)?.FareQuoteDetails ??
        (uq as Record<string, unknown> | undefined)?.fareQuoteDetails;
      const fromFq = readIsLccFromRecord(fqd as Record<string, unknown> | undefined);
      if (fromFq === true) return true;
    }
  }

  const legs: unknown[][] = Array.isArray(flightDetails) ? flightDetails : [];
  for (const leg of legs) {
    if (!Array.isArray(leg)) continue;
    for (const seg of leg) {
      if (!seg || typeof seg !== "object") continue;
      if (readIsLccFromRecord(seg as Record<string, unknown>) === true) return true;
    }
  }
  return false;
}

export function isHoldAllowedForSelectedFlight(selectedFlight: unknown): boolean {
  if (!selectedFlight || typeof selectedFlight !== "object") return false;
  const sf = selectedFlight as Record<string, unknown>;

  const ob = readIsHoldAllowedFromFareQuote(sf.fareQuoteData);
  const ib = readIsHoldAllowedFromFareQuote(sf.returnFareQuoteData);

  if (ib !== null) return ob === true && ib === true;
  return ob === true;
}
