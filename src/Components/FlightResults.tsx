"use client";
import { useState, useEffect } from "react";
import { flightAPI } from "@/lib/api";
import { formatAirportWithCity, formatTerminalLabel, getJourneyEndpoints } from "@/lib/flightDisplay";
import { formatFlightCalendarDate } from "@/lib/formatFlightCalendarDate";
import { formatUserDate } from "@/lib/dateLocale";
import FlightSegmentPopup from "./FlightSegmentPopup";
import { VariantFareOptionRow } from "./FlightVariantFareIcons";
import FlightSeatsAvailableHint from "./FlightSeatsAvailableHint";
import FlightAirportDisplay from "./FlightAirportDisplay";
import {
  getJourneyCabinClassLabel,
  getJourneyEndpointTerminals,
  getJourneyFareClassLabel,
} from "@/lib/flightSearchAttr";
import FlightAirlineInfoBlock from "./FlightAirlineInfoBlock";
import {
  CabinBaggageModal,
  CheckinBaggageModal,
  FareRulesModal,
} from "./FlightFareInfoModals";
import { isFlightHoldFeatureEnabled } from "@/lib/flightHoldConfig";

const OG = "#FC6603";

interface FlightResultsProps {
  results: any;
  onBack: () => void;
  passengers?: { adults: number; children: number; infants: number; cabinClass?: string; departureDate?: string; returnDate?: string; origin?: string; destination?: string; multiCityLegs?: Array<{ origin: string; destination: string; date: string }> };
  domainToken?: string;
  tripType?: string;
  onSelectFlight: (flight: any) => void;
  onDateShift?: (deltaDays: number) => void | Promise<void>;
  dateShiftLoading?: boolean;
}

function Chk({ on }: { on: boolean }) {
  return (
    <span style={{ display:"inline-flex", width:15, height:15, borderRadius:3, border:`2px solid ${on ? OG : "#d1d5db"}`, background: on ? OG : "white", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      {on && <span style={{ color:"white", fontSize:9, fontWeight:700, lineHeight:1 }}>✓</span>}
    </span>
  );
}

function getVariantFareInclusions(variant: any): string[] {
  const attr = variant?.Attr || variant?.attr || {};
  const raw = attr.fareInclusions ?? attr.FareInclusions;
  return Array.isArray(raw) ? raw.map((x: any) => String(x).trim()).filter(Boolean) : [];
}

function getVariantFareClassificationMeta(variant: any): { type: string; color?: string } {
  const attr = variant?.Attr || variant?.attr || {};
  const fc =
    variant?.fareClassification ||
    variant?.FareClassification ||
    attr.fareClassification ||
    attr.FareClassification ||
    {};
  const type =
    String(fc.type || fc.Type || attr.supplierFareClass || attr.SupplierFareClass || "").trim() || "Fare";
  const colorRaw = String(fc.color || fc.Color || "").trim();
  return { type, color: colorRaw || undefined };
}

function getVariantFareLabel(variant: any): string {
  const sfc: string = variant?.Attr?.supplierFareClass || variant?.Attr?.SupplierFareClass || "";
  const fc = variant?.fareClassification || variant?.FareClassification;
  return sfc?.includes("NDC") ? "NDC" : sfc || fc?.type || "Standard";
}

type FareInfoModalState =
  | { kind: "cabin"; variant: unknown; fareLabel: string }
  | { kind: "checkin"; variant: unknown; fareLabel: string }
  | { kind: "fareRules"; variant: unknown; fareLabel: string }
  | null;

function getVariantPublishAndOfferFare(variant: any): { publish: number | null; offer: number | null; currency: string } {
  const p = variant?.Price || variant?.price || {};
  const offer = Number(p.TotalDisplayFare ?? p.totalDisplayFare ?? NaN);
  const publish = Number(
    p.PublishedFare ??
      p.publishedFare ??
      p.PublishFare ??
      p.publishFare ??
      p.OfferedFare ??
      p.offeredFare ??
      NaN,
  );
  const currency = String(p.Currency ?? p.currency ?? "INR");
  return {
    publish: Number.isFinite(publish) && publish > 0 ? publish : null,
    offer: Number.isFinite(offer) && offer > 0 ? offer : null,
    currency,
  };
}

function variantsHaveFareInclusionsData(variants: any[]): boolean {
  return variants.some((v) => {
    if (getVariantFareInclusions(v).length > 0) return true;
    const attr = v?.Attr || v?.attr || {};
    const fc = v?.fareClassification || v?.FareClassification || attr.fareClassification || attr.FareClassification;
    return !!(fc && (fc.type || fc.Type || fc.color || fc.Color));
  });
}

function FareInclusionsExpandable({
  variants,
  selectedToken,
  onPickVariant,
  expanded,
  onToggle,
  primaryColor = OG,
}: {
  variants: any[];
  selectedToken: string;
  onPickVariant: (variant: any) => void;
  expanded: boolean;
  onToggle: () => void;
  primaryColor?: string;
}) {
  if (!variantsHaveFareInclusionsData(variants)) return null;

  return (
    <div className="border-t border-gray-200 bg-gray-50/90 px-2 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-end gap-1.5 w-full text-xs font-semibold text-gray-700 hover:text-gray-900 py-1 pr-0.5"
      >
        <span>Fare Inclusions</span>
        <span className="text-[10px] text-gray-500" aria-hidden>
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && (
        <div className="relative mt-1">
          <div className="flex gap-3 overflow-x-auto pb-2 pt-1 snap-x snap-mandatory">
            {variants.map((variant) => {
              const token = variant.ResultToken || variant.resultToken;
              const isSel = token === selectedToken;
              const inc = getVariantFareInclusions(variant);
              const fc = getVariantFareClassificationMeta(variant);
              const { publish, offer, currency } = getVariantPublishAndOfferFare(variant);
              const sym = currency === "INR" ? "₹" : `${currency} `;
              return (
                <div
                  key={token}
                  role="button"
                  tabIndex={0}
                  onClick={() => onPickVariant(variant)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPickVariant(variant);
                    }
                  }}
                  className={`flex-shrink-0 w-[220px] sm:w-[248px] snap-start rounded-lg border-2 bg-white shadow-sm overflow-hidden cursor-pointer transition-colors ${
                    isSel ? "border-blue-900 ring-1 ring-blue-400/40" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div
                    className="flex items-center gap-2 px-2 py-2 border-b border-black/10 min-h-[40px]"
                    style={{ backgroundColor: fc.color || "#e5e7eb" }}
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center bg-white/90"
                      style={{ borderColor: isSel ? primaryColor : "#9ca3af" }}
                    >
                      {isSel && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />}
                    </div>
                    <span className="text-[11px] font-bold text-gray-900 leading-tight">{fc.type}</span>
                  </div>
                  <div className="p-2 space-y-1 text-[10px] text-gray-700">
                    {publish != null && (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-500">Publish Fare</span>
                        <span className="font-semibold tabular-nums">
                          {sym}
                          {publish.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {offer != null && (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-500">Offer Fare</span>
                        <span className="font-semibold tabular-nums" style={{ color: primaryColor }}>
                          {sym}
                          {offer.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {inc.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                        {inc.map((line, i) => (
                          <li key={i} className="flex gap-1.5 leading-snug">
                            <span className="text-green-600 flex-shrink-0 font-bold">✓</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FlightResults({
  results,
  onBack,
  passengers,
  domainToken,
  tripType,
  onSelectFlight,
  onDateShift,
  dateShiftLoading,
}: FlightResultsProps) {
  console.log("FlightResults - Full results:", JSON.stringify(results, null, 2));

  // Determine if roundtrip
  const journeyList = results?.search?.flightDataList?.journeyList || results?.Search?.FlightDataList?.JourneyList || [];
  
  // Type 1: journeyList has 2 elements [0] and [1] - OB and IB are separate
  const isType1Roundtrip = journeyList.length > 1;
  
  // Type 2: journeyList has 1 element [0] AND tripType implies roundtrip - OB and IB are paired
  const isType2RoundtripPaired =
    journeyList.length === 1 && (tripType === "roundtrip" || tripType === "specialreturn");
  
  // Overall roundtrip flag for logic that doesn't differentiate between types
  const isRoundtrip = isType1Roundtrip || isType2RoundtripPaired;
  /** FareCombinationId pairing (OB then matching IB) applies only to Special Return, not regular Round Trip. */
  const isSpecialReturn = tripType === "specialreturn";

  const onwardFlights = journeyList[0] || [];
  const returnFlights = journeyList[1] || [];

  console.log("\n========== FLIGHT RESULTS DEBUG ==========");
  console.log("Trip Type:", tripType);
  console.log("Journey List Length:", journeyList.length);
  console.log("Is Type 1 Roundtrip (separate):", isType1Roundtrip);
  console.log("Is Type 2 Roundtrip Paired:", isType2RoundtripPaired);
  console.log("Is Roundtrip (either type):", isRoundtrip);
  console.log("Onward flights available:", onwardFlights.length);
  console.log("Return flights available:", returnFlights.length);
  console.log("=========================================\n");

  // State for roundtrip selection
  const [selectedOnwardIndex, setSelectedOnwardIndex] = useState<number | null>(null);
  const [selectedReturnIndex, setSelectedReturnIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [holdingRoundtrip, setHoldingRoundtrip] = useState(false);
  const [loadingFlightIndex, setLoadingFlightIndex] = useState<number | null>(null);
  const [holdingFlightIndex, setHoldingFlightIndex] = useState<number | null>(null);

  // Price-change modal
  interface PriceChange { label: string; oldPrice: number; newPrice: number }
  const [priceChangeInfo, setPriceChangeInfo] = useState<{
    changes: PriceChange[];
    onConfirm: () => void;
  } | null>(null);

  const extractNewPrice = (res: any): number =>
    res?.UpdateFareQuote?.FareQuoteDetails?.JourneyList?.Price?.TotalDisplayFare || 0;

  const isPriceChanged = (res: any): boolean =>
    !!(res?.isPriceChanged || res?.IsPriceChanged ||
       res?.UpdateFareQuote?.PriceChanged || res?.UpdateFareQuote?.priceChanged ||
       res?.updateFareQuote?.priceChanged || res?.PriceChanged || res?.priceChanged);

  // State for oneway
  const [fStops, setFStops] = useState<Set<string>>(new Set<string>());
  const [fTimes, setFTimes] = useState<Set<string>>(new Set<string>());
  const [fAirlines, setFAirlines] = useState<string[]>([]);
  const [fRefund, setFRefund] = useState<"all" | "refundable" | "nonrefundable">("all");
  const [fPriceMax, setFPriceMax] = useState<number>(Infinity);
  const [fNdc, setFNdc] = useState<"all" | "ndc" | "nonndc">("all");
  const [selectedFareTokens, setSelectedFareTokens] = useState<Record<string, string>>({});
  const [expandedFareGroups, setExpandedFareGroups] = useState<Set<string>>(new Set());
  const [expandedFareInclusionsGroups, setExpandedFareInclusionsGroups] = useState<Set<string>>(new Set());
  const [fareInfoModal, setFareInfoModal] = useState<FareInfoModalState>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const COLLAPSED_FARE_COUNT = 3;

  const toggleFareGroup = (key: string) =>
    setExpandedFareGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleFareInclusionsGroup = (key: string) =>
    setExpandedFareInclusionsGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const openFareInfoModal = (
    kind: "cabin" | "checkin" | "fareRules",
    variant: unknown,
  ) => {
    setFareInfoModal({ kind, variant, fareLabel: getVariantFareLabel(variant) });
  };

  const renderFareInfoModals = () => {
    if (!fareInfoModal) return null;
    const close = () => setFareInfoModal(null);
    const { variant, fareLabel, kind } = fareInfoModal;
    if (kind === "cabin") {
      return <CabinBaggageModal variant={variant} fareLabel={fareLabel} onClose={close} />;
    }
    if (kind === "checkin") {
      return <CheckinBaggageModal variant={variant} fareLabel={fareLabel} onClose={close} />;
    }
    return <FareRulesModal variant={variant} fareLabel={fareLabel} onClose={close} />;
  };

  const tog = (set: Set<string>, k: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    n.has(k) ? n.delete(k) : n.add(k);
    fn(n);
  };

  useEffect(() => {
    setPage(1);
  }, [fStops, fTimes, fAirlines, fRefund, fPriceMax, fNdc]);

  useEffect(() => {
    setSelectedOnwardIndex(null);
    setSelectedReturnIndex(null);
    setSelectedFareTokens({});
    setExpandedFareGroups(new Set());
    setExpandedFareInclusionsGroups(new Set());
    setPage(1);
    setLoadingFlightIndex(null);
    setHoldingFlightIndex(null);
  }, [results, passengers?.departureDate, passengers?.returnDate, passengers?.multiCityLegs]);

  // Check for API error
  if (results?.Status === "0" || results?.Status === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <button onClick={onBack} className="mb-4 text-primary hover:text-primary-dark">
          ← Back to Search
        </button>
        <p className="text-red-600">
          {results.Message || "No flights found. Please try different search criteria."}
        </p>
      </div>
    );
  }

  if (!onwardFlights || onwardFlights.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <button onClick={onBack} className="mb-4 text-primary hover:text-primary-dark">
          ← Back to Search
        </button>
        <p>No flights found. Please try different search criteria.</p>
      </div>
    );
  }

  const formatTime = (dateTime: string) => {
    const date = new Date(dateTime.replace(" ", "T"));
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (dateTime: string) =>
    formatUserDate(dateTime.replace(" ", "T"), { day: "2-digit", month: "short" });

  const calculateDuration = (departure: string, arrival: string) => {
    const dep = new Date(departure.replace(" ", "T"));
    const arr = new Date(arrival.replace(" ", "T"));
    const diff = arr.getTime() - dep.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const renderFlightCard = (flight: any, isSelected: boolean, onSelect: () => void) => {
    const flightDetails = flight.FlightDetails?.Details || flight.flightDetails?.details;
    const price = flight.Price || flight.price;

    if (!flightDetails || !price) return null;

    const journey0 = flightDetails[0];
    const jx = getJourneyEndpoints(journey0);
    if (!jx) return null;
    const flightDetail = jx.first;
    const { origin, destination, stopsLabel } = jx;
    const isLCC = flight.Attr?.IsLCC ?? flight.attr?.isLCC ?? false;
    const flightNum =
      jx.legs.map((l: any) => l.FlightNumber || l.flightNumber).filter(Boolean).join(", ") ||
      flightDetail.FlightNumber ||
      flightDetail.flightNumber ||
      "";
    const airlineCode =
      (flightDetail.FlightNumber || flightDetail.flightNumber || "").slice(0, 2) ||
      flightDetail.OperatorCode ||
      flightDetail.operatorCode ||
      "";

    const supplierFareClass: string = flight.Attr?.supplierFareClass || flight.Attr?.SupplierFareClass || "";
    const fareClass = flight.fareClassification || flight.FareClassification;
    const fareClassLabel = supplierFareClass?.includes("NDC")
      ? "NDC"
      : fareClass?.type || "";
    const fareClassBg = supplierFareClass?.includes("NDC")
      ? undefined
      : fareClass?.color || undefined;

    return (
      <div
        onClick={onSelect}
        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
          isSelected ? "bg-orange-50" : "border-gray-200 hover:border-gray-300"
        }`}
        style={{
          borderColor: isSelected ? OG : undefined,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <img
              src={`/airlines/${airlineCode}.gif`}
              alt={flightDetail.OperatorName || flightDetail.operatorName}
              className="w-10 h-10 object-contain"
              onError={(e) => { console.error("Logo failed:", (e.target as HTMLImageElement).src); (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div>
              <div className="flex items-center gap-2">
                <div className="font-semibold text-lg">
                  {flightDetail.OperatorName || flightDetail.operatorName}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isLCC ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>
                  {isLCC ? "LCC" : "Full Service"}
                </span>
              </div>
              <div className="text-gray-600 text-sm">
                {flightDetail.OperatorCode || flightDetail.operatorCode} {flightNum}
              </div>
            </div>
          </div>
          <div
            className="w-6 h-6 rounded border-2 flex items-center justify-center"
            style={{
              borderColor: isSelected ? OG : "#d1d5db",
              backgroundColor: isSelected ? OG : "white",
            }}
          >
            {isSelected && <span style={{ color: "white", fontSize: 12 }}>✓</span>}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-center">
            <div className="text-xl font-bold">
              {formatTime(origin.DateTime || origin.dateTime)}
            </div>
            <div className="text-sm text-gray-600">
              {formatAirportWithCity(origin)}
            </div>
            <div className="text-xs text-gray-500">
              {formatDate(origin.DateTime || origin.dateTime)}
            </div>
          </div>

          <div className="flex-1 text-center">
            <div className="text-sm text-gray-600 mb-1">
              {calculateDuration(
                origin.DateTime || origin.dateTime,
                destination.DateTime || destination.dateTime
              )}
            </div>
            <div className="border-t border-gray-300 my-2"></div>
            <div className="text-xs text-gray-500">{stopsLabel}</div>
          </div>

          <div className="text-center">
            <div className="text-xl font-bold">
              {formatTime(destination.DateTime || destination.dateTime)}
            </div>
            <div className="text-sm text-gray-600">
              {formatAirportWithCity(destination)}
            </div>
            <div className="text-xs text-gray-500">
              {formatDate(destination.DateTime || destination.dateTime)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 text-sm flex-wrap">
          <span className="text-gray-600">
            Baggage: {flightDetail.Attr?.Baggage || flightDetail.attr?.baggage}
          </span>
          <span
            className={`font-medium ${
              flightDetail.Attr?.IsRefundable || flightDetail.attr?.isRefundable
                ? "text-green-600"
                : "text-red-500"
            }`}
          >
            {flightDetail.Attr?.IsRefundable || flightDetail.attr?.isRefundable
              ? "✓ Refundable"
              : "✗ Non-refundable"}
          </span>
          {fareClassLabel && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                supplierFareClass?.includes("NDC")
                  ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                  : "border-transparent text-gray-800"
              }`}
              style={fareClassBg ? { backgroundColor: fareClassBg } : undefined}
            >
              {fareClassLabel}
            </span>
          )}
        </div>

        <div className="mt-3 text-right">
          <div className="text-2xl font-bold" style={{ color: OG }}>
            ₹{(price.TotalDisplayFare || price.totalDisplayFare)?.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            Base: ₹{(price.PriceBreakup?.BasicFare || price.priceBreakup?.basicFare)?.toLocaleString()}
          </div>
        </div>
      </div>
    );
  };

  const handleSelectRoundtrip = async (holdBooking = false) => {
    if (selectedOnwardIndex === null || selectedReturnIndex === null) {
      alert("Please select both onward and return flights");
      return;
    }
    const hold = holdBooking && isFlightHoldFeatureEnabled();

    hold ? setHoldingRoundtrip(true) : setLoading(true);
    try {
      const selectedOnward = onwardFlights[selectedOnwardIndex];
      const selectedReturn = returnFlights[selectedReturnIndex];
      
      const onwardResultToken = selectedOnward.ResultToken || selectedOnward.resultToken;
      const returnResultToken = selectedReturn.ResultToken || selectedReturn.resultToken;

      if (!domainToken) {
        throw new Error("Domain token not available");
      }

      console.log("\n========== ROUNDTRIP FLIGHT SELECTION ==========");
      console.log("Selected Onward Index:", selectedOnwardIndex);
      console.log("Selected Return Index:", selectedReturnIndex);
      console.log("Onward Result Token:", onwardResultToken);
      console.log("Return Result Token:", returnResultToken);
      console.log("================================================\n");

      const isSpecialReturn = tripType === "specialreturn";

      if (isSpecialReturn) {
        // Special Return (JourneyType=5): send both tokens in a single update-fare-quote call
        const combinedResultToken = `${onwardResultToken},${returnResultToken}`;
        const fareQuoteResponse = await flightAPI.updateFareQuote(combinedResultToken, domainToken);

        if (fareQuoteResponse?.Status === 0 || fareQuoteResponse?.Status === "0") {
          alert(fareQuoteResponse.Message || "Fare quote failed. Please try again.");
          hold ? setHoldingRoundtrip(false) : setLoading(false);
          return;
        }

        const updatedFlight = {
          ...selectedOnward,
          selectedOnwardIndex,
          selectedReturnIndex,
          fareQuoteData: fareQuoteResponse,
          domainToken,
          isType2Roundtrip: true,
          ...(hold && { holdBooking: true }),
        };

        if (isPriceChanged(fareQuoteResponse)) {
          const obOld = selectedOnward.Price?.TotalDisplayFare || selectedOnward.price?.totalDisplayFare || 0;
          const ibOld = selectedReturn.Price?.TotalDisplayFare || selectedReturn.price?.totalDisplayFare || 0;
          const oldTotal = obOld + ibOld;
          const newTotal = extractNewPrice(fareQuoteResponse);
          hold ? setHoldingRoundtrip(false) : setLoading(false);
          setPriceChangeInfo({
            changes: [{ label: "Special Return", oldPrice: oldTotal, newPrice: newTotal }],
            onConfirm: () => { setPriceChangeInfo(null); onSelectFlight(updatedFlight); },
          });
          return;
        }

        onSelectFlight(updatedFlight);
      } else {
        // Normal Return: Call update fare quote for ONWARD and RETURN flights in parallel
        const [onwardFareQuoteResponse, returnFareQuoteResponse] = await Promise.all([
          flightAPI.updateFareQuote(onwardResultToken, domainToken),
          flightAPI.updateFareQuote(returnResultToken, domainToken),
        ]);

        if (onwardFareQuoteResponse?.Status === 0 || onwardFareQuoteResponse?.Status === "0") {
          alert(`Onward flight: ${onwardFareQuoteResponse.Message || "Fare quote failed. Please try again."}`);
          hold ? setHoldingRoundtrip(false) : setLoading(false);
          return;
        }
        if (returnFareQuoteResponse?.Status === 0 || returnFareQuoteResponse?.Status === "0") {
          alert(`Return flight: ${returnFareQuoteResponse.Message || "Fare quote failed. Please try again."}`);
          hold ? setHoldingRoundtrip(false) : setLoading(false);
          return;
        }

        const combinedFlight = {
          ...selectedOnward,
          selectedOnwardIndex,
          selectedReturnIndex,
          selectedReturn: selectedReturn,
          fareQuoteData: onwardFareQuoteResponse,
          returnFareQuoteData: returnFareQuoteResponse,
          domainToken,
          ...(hold && { holdBooking: true }),
        };

        // Collect any price changes across OB and IB
        const changes: { label: string; oldPrice: number; newPrice: number }[] = [];
        const obOld = selectedOnward.Price?.TotalDisplayFare || selectedOnward.price?.totalDisplayFare || 0;
        const ibOld = selectedReturn.Price?.TotalDisplayFare || selectedReturn.price?.totalDisplayFare || 0;
        if (isPriceChanged(onwardFareQuoteResponse)) {
          changes.push({ label: "Outbound", oldPrice: obOld, newPrice: extractNewPrice(onwardFareQuoteResponse) });
        }
        if (isPriceChanged(returnFareQuoteResponse)) {
          changes.push({ label: "Return", oldPrice: ibOld, newPrice: extractNewPrice(returnFareQuoteResponse) });
        }

        if (changes.length > 0) {
          hold ? setHoldingRoundtrip(false) : setLoading(false);
          setPriceChangeInfo({ changes, onConfirm: () => { setPriceChangeInfo(null); onSelectFlight(combinedFlight); } });
          return;
        }

        onSelectFlight(combinedFlight);
      }
    } catch (error) {
      console.error("Failed to update fare quote:", error);
      alert("Failed to get updated fare. Please try again.");
    }
    hold ? setHoldingRoundtrip(false) : setLoading(false);
  };

  const handleSelectOneway = async (flight: any, flightIndex: number, holdBooking = false) => {
    const hold = holdBooking && isFlightHoldFeatureEnabled();
    const resultToken = flight.ResultToken || flight.resultToken;
    const setIdx = hold ? setHoldingFlightIndex : setLoadingFlightIndex;
    setIdx(flightIndex);

    try {
      if (!domainToken) {
        throw new Error("Domain token not available");
      }

      const fareQuoteResponse = await flightAPI.updateFareQuote(resultToken, domainToken);

      if (fareQuoteResponse?.Status === 0 || fareQuoteResponse?.Status === "0") {
        alert(fareQuoteResponse.Message || "Fare quote failed. Please try again.");
        setIdx(null);
        return;
      }

      const updatedFlight = {
        ...flight,
        fareQuoteData: fareQuoteResponse,
        domainToken,
        ...(hold && { holdBooking: true }),
      };

      if (isPriceChanged(fareQuoteResponse)) {
        const oldPrice = flight.Price?.TotalDisplayFare || flight.price?.totalDisplayFare || 0;
        const newPrice = extractNewPrice(fareQuoteResponse);
        setIdx(null);
        setPriceChangeInfo({
          changes: [{ label: "Flight", oldPrice, newPrice }],
          onConfirm: () => { setPriceChangeInfo(null); onSelectFlight(updatedFlight); },
        });
        return;
      }

      onSelectFlight(updatedFlight);
    } catch (error) {
      console.error("Failed to update fare quote:", error);
      alert("Failed to get updated fare. Please try again.");
    }

    setIdx(null);
  };

  const handleSelectType2Roundtrip = async (flight: any, flightIndex: number, holdBooking = false) => {
    const hold = holdBooking && isFlightHoldFeatureEnabled();
    const resultToken = flight.ResultToken || flight.resultToken;
    const setIdx = hold ? setHoldingFlightIndex : setLoadingFlightIndex;
    setIdx(flightIndex);

    console.log('\n========== TYPE 2 ROUNDTRIP SELECTION ==========');
    console.log('Selecting Type 2 Paired Roundtrip Flight');
    console.log('flightIndex:', flightIndex);
    console.log('Flight ResultToken:', resultToken);
    console.log('Flight FlightDetails structure:');
    const fd = flight.FlightDetails?.Details || flight.flightDetails?.details;
    console.log('  - FlightDetails?.Details?.length:', fd?.length);
    console.log('  - FlightDetails[0]?.length (segments):', fd?.[0]?.length);
    console.log('  - Full Flight object:', JSON.stringify(flight, null, 2).substring(0, 500));

    try {
      if (!domainToken) {
        throw new Error("Domain token not available");
      }

      const fareQuoteResponse = await flightAPI.updateFareQuote(resultToken, domainToken);

      if (fareQuoteResponse?.Status === 0 || fareQuoteResponse?.Status === "0") {
        alert(fareQuoteResponse.Message || "Fare quote failed. Please try again.");
        setIdx(null);
        return;
      }

      // Mark as Type 2 roundtrip so FlightBooking knows it needs to handle both OB and IB
      const updatedFlight = {
        ...flight,
        fareQuoteData: fareQuoteResponse,
        domainToken,
        isType2Roundtrip: true,
        ...(hold && { holdBooking: true }),
      };

      console.log('Updated Flight with isType2Roundtrip marker');
      console.log('  - isType2Roundtrip: true');
      console.log('  - fareQuoteData exists:', !!updatedFlight.fareQuoteData);
      console.log('=============================================\n');

      if (isPriceChanged(fareQuoteResponse)) {
        const oldPrice = flight.Price?.TotalDisplayFare || flight.price?.totalDisplayFare || 0;
        const newPrice = extractNewPrice(fareQuoteResponse);
        setIdx(null);
        setPriceChangeInfo({
          changes: [{ label: "Flight", oldPrice, newPrice }],
          onConfirm: () => { setPriceChangeInfo(null); onSelectFlight(updatedFlight); },
        });
        return;
      }

      onSelectFlight(updatedFlight);
    } catch (error) {
      console.error("Failed to update fare quote:", error);
      alert("Failed to get updated fare. Please try again.");
    }

    setIdx(null);
  };

  // Shared price-change modal (used in both oneway and roundtrip returns)
  const priceChangedModal = priceChangeInfo ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4" style={{ background: `linear-gradient(135deg, ${OG}, #ff8c38)` }}>
          <div className="text-white font-bold text-lg">⚠️ Fare Updated</div>
          <div className="text-white/80 text-xs mt-0.5">The fare has changed since you searched</div>
        </div>
        <div className="p-6 space-y-4">
          {priceChangeInfo.changes.map((c, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              {priceChangeInfo.changes.length > 1 && (
                <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: OG }}>{c.label}</div>
              )}
              <div className="flex items-center justify-between gap-4">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Old Price</div>
                  <div className="text-lg font-bold text-gray-400 line-through">₹{c.oldPrice.toLocaleString()}</div>
                </div>
                <div className="text-2xl text-gray-300">→</div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">New Price</div>
                  <div className="text-lg font-bold" style={{ color: c.newPrice > c.oldPrice ? "#dc2626" : "#16a34a" }}>
                    ₹{c.newPrice.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className={`text-center text-xs font-semibold mt-2 ${c.newPrice > c.oldPrice ? "text-red-600" : "text-green-600"}`}>
                {c.newPrice > c.oldPrice ? `↑ ₹${(c.newPrice - c.oldPrice).toLocaleString()} more` : `↓ ₹${(c.oldPrice - c.newPrice).toLocaleString()} less`}
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-500 text-center">Do you want to continue with the new fare?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setPriceChangeInfo(null)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={priceChangeInfo.onConfirm}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: `linear-gradient(90deg, ${OG}, #ff8c38)` }}
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const deduplicateByToken = (flights: any[]) => {
    const seen = new Set<string>();
    return flights.filter((flight: any) => {
      const token = flight.ResultToken || flight.resultToken || "";
      if (!token || seen.has(token)) return false;
      seen.add(token);
      return true;
    });
  };

  const getFlightGroupKey = (flight: any): string => {
    const details: any[][] = flight.FlightDetails?.Details || flight.flightDetails?.details || [];
    return details.map((leg: any[]) => {
      const first = leg?.[0];
      const last = leg?.[leg.length - 1];
      const flightNum = first?.FlightNumber || first?.flightNumber || "";
      const origCode = first?.Origin?.AirportCode || first?.origin?.airportCode || "";
      const depTime = first?.Origin?.DateTime || first?.origin?.dateTime || "";
      const destCode = last?.Destination?.AirportCode || last?.destination?.airportCode || "";
      const arrTime = last?.Destination?.DateTime || last?.destination?.dateTime || "";
      return `${flightNum}|${origCode}|${destCode}|${depTime}|${arrTime}`;
    }).join("||");
  };

  const groupFlights = (flights: any[]): { key: string; variants: any[] }[] => {
    const map = new Map<string, any[]>();
    for (const f of flights) {
      const k = getFlightGroupKey(f);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(f);
    }
    return Array.from(map.entries()).map(([key, variants]) => ({ key, variants }));
  };

  const getFareCombinationId = (flight: any): string => {
    if (!flight || typeof flight !== "object") return "";
    return String(
      flight.FareCombinationId ??
        flight.fareCombinationId ??
        flight?.segments?.FareCombinationId ??
        flight?.segments?.fareCombinationId ??
        "",
    ).trim();
  };

  // SHARED FILTER LOGIC
  const allFlightsForFilter = isRoundtrip ? [...onwardFlights, ...returnFlights] : onwardFlights;
  const allPrices = allFlightsForFilter
    .map((f: any) => f.Price?.TotalDisplayFare || f.price?.totalDisplayFare || 0)
    .filter(Boolean) as number[];
  const dataMinPrice = allPrices.length ? Math.min(...allPrices) : 0;
  const dataMaxPrice = allPrices.length ? Math.max(...allPrices) : 100000;
  const effectiveMax = fPriceMax === Infinity ? dataMaxPrice : fPriceMax;

  const stopCounts: Record<string, number> = { nonstop: 0, "1stop": 0, "2plus": 0 };
  const timeCounts: Record<string, number> = { earlyam: 0, morning: 0, afternoon: 0, evening: 0 };
  const airlineMap: Record<string, { code: string; name: string; count: number; minPrice: number }> = {};

  /** Facet counts must match “unique flights” (same grouping as the results list), not raw fare rows. */
  const facetSourceFlights = isRoundtrip ? [...onwardFlights, ...returnFlights] : onwardFlights;

  groupFlights(facetSourceFlights).forEach(({ variants }) => {
    const flight = variants[0];
    const fd = flight.FlightDetails?.Details || flight.flightDetails?.details;
    const fd0 = fd?.[0];
    const seg0 = fd0?.[0];
    if (!seg0) return;

    const sc = fd0?.length || 1;
    const sk = sc === 1 ? "nonstop" : sc === 2 ? "1stop" : "2plus";
    stopCounts[sk]++;

    const dt = seg0.Origin?.DateTime || seg0.origin?.dateTime || "";
    if (dt) {
      const h = new Date(dt.replace(" ", "T")).getHours();
      const tk = h < 6 ? "earlyam" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
      timeCounts[tk]++;
    }

    const code = (seg0.OperatorCode || seg0.operatorCode || "").trim().toUpperCase();
    const name = (seg0.OperatorName || seg0.operatorName || "").trim();
    const variantPrices = variants
      .map((v: any) => Number(v.Price?.TotalDisplayFare || v.price?.totalDisplayFare || 0))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    const fpMin = variantPrices.length ? Math.min(...variantPrices) : 0;
    if (code) {
      if (!airlineMap[code]) {
        airlineMap[code] = { code, name: name || code, count: 0, minPrice: fpMin || Number.POSITIVE_INFINITY };
      }
      airlineMap[code].count++;
      if (fpMin > 0 && fpMin < airlineMap[code].minPrice) airlineMap[code].minPrice = fpMin;
    }
  });

  const airlineList = Object.values(airlineMap)
    .map((a) => ({
      ...a,
      minPrice: Number.isFinite(a.minPrice) && a.minPrice !== Number.POSITIVE_INFINITY ? a.minPrice : 0,
    }))
    .sort((a, b) => a.minPrice - b.minPrice);

  const applyFilters = (flights: any[]) => flights.filter((flight: any) => {
    const flightDetails = flight.FlightDetails?.Details || flight.flightDetails?.details;
    const flightDetail = flightDetails?.[0]?.[0];
    if (!flightDetail) return false;

    const fp = (flight.Price?.TotalDisplayFare || flight.price?.totalDisplayFare || 0) as number;
    if (fp > effectiveMax) return false;

    if (fStops.size > 0) {
      const segCount = flightDetails?.[0]?.length || 1;
      const stopKey = segCount === 1 ? "nonstop" : segCount === 2 ? "1stop" : "2plus";
      if (!fStops.has(stopKey)) return false;
    }

    const depDt = flightDetail.Origin?.DateTime || flightDetail.origin?.dateTime || "";
    if (depDt && fTimes.size > 0) {
      const hour = new Date(depDt.replace(" ", "T")).getHours();
      const timeKey = hour < 6 ? "earlyam" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
      if (!fTimes.has(timeKey)) return false;
    }

    if (fAirlines.length > 0) {
      const code = (flightDetail.OperatorCode || flightDetail.operatorCode || "").trim().toUpperCase();
      if (!fAirlines.includes(code)) return false;
    }

    if (fRefund !== "all") {
      const isRefundable = flight.Attr?.IsRefundable ?? flightDetail.Attr?.IsRefundable ?? flightDetail.attr?.isRefundable;
      if (fRefund === "refundable" && !isRefundable) return false;
      if (fRefund === "nonrefundable" && isRefundable) return false;
    }

    if (fNdc !== "all") {
      const sfc: string = flight.Attr?.supplierFareClass || flight.Attr?.SupplierFareClass || "";
      const isNdc = sfc?.includes("NDC");
      if (fNdc === "ndc" && !isNdc) return false;
      if (fNdc === "nonndc" && isNdc) return false;
    }

    return true;
  });

  const filteredOnwardFlights = applyFilters(deduplicateByToken(onwardFlights)).sort((a: any, b: any) =>
    (a.Price?.TotalDisplayFare || a.price?.totalDisplayFare || 0) - (b.Price?.TotalDisplayFare || b.price?.totalDisplayFare || 0)
  );
  const selectedOnwardFareCombinationId =
    selectedOnwardIndex != null ? getFareCombinationId(onwardFlights[selectedOnwardIndex]) : "";
  const returnFlightsForSelection = (() => {
    if (!isRoundtrip) return returnFlights;
    if (!isSpecialReturn) return returnFlights;
    if (selectedOnwardIndex == null) return [];
    if (!selectedOnwardFareCombinationId) return returnFlights;
    return returnFlights.filter(
      (f: any) => getFareCombinationId(f) === selectedOnwardFareCombinationId,
    );
  })();

  const filteredReturnFlights = applyFilters(deduplicateByToken(returnFlightsForSelection)).sort((a: any, b: any) =>
    (a.Price?.TotalDisplayFare || a.price?.totalDisplayFare || 0) - (b.Price?.TotalDisplayFare || b.price?.totalDisplayFare || 0)
  );
  const groupedOnwardFlights = groupFlights(filteredOnwardFlights);
  const groupedReturnFlights = groupFlights(filteredReturnFlights);
  const filteredFlights = filteredOnwardFlights;

  const sortedFlights = [...filteredFlights].sort((a, b) => {
    const priceA = a.Price?.TotalDisplayFare || a.price?.totalDisplayFare || 0;
    const priceB = b.Price?.TotalDisplayFare || b.price?.totalDisplayFare || 0;
    return priceA - priceB;
  });

  const groupedSortedFlights = groupFlights(sortedFlights);
  const totalFlightGroups = groupedSortedFlights.length;
  const totalPages =
    totalFlightGroups === 0 ? 0 : Math.ceil(totalFlightGroups / PAGE_SIZE);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const pagedGroups = groupedSortedFlights.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Filter sidebar (shared by both oneway and roundtrip)
  const filterSidebar = (
    <div className="w-full lg:w-64 flex-shrink-0 bg-white rounded-lg shadow-lg p-4 lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
      <h3 className="font-bold text-lg mb-4" style={{ color: OG }}>Filters</h3>

      {/* Price Range */}
      <div className="mb-6">
        <div className="font-semibold text-sm mb-2">Price Range</div>
        <input type="range" min={dataMinPrice} max={dataMaxPrice} value={effectiveMax}
          onChange={(e) => setFPriceMax(Number(e.target.value))} className="w-full" />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>₹{dataMinPrice.toLocaleString()}</span>
          <span>₹{effectiveMax.toLocaleString()}</span>
        </div>
      </div>

      {/* Stops */}
      <div className="mb-6">
        <div className="font-semibold text-sm mb-2">Stops</div>
        <div className="space-y-2">
          {[
            { key: "nonstop", label: "Non-stop", count: stopCounts.nonstop },
            { key: "1stop", label: "1 Stop", count: stopCounts["1stop"] },
            { key: "2plus", label: "2+ Stops", count: stopCounts["2plus"] },
          ].map(({ key, label, count }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
              <Chk on={fStops.has(key)} />
              <input type="checkbox" checked={fStops.has(key)} onChange={() => tog(fStops, key, setFStops)} className="hidden" />
              <span className="flex-1">{label}</span>
              <span className="text-xs text-gray-500">({count})</span>
            </label>
          ))}
        </div>
      </div>

      {/* Departure Time */}
      <div className="mb-6">
        <div className="font-semibold text-sm mb-2">Departure Time</div>
        <div className="space-y-2">
          {[
            { key: "earlyam", label: "Before 6 AM", icon: "🌙", count: timeCounts.earlyam },
            { key: "morning", label: "6 AM - 12 PM", icon: "🌅", count: timeCounts.morning },
            { key: "afternoon", label: "12 PM - 6 PM", icon: "☀️", count: timeCounts.afternoon },
            { key: "evening", label: "After 6 PM", icon: "🌆", count: timeCounts.evening },
          ].map(({ key, label, icon, count }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
              <Chk on={fTimes.has(key)} />
              <input type="checkbox" checked={fTimes.has(key)} onChange={() => tog(fTimes, key, setFTimes)} className="hidden" />
              <span>{icon}</span>
              <span className="flex-1">{label}</span>
              <span className="text-xs text-gray-500">({count})</span>
            </label>
          ))}
        </div>
      </div>

      {/* Airlines */}
      <div className="mb-6">
        <div className="font-semibold text-sm mb-2">Airlines</div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {airlineList.map(({ code, name, count, minPrice }) => (
            <label key={code} className="flex items-center gap-2 cursor-pointer text-sm">
              <Chk on={fAirlines.includes(code)} />
              <input type="checkbox" checked={fAirlines.includes(code)}
                onChange={() => setFAirlines(prev => prev.includes(code) ? prev.filter(a => a !== code) : [...prev, code])}
                className="hidden" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{name}</div>
                <div className="text-xs text-gray-500">from ₹{minPrice.toLocaleString()}</div>
              </div>
              <span className="text-xs text-gray-500">({count})</span>
            </label>
          ))}
        </div>
      </div>

      {/* Refundable */}
      <div className="mb-6">
        <div className="font-semibold text-sm mb-2">Refundable</div>
        <div className="space-y-2">
          {[{ key: "all", label: "All" }, { key: "refundable", label: "Refundable" }, { key: "nonrefundable", label: "Non-refundable" }]
            .map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="refund" checked={fRefund === key} onChange={() => setFRefund(key as any)} className="text-primary" />
                <span>{label}</span>
              </label>
            ))}
        </div>
      </div>

      {/* Fare Type */}
      <div className="mb-6">
        <div className="font-semibold text-sm mb-2">Fare Type</div>
        <div className="space-y-2">
          {[{ key: "all", label: "All" }, { key: "ndc", label: "NDC" }, { key: "nonndc", label: "Non-NDC" }]
            .map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="ndc" checked={fNdc === key} onChange={() => setFNdc(key as any)} className="text-primary" />
                <span>{label}</span>
              </label>
            ))}
        </div>
      </div>

      {/* Clear Filters */}
      <button onClick={() => { setFStops(new Set<string>()); setFTimes(new Set<string>()); setFAirlines([]); setFRefund("all"); setFPriceMax(Infinity); setFNdc("all"); }}
        className="w-full py-2 text-sm border rounded-lg hover:bg-gray-50">
        Clear All Filters
      </button>
    </div>
  );

  // Search criteria banner
  const firstFlight = onwardFlights[0];
  const firstJourney = (firstFlight?.FlightDetails?.Details || firstFlight?.flightDetails?.details)?.[0];
  const firstJx = getJourneyEndpoints(firstJourney);
  const firstSeg = firstJx?.first;
  const criteriaOrigin = passengers?.origin || firstSeg?.Origin?.AirportCode || firstSeg?.origin?.airportCode || "";
  const criteriaDestination =
    passengers?.destination ||
    firstJx?.last?.Destination?.AirportCode ||
    firstJx?.last?.destination?.airportCode ||
    "";
  const criteriaOriginLabel =
    formatAirportWithCity(firstSeg?.Origin || firstSeg?.origin) || criteriaOrigin;
  const criteriaDestinationLabel =
    formatAirportWithCity(firstJx?.last?.Destination || firstJx?.last?.destination) || criteriaDestination;
  const criteriaDate = passengers?.departureDate
    ? formatFlightCalendarDate(passengers.departureDate, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : firstSeg?.Origin?.DateTime
      ? formatUserDate(firstSeg.Origin.DateTime.replace(" ", "T"), {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";
  const criteriaReturnDate = passengers?.returnDate && isRoundtrip
    ? formatFlightCalendarDate(passengers.returnDate, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  const cabinLabel = passengers?.cabinClass
    ? passengers.cabinClass.charAt(0).toUpperCase() + passengers.cabinClass.slice(1)
    : "Economy";
  const paxParts: string[] = [];
  if (passengers?.adults) paxParts.push(`${passengers.adults} Adult${passengers.adults > 1 ? "s" : ""}`);
  if (passengers?.children) paxParts.push(`${passengers.children} Child${passengers.children > 1 ? "ren" : ""}`);
  if (passengers?.infants) paxParts.push(`${passengers.infants} Infant${passengers.infants > 1 ? "s" : ""}`);
  const paxSummary = paxParts.join(", ") || "1 Adult";
  const totalPaxCount = Math.max(
    1,
    (passengers?.adults ?? 0) + (passengers?.children ?? 0) + (passengers?.infants ?? 0),
  );

  const mcLegs: Array<{ origin: string; destination: string; date: string }> = passengers?.multiCityLegs || [];
  const fmtCriteriaDate = (d: string) =>
    formatFlightCalendarDate(d, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const searchCriteriaBanner = (criteriaOrigin || mcLegs.length > 0) ? (
    <div className="sticky top-16 z-20 bg-white rounded-lg shadow-md border border-gray-100 px-5 py-3 mb-4 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
      <span className="font-semibold text-gray-500 mr-1">Search Criteria</span>
      <span className="text-gray-300">|</span>

      {mcLegs.length > 0 ? (
        /* Multicity: show each leg with its date */
        mcLegs.map((leg, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300 mx-0.5">·</span>}
            <span className="font-bold text-gray-800">{leg.origin} → {leg.destination}</span>
            {leg.date && (
              <span className="text-gray-600 ml-1">({fmtCriteriaDate(leg.date)})</span>
            )}
          </span>
        ))
      ) : (
        /* Oneway / Roundtrip */
        <>
          <span className="font-bold text-gray-800">{criteriaOriginLabel} → {criteriaDestinationLabel}</span>
          {criteriaReturnDate && <span className="text-gray-800 font-bold"> → {criteriaOriginLabel}</span>}
          <span className="text-gray-300">|</span>
          <span className="text-gray-600">
            Departure: <span className="font-medium text-gray-800">{criteriaDate}</span>
          </span>
          {criteriaReturnDate && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-gray-600">
                Return: <span className="font-medium text-gray-800">{criteriaReturnDate}</span>
              </span>
            </>
          )}
        </>
      )}

      <span className="text-gray-300">|</span>
      <span className="text-gray-600">
        Passenger(s): <span className="font-medium text-gray-800">{paxSummary}</span>
      </span>
      <span className="text-gray-300">|</span>
      <span className="text-gray-600">
        Class: <span className="font-medium text-gray-800">{cabinLabel}</span>
      </span>
      {onDateShift && (
        <>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={dateShiftLoading}
              onClick={() => void onDateShift(-1)}
              className="text-primary hover:text-primary-dark font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Prev day
            </button>
            <button
              type="button"
              disabled={dateShiftLoading}
              onClick={() => void onDateShift(1)}
              className="text-primary hover:text-primary-dark font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next day →
            </button>
          </div>
        </>
      )}
      <button
        onClick={onBack}
        className="ml-auto text-primary hover:text-primary-dark font-medium text-sm whitespace-nowrap"
      >
        ← Back to Search
      </button>
    </div>
  ) : null;

  if (isType1Roundtrip) {
    return (
      <>
      {searchCriteriaBanner}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {filterSidebar}
        <div className="flex-1 min-w-0 bg-white rounded-lg shadow-lg p-3 sm:p-4">
        <h2 className="text-lg font-semibold mb-3">Select Roundtrip Flights</h2>

        {/* Summary and Continue Button */}
        <div className="sticky top-0 z-20 bg-white mb-3 pb-2 pt-1 border-b shadow-sm">
          <div className="flex flex-col md:flex-row md:items-stretch gap-2 mb-2">
            {/* Onward Summary — compact width on md+ to free horizontal space */}
            {(() => {
              const f = selectedOnwardIndex !== null ? onwardFlights[selectedOnwardIndex] : null;
              const journey = (f?.FlightDetails?.Details || f?.flightDetails?.details)?.[0] || [];
              const jx = getJourneyEndpoints(journey);
              const fd = jx?.first;
              const origin = jx?.origin;
              const dest = jx?.destination;
              const onwardTerminals = f ? getJourneyEndpointTerminals(f, 0) : null;
              const price = f?.Price?.TotalDisplayFare || f?.price?.totalDisplayFare;
              const flightNums = jx?.legs.map((l: any) => l.FlightNumber || l.flightNumber).filter(Boolean).join(", ");
              return (
                <div className="w-full md:max-w-[13rem] lg:max-w-[15rem] md:flex-shrink-0">
                  <div className="bg-gray-50 rounded-lg p-1.5 sm:p-2 border-2 h-full" style={{ borderColor: selectedOnwardIndex !== null ? OG : "#e5e7eb" }}>
                    <div className="text-[10px] font-semibold text-gray-500 mb-0.5">✈️ Onward</div>
                    {f && fd ? (
                      <div>
                        <div className="font-semibold text-[11px] leading-tight break-words">
                          {fd.OperatorName || fd.operatorName} · {flightNums || fd.FlightNumber || fd.flightNumber}
                          {jx && jx.segmentCount > 1 && (
                            <span className="font-normal text-gray-500"> ({jx.stopsLabel})</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0 text-[10px] mt-0.5">
                          <span className="font-bold">{formatTime(origin?.DateTime || origin?.dateTime)}</span>
                          <span className="text-gray-500">
                            {formatAirportWithCity(origin)}
                            {onwardTerminals?.departureTerminal
                              ? ` · ${formatTerminalLabel(onwardTerminals.departureTerminal)}`
                              : ""}
                          </span>
                          <span className="text-gray-300">→</span>
                          <span className="font-bold">{formatTime(dest?.DateTime || dest?.dateTime)}</span>
                          <span className="text-gray-500">
                            {formatAirportWithCity(dest)}
                            {onwardTerminals?.arrivalTerminal
                              ? ` · ${formatTerminalLabel(onwardTerminals.arrivalTerminal)}`
                              : ""}
                          </span>
                        </div>
                        <div className="font-bold text-xs mt-0.5" style={{ color: OG }}>₹{price?.toLocaleString()}</div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-400 italic">Not selected</div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Return Summary */}
            {(() => {
              const f = selectedReturnIndex !== null ? returnFlights[selectedReturnIndex] : null;
              const journey = (f?.FlightDetails?.Details || f?.flightDetails?.details)?.[0] || [];
              const jx = getJourneyEndpoints(journey);
              const fd = jx?.first;
              const origin = jx?.origin;
              const dest = jx?.destination;
              const returnTerminals = f ? getJourneyEndpointTerminals(f, 0) : null;
              const price = f?.Price?.TotalDisplayFare || f?.price?.totalDisplayFare;
              const flightNums = jx?.legs.map((l: any) => l.FlightNumber || l.flightNumber).filter(Boolean).join(", ");
              return (
                <div className="w-full md:max-w-[13rem] lg:max-w-[15rem] md:flex-shrink-0">
                  <div className="bg-gray-50 rounded-lg p-1.5 sm:p-2 border-2 h-full" style={{ borderColor: selectedReturnIndex !== null ? OG : "#e5e7eb" }}>
                    <div className="text-[10px] font-semibold text-gray-500 mb-0.5">✈️ Return</div>
                    {f && fd ? (
                      <div>
                        <div className="font-semibold text-[11px] leading-tight break-words">
                          {fd.OperatorName || fd.operatorName} · {flightNums || fd.FlightNumber || fd.flightNumber}
                          {jx && jx.segmentCount > 1 && (
                            <span className="font-normal text-gray-500"> ({jx.stopsLabel})</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0 text-[10px] mt-0.5">
                          <span className="font-bold">{formatTime(origin?.DateTime || origin?.dateTime)}</span>
                          <span className="text-gray-500">
                            {formatAirportWithCity(origin)}
                            {returnTerminals?.departureTerminal
                              ? ` · ${formatTerminalLabel(returnTerminals.departureTerminal)}`
                              : ""}
                          </span>
                          <span className="text-gray-300">→</span>
                          <span className="font-bold">{formatTime(dest?.DateTime || dest?.dateTime)}</span>
                          <span className="text-gray-500">
                            {formatAirportWithCity(dest)}
                            {returnTerminals?.arrivalTerminal
                              ? ` · ${formatTerminalLabel(returnTerminals.arrivalTerminal)}`
                              : ""}
                          </span>
                        </div>
                        <div className="font-bold text-xs mt-0.5" style={{ color: OG }}>₹{price?.toLocaleString()}</div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-400 italic">Not selected</div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Total + compact top-right continue */}
            <div className="flex-1 min-w-0 bg-orange-50 rounded-lg p-2 border-2" style={{ borderColor: OG }}>
              <div className="flex flex-row items-start justify-between gap-2">
                <div className="min-w-0 flex-1 pr-1">
                  <div className="text-[10px] font-semibold mb-0.5" style={{ color: OG }}>Total</div>
                  {selectedOnwardIndex !== null && selectedReturnIndex !== null ? (
                    <div>
                      <div className="font-bold text-base sm:text-lg leading-tight" style={{ color: OG }}>
                        ₹{(
                          (onwardFlights[selectedOnwardIndex].Price?.TotalDisplayFare || onwardFlights[selectedOnwardIndex].price?.totalDisplayFare) +
                          (returnFlights[selectedReturnIndex].Price?.TotalDisplayFare || returnFlights[selectedReturnIndex].price?.totalDisplayFare)
                        )?.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        for {totalPaxCount} {totalPaxCount === 1 ? "passenger" : "passengers"}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">Select both flights</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectRoundtrip()}
                  disabled={selectedOnwardIndex === null || selectedReturnIndex === null || loading || holdingRoundtrip}
                  className="shrink-0 inline-flex min-h-9 items-center justify-center self-start rounded-lg px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-center leading-tight"
                  style={{ background: `linear-gradient(90deg, ${OG}, #ff8c38)` }}
                >
                  {loading || holdingRoundtrip ? "Processing..." : "Continue to Booking →"}
                </button>
              </div>

              {/* Hold Booking (temporarily disabled) */}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Onward Flights */}
          <div>
            <h3 className="text-sm font-bold mb-2 pb-1 border-b-2" style={{ borderColor: OG }}>
              ✈️ Onward Flights ({groupedOnwardFlights.length})
            </h3>
            <div className="space-y-2 max-h-[min(78vh,900px)] overflow-y-auto">
              {groupedOnwardFlights.map(({ key: groupKey, variants }) => {
                const rep = variants[0];
                const journey = (rep.FlightDetails?.Details || rep.flightDetails?.details)?.[0] || [];
                const jx = getJourneyEndpoints(journey);
                if (!jx) return null;
                const { origin, destination, first: seg0, stopsLabel } = jx;
                const flightNum =
                  jx.legs.map((l: any) => l.FlightNumber || l.flightNumber).filter(Boolean).join(", ") ||
                  seg0?.FlightNumber ||
                  seg0?.flightNumber ||
                  "";
                const airlineCode = (seg0?.FlightNumber || seg0?.flightNumber || "").slice(0, 2) || seg0?.OperatorCode || seg0?.operatorCode || "";
                const isLCC = rep.Attr?.IsLCC ?? rep.attr?.isLCC ?? false;

                // Which fare is selected in this group
                const selToken = selectedFareTokens[`ob_${groupKey}`] ||
                  (variants.find(v => onwardFlights.indexOf(v) === selectedOnwardIndex)?.ResultToken) ||
                  (rep.ResultToken || rep.resultToken);
                const isGroupSelected = variants.some(v => onwardFlights.indexOf(v) === selectedOnwardIndex);
                const selectedVariant =
                  variants.find((v) => (v.ResultToken || v.resultToken) === selToken) || rep;
                const { departureTerminal, arrivalTerminal } = getJourneyEndpointTerminals(
                  selectedVariant,
                  0,
                );
                const cabinClassLabel = getJourneyCabinClassLabel(selectedVariant, 0);
                const fareClassLabel = getJourneyFareClassLabel(selectedVariant, 0);

                return (
                  <div key={groupKey} className={`rounded-md overflow-hidden transition-all ${isGroupSelected ? "border-2 bg-orange-50" : "border border-gray-200 hover:border-gray-300"}`}
                    style={{ borderColor: isGroupSelected ? OG : undefined }}>
                    {/* Header */}
                    <div className="p-2">
                      <FlightAirlineInfoBlock
                        airlineCode={airlineCode}
                        operatorName={seg0?.OperatorName || seg0?.operatorName}
                        isLCC={!!isLCC}
                        cabinClassLabel={cabinClassLabel}
                        operatorCode={seg0?.OperatorCode || seg0?.operatorCode}
                        flightNum={flightNum}
                        fareClassLabel={fareClassLabel}
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-center min-w-0 flex-1">
                          <div className="text-sm font-bold tabular-nums">{formatTime(origin?.DateTime || origin?.dateTime)}</div>
                          <FlightAirportDisplay
                            airportLike={origin}
                            terminal={departureTerminal}
                            airportClassName="text-[10px] text-gray-600 leading-tight line-clamp-2"
                          />
                        </div>
                        <div className="flex-1 text-center min-w-0">
                          <div className="text-[10px] text-gray-400">{calculateDuration(origin?.DateTime || origin?.dateTime, destination?.DateTime || destination?.dateTime)}</div>
                          <div className="flex items-center gap-0.5 my-0.5">
                            <div className="flex-1 h-px bg-gray-300" />
                            <FlightSegmentPopup
                              segment={journey}
                              departureCity={origin?.CityName || origin?.cityName || origin?.AirportCode || origin?.airportCode || ""}
                              arrivalCity={destination?.CityName || destination?.cityName || destination?.AirportCode || destination?.airportCode || ""}
                            />
                            <div className="flex-1 h-px bg-gray-300" />
                          </div>
                          <div className="text-[10px] text-gray-400">{stopsLabel}</div>
                          <FlightSeatsAvailableHint variant={selectedVariant} journeyIndex={0} />
                        </div>
                        <div className="text-center min-w-0 flex-1">
                          <div className="text-sm font-bold tabular-nums">{formatTime(destination?.DateTime || destination?.dateTime)}</div>
                          <FlightAirportDisplay
                            airportLike={destination}
                            terminal={arrivalTerminal}
                            airportClassName="text-[10px] text-gray-600 leading-tight line-clamp-2"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Fare rows */}
                    {(() => {
                      const fareKey = `ob_${groupKey}`;
                      const isExpanded = expandedFareGroups.has(fareKey);
                      const visibleVariants = isExpanded ? variants : variants.slice(0, COLLAPSED_FARE_COUNT);
                      const hiddenCount = variants.length - COLLAPSED_FARE_COUNT;
                      return (
                        <div className="border-t">
                          {visibleVariants.map((variant) => {
                            const token = variant.ResultToken || variant.resultToken;
                            const isSel = token === selToken;
                            const vPrice = variant.Price?.TotalDisplayFare || variant.price?.totalDisplayFare;
                            const isRefundable = variant.Attr?.IsRefundable ?? variant.FlightDetails?.Details?.[0]?.[0]?.Attr?.IsRefundable ?? false;
                            const fareLabel = getVariantFareLabel(variant);
                            const origIdx = onwardFlights.indexOf(variant);
                            const variantComboId = getFareCombinationId(variant);
                            return (
                              <VariantFareOptionRow
                                key={token}
                                isSelected={isSel}
                                fareLabel={fareLabel}
                                variant={variant}
                                price={vPrice}
                                isRefundable={!!isRefundable}
                                size="sm"
                                primaryColor={OG}
                                rowClassName={`px-2 py-1.5 border-b last:border-b-0 transition-colors ${
                                  isSel ? "bg-orange-50" : "hover:bg-gray-50"
                                }`}
                                onSelect={() => {
                                  setSelectedFareTokens((prev) => ({ ...prev, [fareKey]: token }));
                                  setSelectedOnwardIndex(origIdx);
                                  // Special Return: reset return when onward FareCombinationId changes.
                                  if (
                                    isSpecialReturn &&
                                    variantComboId &&
                                    variantComboId !== selectedOnwardFareCombinationId
                                  ) {
                                    setSelectedReturnIndex(null);
                                    setSelectedFareTokens((prev) => {
                                      const next: Record<string, string> = {};
                                      for (const [k, v] of Object.entries(prev)) {
                                        if (!k.startsWith("ib_")) next[k] = v;
                                      }
                                      return next;
                                    });
                                  }
                                }}
                                onCabinBaggage={() => openFareInfoModal("cabin", variant)}
                                onCheckinBaggage={() => openFareInfoModal("checkin", variant)}
                                onFareRules={() => openFareInfoModal("fareRules", variant)}
                              />
                            );
                          })}
                          {variants.length > COLLAPSED_FARE_COUNT && (
                            <button
                              onClick={() => toggleFareGroup(fareKey)}
                              className="w-full text-[10px] font-semibold py-1 border-t transition-colors hover:bg-gray-50"
                              style={{ color: OG }}
                            >
                              {isExpanded ? "▲ Show less" : `▼ ${hiddenCount} more fare${hiddenCount > 1 ? "s" : ""}`}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    <FareInclusionsExpandable
                      variants={variants}
                      selectedToken={selToken}
                      expanded={expandedFareInclusionsGroups.has(`fareInc_ob_${groupKey}`)}
                      onToggle={() => toggleFareInclusionsGroup(`fareInc_ob_${groupKey}`)}
                      onPickVariant={(variant) => {
                        const token = variant.ResultToken || variant.resultToken;
                        const origIdx = onwardFlights.indexOf(variant);
                        setSelectedFareTokens((prev) => ({ ...prev, [`ob_${groupKey}`]: token }));
                        setSelectedOnwardIndex(origIdx);
                      }}
                      primaryColor={OG}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Return Flights */}
          <div>
            <h3 className="text-sm font-bold mb-2 pb-1 border-b-2" style={{ borderColor: OG }}>
              ✈️ Return Flights ({groupedReturnFlights.length})
            </h3>
            <div className="space-y-2 max-h-[min(78vh,900px)] overflow-y-auto">
              {isSpecialReturn && selectedOnwardIndex == null ? (
                <div className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg p-4">
                  Select an onward flight to see matching return flights.
                </div>
              ) : (
                groupedReturnFlights.map(({ key: groupKey, variants }) => {
                const rep = variants[0];
                const journey = (rep.FlightDetails?.Details || rep.flightDetails?.details)?.[0] || [];
                const jx = getJourneyEndpoints(journey);
                if (!jx) return null;
                const { origin, destination, first: seg0, stopsLabel } = jx;
                const flightNum =
                  jx.legs.map((l: any) => l.FlightNumber || l.flightNumber).filter(Boolean).join(", ") ||
                  seg0?.FlightNumber ||
                  seg0?.flightNumber ||
                  "";
                const airlineCode = (seg0?.FlightNumber || seg0?.flightNumber || "").slice(0, 2) || seg0?.OperatorCode || seg0?.operatorCode || "";
                const isLCC = rep.Attr?.IsLCC ?? rep.attr?.isLCC ?? false;

                const selToken = selectedFareTokens[`ib_${groupKey}`] ||
                  (variants.find(v => returnFlights.indexOf(v) === selectedReturnIndex)?.ResultToken) ||
                  (rep.ResultToken || rep.resultToken);
                const isGroupSelected = variants.some(v => returnFlights.indexOf(v) === selectedReturnIndex);
                const selectedVariant =
                  variants.find((v) => (v.ResultToken || v.resultToken) === selToken) || rep;
                const { departureTerminal, arrivalTerminal } = getJourneyEndpointTerminals(
                  selectedVariant,
                  0,
                );
                const cabinClassLabel = getJourneyCabinClassLabel(selectedVariant, 0);
                const fareClassLabel = getJourneyFareClassLabel(selectedVariant, 0);

                return (
                  <div key={groupKey} className={`rounded-md overflow-hidden transition-all ${isGroupSelected ? "border-2 bg-orange-50" : "border border-gray-200 hover:border-gray-300"}`}
                    style={{ borderColor: isGroupSelected ? OG : undefined }}>
                    <div className="p-2">
                      <FlightAirlineInfoBlock
                        airlineCode={airlineCode}
                        operatorName={seg0?.OperatorName || seg0?.operatorName}
                        isLCC={!!isLCC}
                        cabinClassLabel={cabinClassLabel}
                        operatorCode={seg0?.OperatorCode || seg0?.operatorCode}
                        flightNum={flightNum}
                        fareClassLabel={fareClassLabel}
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-center min-w-0 flex-1">
                          <div className="text-sm font-bold tabular-nums">{formatTime(origin?.DateTime || origin?.dateTime)}</div>
                          <FlightAirportDisplay
                            airportLike={origin}
                            terminal={departureTerminal}
                            airportClassName="text-[10px] text-gray-600 leading-tight line-clamp-2"
                          />
                        </div>
                        <div className="flex-1 text-center min-w-0">
                          <div className="text-[10px] text-gray-400">{calculateDuration(origin?.DateTime || origin?.dateTime, destination?.DateTime || destination?.dateTime)}</div>
                          <div className="flex items-center gap-0.5 my-0.5">
                            <div className="flex-1 h-px bg-gray-300" />
                            <FlightSegmentPopup
                              segment={journey}
                              departureCity={origin?.CityName || origin?.cityName || origin?.AirportCode || origin?.airportCode || ""}
                              arrivalCity={destination?.CityName || destination?.cityName || destination?.AirportCode || destination?.airportCode || ""}
                            />
                            <div className="flex-1 h-px bg-gray-300" />
                          </div>
                          <div className="text-[10px] text-gray-400">{stopsLabel}</div>
                          <FlightSeatsAvailableHint variant={selectedVariant} journeyIndex={0} />
                        </div>
                        <div className="text-center min-w-0 flex-1">
                          <div className="text-sm font-bold tabular-nums">{formatTime(destination?.DateTime || destination?.dateTime)}</div>
                          <FlightAirportDisplay
                            airportLike={destination}
                            terminal={arrivalTerminal}
                            airportClassName="text-[10px] text-gray-600 leading-tight line-clamp-2"
                          />
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const fareKey = `ib_${groupKey}`;
                      const isExpanded = expandedFareGroups.has(fareKey);
                      const visibleVariants = isExpanded ? variants : variants.slice(0, COLLAPSED_FARE_COUNT);
                      const hiddenCount = variants.length - COLLAPSED_FARE_COUNT;
                      return (
                        <div className="border-t">
                          {visibleVariants.map((variant) => {
                            const token = variant.ResultToken || variant.resultToken;
                            const isSel = token === selToken;
                            const vPrice = variant.Price?.TotalDisplayFare || variant.price?.totalDisplayFare;
                            const isRefundable = variant.Attr?.IsRefundable ?? variant.FlightDetails?.Details?.[0]?.[0]?.Attr?.IsRefundable ?? false;
                            const fareLabel = getVariantFareLabel(variant);
                            const origIdx = returnFlights.indexOf(variant);
                            return (
                              <VariantFareOptionRow
                                key={token}
                                isSelected={isSel}
                                fareLabel={fareLabel}
                                variant={variant}
                                price={vPrice}
                                isRefundable={!!isRefundable}
                                size="sm"
                                primaryColor={OG}
                                rowClassName={`px-2 py-1.5 border-b last:border-b-0 transition-colors ${
                                  isSel ? "bg-orange-50" : "hover:bg-gray-50"
                                }`}
                                onSelect={() => {
                                  setSelectedFareTokens((prev) => ({ ...prev, [fareKey]: token }));
                                  setSelectedReturnIndex(origIdx);
                                }}
                                onCabinBaggage={() => openFareInfoModal("cabin", variant)}
                                onCheckinBaggage={() => openFareInfoModal("checkin", variant)}
                                onFareRules={() => openFareInfoModal("fareRules", variant)}
                              />
                            );
                          })}
                          {variants.length > COLLAPSED_FARE_COUNT && (
                            <button
                              onClick={() => toggleFareGroup(fareKey)}
                              className="w-full text-[10px] font-semibold py-1 border-t transition-colors hover:bg-gray-50"
                              style={{ color: OG }}
                            >
                              {isExpanded ? "▲ Show less" : `▼ ${hiddenCount} more fare${hiddenCount > 1 ? "s" : ""}`}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    <FareInclusionsExpandable
                      variants={variants}
                      selectedToken={selToken}
                      expanded={expandedFareInclusionsGroups.has(`fareInc_ib_${groupKey}`)}
                      onToggle={() => toggleFareInclusionsGroup(`fareInc_ib_${groupKey}`)}
                      onPickVariant={(variant) => {
                        const token = variant.ResultToken || variant.resultToken;
                        const origIdx = returnFlights.indexOf(variant);
                        setSelectedFareTokens((prev) => ({ ...prev, [`ib_${groupKey}`]: token }));
                        setSelectedReturnIndex(origIdx);
                      }}
                      primaryColor={OG}
                    />
                  </div>
                );
              })
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
      {renderFareInfoModals()}
      {priceChangedModal}
      </>
    );
  }

  return (
    <>
    {searchCriteriaBanner}
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {filterSidebar}


      {/* Main Results Panel */}
      <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 flex-1 min-w-0">
        {/* Header showing trip type and route */}
        {isType2RoundtripPaired && (
          <div className="rounded-lg overflow-hidden shadow border border-orange-100 mb-3">
            <div style={{ background: `linear-gradient(135deg, ${OG} 0%, #ff8c38 100%)` }} className="px-4 py-2 flex items-center justify-between">
              <div className="text-white">
                <div className="text-[10px] font-semibold opacity-80 uppercase tracking-wider">Round Trip</div>
                <div className="font-bold text-sm sm:text-base leading-tight">
                  {criteriaOriginLabel || "—"}
                  {" "}↔{" "}
                  {criteriaDestinationLabel || "—"}
                </div>
              </div>
              <span className="text-2xl">✈️</span>
            </div>
          </div>
        )}

        {isType2RoundtripPaired && (
          <h2 className="text-xs font-semibold mb-1.5 text-gray-700">Select Paired Flights</h2>
        )}
        <div className="text-xs text-gray-500 mb-2">
          {totalFlightGroups === 0 ? (
            <>No flights match your filters. Adjust or clear filters to see more results.</>
          ) : (
            <>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, totalFlightGroups)} of{" "}
              {totalFlightGroups} flight{totalFlightGroups === 1 ? "" : "s"}
            </>
          )}
        </div>

        <div className="space-y-2">
          {pagedGroups.map(({ key: groupKey, variants }, groupIdx) => {
            const rep = variants[0];

            const actualIndex = (safePage - 1) * PAGE_SIZE + groupIdx;
            const isBookingThisGroup = loadingFlightIndex === actualIndex;
            const isHoldingThisGroup = holdingFlightIndex === actualIndex;
            const isLoadingThisGroup = isBookingThisGroup || isHoldingThisGroup;

            const selToken = selectedFareTokens[groupKey] || (rep.ResultToken || rep.resultToken);
            const selectedVariant = variants.find(v => (v.ResultToken || v.resultToken) === selToken) || rep;

            const flightDetails = selectedVariant.FlightDetails?.Details || selectedVariant.flightDetails?.details
              || rep.FlightDetails?.Details || rep.flightDetails?.details;
            if (!flightDetails) return null;

            const isGroupFullService = !(selectedVariant.Attr?.IsLCC ?? selectedVariant.attr?.isLCC ?? false);

            return (
              <div
                key={groupKey}
                className={`border-2 border-gray-300 rounded-lg hover:shadow-md transition-shadow ${isType2RoundtripPaired ? "p-2" : "p-2.5"}`}
              >
                <div className={`flex items-stretch ${isType2RoundtripPaired ? "gap-2" : "gap-3"}`}>

                  {/* Left: flight info */}
                  <div className="flex-1 min-w-0">
                    {flightDetails.map((journeyLegs: any, segmentIndex: number) => {
                      const jx = getJourneyEndpoints(journeyLegs);
                      if (!jx) return null;
                      const flightDetail = jx.first;
                      const origin = jx.origin;
                      const destination = jx.destination;
                      const { stopsLabel } = jx;
                      if (!flightDetail || !origin || !destination) return null;
                      const isLCC = selectedVariant.Attr?.IsLCC ?? selectedVariant.attr?.isLCC ?? false;
                      const { departureTerminal, arrivalTerminal } = getJourneyEndpointTerminals(
                        selectedVariant,
                        segmentIndex,
                      );
                      const cabinClassLabel = getJourneyCabinClassLabel(
                        selectedVariant,
                        segmentIndex,
                      );
                      const fareClassLabel = getJourneyFareClassLabel(
                        selectedVariant,
                        segmentIndex,
                      );
                      const flightNum =
                        jx.legs.map((l: any) => l.FlightNumber || l.flightNumber).filter(Boolean).join(", ") ||
                        flightDetail.FlightNumber ||
                        flightDetail.flightNumber ||
                        "";
                      const airlineCode =
                        (flightDetail.FlightNumber || flightDetail.flightNumber || "").slice(0, 2) ||
                        flightDetail.OperatorCode ||
                        flightDetail.operatorCode ||
                        "";
                      return (
                        <div
                          key={segmentIndex}
                          className={segmentIndex > 0 ? "mt-2 pt-2 border-t-2 border-orange-300" : ""}
                        >
                          <div className="flex items-center gap-3">
                            {/* Airline (left) */}
                            <div className="min-w-[160px] shrink-0">
                              <FlightAirlineInfoBlock
                                airlineCode={airlineCode}
                                operatorName={flightDetail.OperatorName || flightDetail.operatorName}
                                isLCC={!!isLCC}
                                cabinClassLabel={cabinClassLabel}
                                operatorCode={flightDetail.OperatorCode || flightDetail.operatorCode}
                                flightNum={flightNum}
                                fareClassLabel={fareClassLabel}
                              />
                            </div>

                            {/* Route (middle) */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-center gap-2">
                                <div className="text-center min-w-0 max-w-[120px]">
                                  <div className="text-base font-bold leading-none">{formatTime(origin.DateTime || origin.dateTime)}</div>
                                  <FlightAirportDisplay
                                    airportLike={origin}
                                    terminal={departureTerminal}
                                    airportClassName="text-[11px] text-gray-500 leading-tight truncate"
                                  />
                                </div>
                                <div className="flex-1 text-center">
                                  <div className="text-[10px] text-gray-500">
                                    {calculateDuration(origin.DateTime || origin.dateTime, destination.DateTime || destination.dateTime)}
                                    {" · "}
                                    {stopsLabel}
                                  </div>
                                  <div className="flex items-center gap-1 my-0.5">
                                    <div className="flex-1 h-px bg-gray-300" />
                                    <FlightSegmentPopup
                                      segment={journeyLegs}
                                      departureCity={origin?.CityName || origin?.cityName || origin?.AirportCode || origin?.airportCode || ""}
                                      arrivalCity={destination?.CityName || destination?.cityName || destination?.AirportCode || destination?.airportCode || ""}
                                    />
                                    <div className="flex-1 h-px bg-gray-300" />
                                  </div>
                                  <FlightSeatsAvailableHint
                                    variant={selectedVariant}
                                    journeyIndex={segmentIndex}
                                  />
                                </div>
                                <div className="text-center min-w-0 max-w-[120px]">
                                  <div className="text-base font-bold leading-none">{formatTime(destination.DateTime || destination.dateTime)}</div>
                                  <FlightAirportDisplay
                                    airportLike={destination}
                                    terminal={arrivalTerminal}
                                    airportClassName="text-[11px] text-gray-500 leading-tight truncate"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Onward/Return (right) */}
                            {isType2RoundtripPaired && flightDetails.length > 1 && (
                              <div className="text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap"
                                style={{ color: OG, borderColor: `${OG}55`, background: `${OG}10` }}>
                                {segmentIndex === 0 ? "Onward" : "Return"}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right: fare variants */}
                  {(() => {
                    const isExpanded = expandedFareGroups.has(groupKey);
                    const visibleVariants = isExpanded ? variants : variants.slice(0, COLLAPSED_FARE_COUNT);
                    const hiddenCount = variants.length - COLLAPSED_FARE_COUNT;
                    return (
                      <div className="flex flex-col justify-center gap-0.5 border-l pl-3 min-w-[248px]">
                        {visibleVariants.map((variant) => {
                          const token = variant.ResultToken || variant.resultToken;
                          const isSel = token === selToken;
                          const vPrice = variant.Price?.TotalDisplayFare || variant.price?.totalDisplayFare;
                          const isRefundable = variant.Attr?.IsRefundable ?? variant.FlightDetails?.Details?.[0]?.[0]?.Attr?.IsRefundable ?? false;
                          const fareLabel = getVariantFareLabel(variant);
                          return (
                            <VariantFareOptionRow
                              key={token}
                              isSelected={isSel}
                              fareLabel={fareLabel}
                              variant={variant}
                              price={vPrice}
                              isRefundable={!!isRefundable}
                              primaryColor={OG}
                              rowClassName={`px-2 py-1.5 rounded-lg transition-colors ${
                                isSel ? "bg-orange-50 ring-1 ring-orange-300" : "hover:bg-gray-50"
                              }`}
                              onSelect={() =>
                                setSelectedFareTokens((prev) => ({ ...prev, [groupKey]: token }))
                              }
                              onCabinBaggage={() => openFareInfoModal("cabin", variant)}
                              onCheckinBaggage={() => openFareInfoModal("checkin", variant)}
                              onFareRules={() => openFareInfoModal("fareRules", variant)}
                            />
                          );
                        })}
                        {variants.length > COLLAPSED_FARE_COUNT && (
                          <button
                            onClick={() => toggleFareGroup(groupKey)}
                            className="mt-0.5 text-[10px] font-semibold text-center py-0.5 rounded hover:bg-gray-100 transition-colors"
                            style={{ color: OG }}
                          >
                            {isExpanded ? "▲ Show less" : `▼ ${hiddenCount} more fare${hiddenCount > 1 ? "s" : ""}`}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Book button */}
                  <div className="flex flex-col items-stretch gap-1.5 pl-2 justify-center">
                    <button
                      onClick={() => isType2RoundtripPaired
                        ? handleSelectType2Roundtrip(selectedVariant, actualIndex)
                        : handleSelectOneway(selectedVariant, actualIndex)}
                      disabled={isLoadingThisGroup}
                      className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 font-semibold text-sm whitespace-nowrap"
                    >
                      {isBookingThisGroup ? "Loading..." : "Book"}
                    </button>
                  </div>

                </div>
                <FareInclusionsExpandable
                  variants={variants}
                  selectedToken={selToken}
                  expanded={expandedFareInclusionsGroups.has(`fareInc_${groupKey}`)}
                  onToggle={() => toggleFareInclusionsGroup(`fareInc_${groupKey}`)}
                  onPickVariant={(variant) => {
                    const token = variant.ResultToken || variant.resultToken;
                    setSelectedFareTokens((prev) => ({ ...prev, [groupKey]: token }));
                  }}
                  primaryColor={OG}
                />
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              ← Previous
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                // Show first page, last page, current page, and pages around current
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= safePage - 1 && pageNum <= safePage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-2 rounded-lg ${
                        pageNum === safePage
                          ? "bg-primary text-white font-bold"
                          : "border hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (pageNum === safePage - 2 || pageNum === safePage + 2) {
                  return <span key={pageNum} className="px-2">...</span>;
                }
                return null;
              })}
            </div>

            <button
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
    {renderFareInfoModals()}
    {priceChangedModal}
    </>
  );
}
