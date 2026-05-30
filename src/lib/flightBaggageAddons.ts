import { flightDetailsIsAirAsiaIndia } from "@/lib/airAsiaIndiaRules";
import {
  flightIsInternational,
  selectedFlightIsLcc,
} from "@/lib/flightDisplay";

export type FareQuoteLegAncillaries = { baggage: unknown[]; meal: unknown[] };

export type FareQuoteAncillaryOptions = {
  ob: FareQuoteLegAncillaries;
  ib: FareQuoteLegAncillaries;
};

/** @deprecated Use {@link FareQuoteAncillaryOptions} */
export type FareQuoteBaggageOptions = { ob: unknown[]; ib: unknown[] };

type PassengerAncillaryRow = {
  type?: string;
  obBaggage?: unknown;
  ibBaggage?: unknown;
  obMeal?: unknown;
  ibMeal?: unknown;
};

function readAncillaryListFromFareQuote(
  fareQuoteData: unknown,
  key: "baggage" | "meal",
): unknown[] {
  if (!fareQuoteData || typeof fareQuoteData !== "object") return [];
  const fq = fareQuoteData as Record<string, unknown>;
  const uq = fq.UpdateFareQuote ?? fq.updateFareQuote;
  const fqd =
    (uq as Record<string, unknown> | undefined)?.FareQuoteDetails ??
    (uq as Record<string, unknown> | undefined)?.fareQuoteDetails;
  if (!fqd || typeof fqd !== "object") return [];
  const fd = fqd as Record<string, unknown>;
  const raw =
    key === "baggage"
      ? fd.baggage ?? fd.Baggage
      : fd.mealDynamic ?? fd.MealDynamic;
  const first = Array.isArray(raw) ? raw[0] : undefined;
  return Array.isArray(first) ? first : [];
}

/** Read ancillary baggage list from a fare-quote / SSR payload (OB or IB). */
export function readBaggageOptionsFromFareQuote(fareQuoteData: unknown): unknown[] {
  return readAncillaryListFromFareQuote(fareQuoteData, "baggage");
}

/** Read ancillary meal list from a fare-quote / SSR payload (OB or IB). */
export function readMealOptionsFromFareQuote(fareQuoteData: unknown): unknown[] {
  return readAncillaryListFromFareQuote(fareQuoteData, "meal");
}

export function getFareQuoteAncillaryOptions(selectedFlight: unknown): FareQuoteAncillaryOptions {
  if (!selectedFlight || typeof selectedFlight !== "object") {
    return {
      ob: { baggage: [], meal: [] },
      ib: { baggage: [], meal: [] },
    };
  }
  const sf = selectedFlight as Record<string, unknown>;
  return {
    ob: {
      baggage: readBaggageOptionsFromFareQuote(sf.fareQuoteData),
      meal: readMealOptionsFromFareQuote(sf.fareQuoteData),
    },
    ib: {
      baggage: readBaggageOptionsFromFareQuote(sf.returnFareQuoteData),
      meal: readMealOptionsFromFareQuote(sf.returnFareQuoteData),
    },
  };
}

export function getFareQuoteBaggageOptions(selectedFlight: unknown): FareQuoteBaggageOptions {
  const opts = getFareQuoteAncillaryOptions(selectedFlight);
  return { ob: opts.ob.baggage, ib: opts.ib.baggage };
}

export function readAncillaryOptionPrice(item: unknown): number {
  if (!item || typeof item !== "object") return NaN;
  const b = item as Record<string, unknown>;
  const raw = b.Price ?? b.price ?? b.Amount ?? b.amount;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

/** @deprecated Use {@link readAncillaryOptionPrice} */
export const readBaggageOptionPrice = readAncillaryOptionPrice;

export function readAncillaryOptionCode(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const b = item as Record<string, unknown>;
  return String(b.Code ?? b.code ?? "").trim();
}

/** @deprecated Use {@link readAncillaryOptionCode} */
export const readBaggageOptionCode = readAncillaryOptionCode;

function isExcludedAncillaryCode(code: string, kind: "baggage" | "meal"): boolean {
  if (!code) return true;
  const lower = code.toLowerCase();
  if (kind === "baggage") return lower === "nobaggage";
  return lower === "nomeal";
}

/** First ancillary baggage with price 0 (excludes `NoBaggage` / empty code). */
export function findFirstFreeBaggageOption(options: unknown[]): unknown | null {
  if (!Array.isArray(options)) return null;
  for (const bag of options) {
    const code = readAncillaryOptionCode(bag);
    if (isExcludedAncillaryCode(code, "baggage")) continue;
    if (readAncillaryOptionPrice(bag) === 0) return bag;
  }
  return null;
}

/** First ancillary meal with price 0 (excludes `NoMeal` / empty code). */
export function findFirstFreeMealOption(options: unknown[]): unknown | null {
  if (!Array.isArray(options)) return null;
  for (const meal of options) {
    const code = readAncillaryOptionCode(meal);
    if (isExcludedAncillaryCode(code, "meal")) continue;
    if (readAncillaryOptionPrice(meal) === 0) return meal;
  }
  return null;
}

export function shouldAutoSelectIntlLccFreeBaggage(
  selectedFlight: unknown,
  itineraryDetails: unknown[][] | null | undefined,
): boolean {
  return (
    selectedFlightIsLcc(selectedFlight, itineraryDetails) &&
    flightIsInternational(itineraryDetails)
  );
}

/** Domestic AirAsia India (I5): auto-select free baggage and meal from SSR/fare-quote. */
export function shouldAutoSelectDomesticI5FreeAncillaries(
  itineraryDetails: unknown[][] | null | undefined,
): boolean {
  return (
    !flightIsInternational(itineraryDetails) && flightDetailsIsAirAsiaIndia(itineraryDetails)
  );
}

/**
 * Pre-select free ancillaries when applicable:
 * - International LCC: first free baggage per leg
 * - Domestic I5: first free baggage and meal per leg
 * Only fills empty selections; user can change in add-ons UI.
 */
export function applyDefaultFreeAncillariesToPassengers<T extends PassengerAncillaryRow>(
  passengers: T[],
  selectedFlight: unknown,
  itineraryDetails?: unknown[][] | null,
  ancillaryOptions?: FareQuoteAncillaryOptions,
): T[] {
  const intlLccBaggage = shouldAutoSelectIntlLccFreeBaggage(selectedFlight, itineraryDetails);
  const domesticI5 = shouldAutoSelectDomesticI5FreeAncillaries(itineraryDetails);
  if (!intlLccBaggage && !domesticI5) return passengers;

  const opts = ancillaryOptions ?? getFareQuoteAncillaryOptions(selectedFlight);
  const freeObBag =
    intlLccBaggage || domesticI5 ? findFirstFreeBaggageOption(opts.ob.baggage) : null;
  const freeIbBag =
    intlLccBaggage || domesticI5 ? findFirstFreeBaggageOption(opts.ib.baggage) : null;
  const freeObMeal = domesticI5 ? findFirstFreeMealOption(opts.ob.meal) : null;
  const freeIbMeal = domesticI5 ? findFirstFreeMealOption(opts.ib.meal) : null;

  if (!freeObBag && !freeIbBag && !freeObMeal && !freeIbMeal) return passengers;

  let changed = false;
  const next = passengers.map((pax) => {
    if (pax.type === "Infant") return pax;
    const patch: Partial<T> = {};
    if (freeObBag && !pax.obBaggage) {
      patch.obBaggage = freeObBag as T["obBaggage"];
      changed = true;
    }
    if (freeIbBag && !pax.ibBaggage) {
      patch.ibBaggage = freeIbBag as T["ibBaggage"];
      changed = true;
    }
    if (freeObMeal && !pax.obMeal) {
      patch.obMeal = freeObMeal as T["obMeal"];
      changed = true;
    }
    if (freeIbMeal && !pax.ibMeal) {
      patch.ibMeal = freeIbMeal as T["ibMeal"];
      changed = true;
    }
    if (!Object.keys(patch).length) return pax;
    return { ...pax, ...patch };
  });

  return changed ? next : passengers;
}

/** @deprecated Use {@link applyDefaultFreeAncillariesToPassengers} */
export function applyDefaultFreeBaggageToPassengers<T extends PassengerAncillaryRow>(
  passengers: T[],
  selectedFlight: unknown,
  itineraryDetails?: unknown[][] | null,
  baggageOptions?: FareQuoteBaggageOptions,
): T[] {
  const ancillaryOptions: FareQuoteAncillaryOptions | undefined = baggageOptions
    ? {
        ob: { baggage: baggageOptions.ob, meal: [] },
        ib: { baggage: baggageOptions.ib, meal: [] },
      }
    : undefined;
  return applyDefaultFreeAncillariesToPassengers(
    passengers,
    selectedFlight,
    itineraryDetails,
    ancillaryOptions,
  );
}
