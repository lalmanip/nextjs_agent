"use client";
import { useState } from "react";
import { flightAPI } from "@/lib/api";
import { buildFlightDetailsFromPriced, formatAirportWithCity } from "@/lib/flightDisplay";
import { formatUserDate } from "@/lib/dateLocale";

interface AdvanceSearchResultsProps {
  results: any;
  passengers: { adults: number; children: number; infants: number };
  domainToken: string;
  onBack: () => void;
  onSelectFlight: (flight: any) => void;
  onDateShift?: (deltaDays: number) => void | Promise<void>;
  dateShiftLoading?: boolean;
}

type AdvanceLeg = "ob" | "ib";

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function resultKey(leg: AdvanceLeg, result: any, idx: number): string {
  const token = String(result?.ResultToken || result?.ResultIndex || idx).trim();
  return `${leg}:${token}`;
}

function findFlightByKey(flights: any[], leg: AdvanceLeg, key: string | null): any | null {
  if (!key) return null;
  for (let idx = 0; idx < flights.length; idx++) {
    if (resultKey(leg, flights[idx], idx) === key) return flights[idx];
  }
  return null;
}

function formatAdvanceTime(dt: string) {
  if (!dt) return "";
  return new Date(dt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function AdvanceSearchResults({
  results,
  passengers,
  domainToken,
  onBack,
  onSelectFlight,
  onDateShift,
  dateShiftLoading,
}: AdvanceSearchResultsProps) {
  const response = results?.Response || results?.response;

  const errorCode = response?.Error?.ErrorCode;
  const errorMessage = response?.Error?.ErrorMessage || "An error occurred";

  if (errorCode !== null && errorCode !== undefined && errorCode !== 0 && errorCode !== "0") {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden p-8">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
          <div className="text-gray-700 mb-4">{errorMessage}</div>
          <button onClick={onBack} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const onwardFlights: any[] = response?.Results?.[0] || [];
  const returnFlights: any[] = response?.Results?.[1] || [];
  const isAdvanceReturn = returnFlights.length > 0;

  const origin = response?.Origin || "";
  const destination = response?.Destination || "";
  const firstDepTime = onwardFlights[0]?.Segments?.[0]?.[0]?.Origin?.DepTime || "";
  const tripDate = firstDepTime
    ? formatUserDate(firstDepTime, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  const [localPassengers, setLocalPassengers] = useState({
    adults: passengers.adults,
    children: passengers.children,
    infants: passengers.infants,
  });

  const updatePassenger = (key: "adults" | "children" | "infants", val: number) => {
    setLocalPassengers((prev) => ({ ...prev, [key]: val }));
  };

  const [fStops, setFStops] = useState<Set<number>>(new Set());
  const [fFlightNum, setFFlightNum] = useState("");
  const [fTimes, setFTimes] = useState<Set<string>>(new Set());
  const [fAirlines, setFAirlines] = useState<Set<string>>(new Set());
  const [fRestrict, setFRestrict] = useState(false);

  const [expandedObKey, setExpandedObKey] = useState<string | null>(null);
  const [expandedIbKey, setExpandedIbKey] = useState<string | null>(null);
  const [pricingKey, setPricingKey] = useState<string | null>(null);
  const [bookingKey, setBookingKey] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<Record<string, string>>({});
  const [selectedSeats, setSelectedSeats] = useState<Record<string, string>>({});
  const [pricedResults, setPricedResults] = useState<Record<string, any>>({});
  const [selectedOnwardKey, setSelectedOnwardKey] = useState<string | null>(null);
  const [selectedReturnKey, setSelectedReturnKey] = useState<string | null>(null);

  const formatTime = (dt: string) =>
    new Date(dt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  const formatDurationMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  };

  const totalDuration = (result: any) => {
    const segs: any[] = result.Segments?.[0] || [];
    return formatDurationMins(segs.reduce((s: number, seg: any) => s + (seg.Duration || 0), 0));
  };

  const stopCount = (result: any) => (result.Segments?.[0]?.length || 1) - 1;

  const getTimeKey = (dt: string) => {
    const h = new Date(dt).getHours();
    if (h >= 4 && h < 11) return "morning";
    if (h >= 11 && h < 16) return "afternoon";
    if (h >= 16 && h < 21) return "evening";
    return "night";
  };

  const applyFilters = (flights: any[]) =>
    flights.filter((r: any) => {
      const segs: any[] = r.Segments?.[0] || [];
      const firstSeg = segs[0];
      if (fStops.size > 0 && !fStops.has(stopCount(r))) return false;
      if (fFlightNum.trim()) {
        const q = fFlightNum.trim().toLowerCase();
        const match = segs.some(
          (s: any) =>
            s.Airline?.FlightNumber?.toLowerCase().includes(q) ||
            `${s.Airline?.AirlineCode}${s.Airline?.FlightNumber}`.toLowerCase().includes(q),
        );
        if (!match) return false;
      }
      if (fTimes.size > 0 && !fTimes.has(getTimeKey(firstSeg?.Origin?.DepTime || ""))) return false;
      if (fAirlines.size > 0 && !fAirlines.has(firstSeg?.Airline?.AirlineCode || "")) return false;
      return true;
    });

  const filteredOnward = applyFilters(onwardFlights);
  const filteredReturn = isAdvanceReturn ? applyFilters(returnFlights) : [];

  const airlineMap: Record<string, string> = {};
  [...onwardFlights, ...returnFlights].forEach((r: any) => {
    const seg = r.Segments?.[0]?.[0];
    if (seg?.Airline?.AirlineCode) {
      airlineMap[seg.Airline.AirlineCode] = seg.Airline.AirlineName || seg.Airline.AirlineCode;
    }
  });
  const airlineList = Object.entries(airlineMap).map(([code, name]) => ({ code, name }));

  const togStop = (n: number) => {
    const s = new Set(fStops);
    s.has(n) ? s.delete(n) : s.add(n);
    setFStops(s);
  };
  const togTime = (k: string) => {
    const s = new Set(fTimes);
    s.has(k) ? s.delete(k) : s.add(k);
    setFTimes(s);
  };
  const togAirline = (c: string) => {
    const s = new Set(fAirlines);
    s.has(c) ? s.delete(c) : s.add(c);
    setFAirlines(s);
  };
  const clearFilters = () => {
    setFStops(new Set());
    setFFlightNum("");
    setFTimes(new Set());
    setFAirlines(new Set());
    setFRestrict(false);
  };

  const clearReturnSelection = () => {
    setSelectedReturnKey(null);
    setPricedResults((p) => {
      const next = { ...p };
      for (const k of Object.keys(next)) {
        if (k.startsWith("ib:")) delete next[k];
      }
      return next;
    });
    setSelectedClass((p) => {
      const next = { ...p };
      for (const k of Object.keys(next)) {
        if (k.startsWith("ib:")) delete next[k];
      }
      return next;
    });
    setSelectedSeats((p) => {
      const next = { ...p };
      for (const k of Object.keys(next)) {
        if (k.startsWith("ib:")) delete next[k];
      }
      return next;
    });
  };

  const clearLegSelection = (leg: AdvanceLeg, key: string) => {
    if (leg === "ob" && selectedOnwardKey === key) {
      setSelectedOnwardKey(null);
      clearReturnSelection();
    }
    if (leg === "ib" && selectedReturnKey === key) {
      setSelectedReturnKey(null);
    }
  };

  const selectClass = (key: string, leg: AdvanceLeg, cls: string, seats: string) => {
    if (selectedClass[key] === cls) {
      setSelectedClass((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
      setSelectedSeats((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
      setPricedResults((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
      clearLegSelection(leg, key);
    } else {
      setSelectedClass((p) => ({ ...p, [key]: cls }));
      setSelectedSeats((p) => ({ ...p, [key]: seats }));
      setPricedResults((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
      clearLegSelection(leg, key);
    }
  };

  const selectPricedFlight = (key: string, leg: AdvanceLeg) => {
    if (!pricedResults[key]) {
      alert("Please price this flight before selecting it.");
      return;
    }
    if (leg === "ob") {
      if (selectedOnwardKey !== key) clearReturnSelection();
      setSelectedOnwardKey(key);
    } else {
      setSelectedReturnKey(key);
    }
  };

  const handlePriceFlight = async (result: any, key: string) => {
    const cls = selectedClass[key];
    if (!cls) {
      alert("Please select a class first.");
      return;
    }
    setPricingKey(key);
    try {
      const resultToken =
        result.ResultToken || result.ResultIndex || result.resultToken || result.resultIndex;
      const priceRes = await flightAPI.priceAdvancedFlight(
        resultToken,
        cls,
        domainToken,
        localPassengers.adults,
        localPassengers.children,
        localPassengers.infants,
      );

      const errCode = priceRes?.Response?.Error?.ErrorCode;
      const errMsg = priceRes?.Response?.Error?.ErrorMessage;
      if (errCode !== null && errCode !== undefined && errCode !== 0 && errCode !== "0") {
        alert(errMsg || "Failed to price flight");
        return;
      }

      const pricedFlight = priceRes?.Response?.Results?.[0]?.[0];
      if (!pricedFlight) throw new Error("No priced result in response");
      setPricedResults((p) => ({ ...p, [key]: pricedFlight }));
      if (key.startsWith("ob:")) setExpandedObKey(key);
      if (key.startsWith("ib:")) setExpandedIbKey(key);
    } catch (e: unknown) {
      console.error("Price Flight error:", e);
      alert(`Failed to get fare: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPricingKey(null);
    }
  };

  const handleBookNow = async (result: any, key: string) => {
    const priced = pricedResults[key];
    if (!priced) return;
    setBookingKey(key);
    try {
      const resultToken = priced.ResultToken || result.ResultIndex;
      const fareQuoteResponse = await flightAPI.updateFareQuote(resultToken, domainToken);
      if (fareQuoteResponse?.Status === 0 || fareQuoteResponse?.Status === "0") {
        alert(fareQuoteResponse.Message || "Fare quote failed. Please try again.");
        return;
      }
      onSelectFlight({
        resultToken,
        domainToken,
        fareQuoteData: fareQuoteResponse,
        flightDetails: buildFlightDetailsFromPriced(priced),
        price: { totalDisplayFare: priced.Fare?.PublishedFare || 0 },
        attr: { isLCC: priced.IsLCC },
      });
    } catch (e: unknown) {
      console.error("Fare quote error:", e);
      alert(`Failed to get fare quote: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBookingKey(null);
    }
  };

  const handleBookRoundtrip = async () => {
    if (!selectedOnwardKey || !selectedReturnKey) {
      alert("Please select onward and return flights (price each, then use Select this Flight).");
      return;
    }
    const onwardPriced = pricedResults[selectedOnwardKey];
    const returnPriced = pricedResults[selectedReturnKey];
    if (!onwardPriced || !returnPriced) {
      alert("Selected flights must be priced before continuing. Price again if needed.");
      return;
    }
    setBookingKey("roundtrip");
    try {
      const onwardToken = onwardPriced.ResultToken;
      const returnToken = returnPriced.ResultToken;
      const obFareQuote = await flightAPI.updateFareQuote(onwardToken, domainToken);
      if (obFareQuote?.Status === 0 || obFareQuote?.Status === "0") {
        alert(obFareQuote.Message || "Onward fare quote failed.");
        return;
      }
      const ibFareQuote = await flightAPI.updateFareQuote(returnToken, domainToken);
      if (ibFareQuote?.Status === 0 || ibFareQuote?.Status === "0") {
        alert(ibFareQuote.Message || "Return fare quote failed.");
        return;
      }
      const obFare = onwardPriced.Fare?.PublishedFare || 0;
      const ibFare = returnPriced.Fare?.PublishedFare || 0;
      onSelectFlight({
        resultToken: onwardToken,
        returnResultToken: returnToken,
        domainToken,
        fareQuoteData: obFareQuote,
        returnFareQuoteData: ibFareQuote,
        advanceRoundtrip: true,
        selectedOnward: onwardPriced,
        selectedReturn: returnPriced,
        flightDetails: buildFlightDetailsFromPriced(onwardPriced),
        returnFlightDetails: buildFlightDetailsFromPriced(returnPriced),
        price: {
          totalDisplayFare: obFare + ibFare,
          TotalDisplayFare: obFare + ibFare,
        },
        attr: { isLCC: onwardPriced.IsLCC || returnPriced.IsLCC },
      });
    } catch (e: unknown) {
      console.error("Advance return booking error:", e);
      alert(`Failed to continue: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBookingKey(null);
    }
  };

  const OG = "#FC6603";

  const renderFlightList = (
    flights: any[],
    leg: AdvanceLeg,
    title: string,
    sideBySide = false,
  ) => {
    const gridCols = sideBySide
      ? "minmax(0,1fr) minmax(0,1.1fr) 64px 32px"
      : "1fr 220px 120px 40px";

    return (
    <div className={`flex flex-col min-w-0 h-full ${sideBySide ? "" : ""}`}>
      <div
        className={`px-3 py-2 border-b font-semibold text-sm shrink-0 ${sideBySide ? "bg-orange-50 text-gray-800" : "bg-gray-100 text-gray-800"}`}
        style={sideBySide ? { borderBottomColor: OG, borderBottomWidth: 2 } : undefined}
      >
        {title}
      </div>
      <div
        className={`grid text-xs font-semibold text-gray-500 uppercase border-b shrink-0 ${sideBySide ? "px-2 py-1.5" : "px-4 py-2"}`}
        style={{ gridTemplateColumns: gridCols }}
      >
        <div />
        <div>{sideBySide ? "Route" : "Departure ▲   Arrival ▲"}</div>
        <div>{sideBySide ? "Dur." : "Duration ▲"}</div>
        <div />
      </div>
      <div className={sideBySide ? "overflow-y-auto max-h-[min(78vh,900px)]" : ""}>

      {flights.length === 0 && (
        <div className={`text-center text-gray-500 ${sideBySide ? "p-6 text-xs" : "p-8"}`}>
          No flights match your filters.
        </div>
      )}

      {flights.map((result: any, idx: number) => {
        const key = resultKey(leg, result, idx);
        const segs: any[] = result.Segments?.[0] || [];
        const isExpanded = leg === "ob" ? expandedObKey === key : expandedIbKey === key;
        const isPricing = pricingKey === key;
        const isBooking = bookingKey === key;
        const dur = totalDuration(result);
        const availability: any[] = segs[0]?.Availability || [];
        const cls = selectedClass[key];
        const seats = selectedSeats[key];
        const priced = pricedResults[key];
        const isSelectedLeg =
          (leg === "ob" && selectedOnwardKey === key) || (leg === "ib" && selectedReturnKey === key);

        return (
          <div
            key={key}
            className={`border-b ${isSelectedLeg ? "bg-orange-50/60" : ""}`}
          >
            {segs.map((seg: any, si: number) => {
              const airlineCode = seg.Airline?.AirlineCode || "";
              const depTime = seg.Origin?.DepTime ? formatTime(seg.Origin.DepTime) : "";
              const arrTime = seg.Destination?.ArrTime ? formatTime(seg.Destination.ArrTime) : "";
              const depLabel = formatAirportWithCity(seg.Origin?.Airport) || seg.Origin?.Airport?.AirportCode || "";
              const arrLabel =
                formatAirportWithCity(seg.Destination?.Airport) || seg.Destination?.Airport?.AirportCode || "";

              return (
                <div
                  key={si}
                  className={`grid items-center hover:bg-blue-50 transition-colors ${si === 0 ? "bg-white" : "bg-gray-50"} ${sideBySide ? "px-2 py-1.5" : "px-4 py-2"}`}
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={`/airlines/${airlineCode}.gif`}
                      alt={airlineCode}
                      className="w-8 h-8 object-contain rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div>
                      <div className="font-semibold text-sm text-gray-800">
                        {seg.Airline?.AirlineName || airlineCode}
                      </div>
                      <div className="text-xs text-blue-600 font-medium">
                        {airlineCode} - {seg.Airline?.FlightNumber}
                      </div>
                      {isSelectedLeg && (
                        <span
                          className="inline-block mt-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: OG }}
                        >
                          Selected
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`text-gray-800 ${sideBySide ? "text-[11px] leading-snug" : "text-sm"}`}>
                    <span className="font-bold">{depLabel}</span>
                    {depTime && <span className="text-gray-600"> ({depTime})</span>}
                    <span className="mx-0.5">→</span>
                    <span className="font-bold">{arrLabel}</span>
                    {arrTime && <span className="text-gray-600"> ({arrTime})</span>}
                  </div>
                  <div className="text-sm text-gray-700">{si === 0 ? dur : ""}</div>
                  {si === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (leg === "ob") {
                          setExpandedObKey(isExpanded ? null : key);
                        } else {
                          setExpandedIbKey(isExpanded ? null : key);
                        }
                      }}
                      className="w-7 h-7 border rounded flex items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-xs"
                    >
                      {isExpanded ? "▲" : "▼"}
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              );
            })}

            {isExpanded && (
              <div className={`bg-gray-50 border-t space-y-3 ${sideBySide ? "px-2 py-2" : "px-4 py-3"}`}>
                <div className="flex flex-wrap gap-1.5">
                  {availability.map((av: any) => (
                    <button
                      key={av.Class}
                      type="button"
                      onClick={() => selectClass(key, leg, av.Class, av.Seats)}
                      className={`text-xs font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        cls === av.Class
                          ? "bg-yellow-200 text-yellow-900 border-yellow-500"
                          : "text-blue-600 border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                      }`}
                    >
                      {av.Class}
                      {av.Seats}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    {cls && (
                      <span className="px-3 py-1 text-xs border border-yellow-400 bg-yellow-50 text-yellow-900 rounded font-medium">
                        {seats} Seat(s) in {cls} Class
                      </span>
                    )}
                    {priced?.Fare && (
                      <span className="text-sm text-gray-500">
                        Published:
                        <span className="font-semibold text-gray-800 ml-1">
                          ₹{fmt.format(priced.Fare.PublishedFare ?? 0)}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => void handlePriceFlight(result, key)}
                      disabled={isPricing || !cls}
                      title={!cls ? "Select a class first" : ""}
                      className="px-5 py-2 rounded text-white text-sm font-semibold transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: "#1e3a5f" }}
                    >
                      {isPricing ? "Loading..." : "Price this Flight"}
                    </button>
                    {isAdvanceReturn && priced && (
                      <button
                        type="button"
                        onClick={() => selectPricedFlight(key, leg)}
                        disabled={isSelectedLeg}
                        className="px-5 py-2 rounded text-white text-sm font-semibold transition-opacity disabled:opacity-70"
                        style={{
                          backgroundColor: isSelectedLeg ? "#16a34a" : OG,
                        }}
                      >
                        {isSelectedLeg ? "Selected ✓" : "Select this Flight"}
                      </button>
                    )}
                    {!isAdvanceReturn && priced && (
                      <button
                        type="button"
                        onClick={() => void handleBookNow(result, key)}
                        disabled={isBooking}
                        className="px-5 py-2 rounded text-white text-sm font-semibold disabled:opacity-50"
                        style={{ backgroundColor: "#1e3a5f" }}
                      >
                        {isBooking ? "Loading..." : "Book Now"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
    );
  };

  const canContinueRoundtrip =
    isAdvanceReturn && !!selectedOnwardKey && !!selectedReturnKey;

  const selectedTotalFare = (() => {
    if (!selectedOnwardKey || !selectedReturnKey) return 0;
    const ob = pricedResults[selectedOnwardKey];
    const ib = pricedResults[selectedReturnKey];
    const obFare = Number(ob?.Fare?.PublishedFare ?? 0) || 0;
    const ibFare = Number(ib?.Fare?.PublishedFare ?? 0) || 0;
    return obFare + ibFare;
  })();

  const renderSelectedFlightSummary = (
    label: string,
    leg: AdvanceLeg,
    selectedKey: string | null,
    flights: any[],
  ) => {
    const result = findFlightByKey(flights, leg, selectedKey);
    const priced = selectedKey ? pricedResults[selectedKey] : null;
    const seg = result?.Segments?.[0]?.[0];
    const fare = priced?.Fare?.PublishedFare;
    const isSelected = !!selectedKey;

    return (
      <div
        className="rounded-lg p-2 border-2 min-w-[12rem] flex-1 max-w-md"
        style={{ borderColor: isSelected ? OG : "#e5e7eb", background: isSelected ? "#fff7ed" : "#f9fafb" }}
      >
        <div className="text-[10px] font-semibold text-gray-500 mb-0.5">{label}</div>
        {isSelected && seg && priced ? (
          <div className="text-xs">
            <div className="font-semibold text-gray-800 leading-tight">
              {seg.Airline?.AirlineName || seg.Airline?.AirlineCode}{" "}
              {seg.Airline?.AirlineCode}-{seg.Airline?.FlightNumber}
            </div>
            <div className="text-gray-600 mt-0.5">
              {formatAirportWithCity(seg.Origin?.Airport)}{" "}
              {formatAdvanceTime(seg.Origin?.DepTime)}
              {" → "}
              {formatAirportWithCity(seg.Destination?.Airport)}{" "}
              {formatAdvanceTime(seg.Destination?.ArrTime)}
            </div>
            {selectedClass[selectedKey!] && (
              <div className="text-[10px] text-gray-500 mt-0.5">
                Class {selectedClass[selectedKey!]}
              </div>
            )}
            <div className="font-bold mt-0.5" style={{ color: OG }}>
              ₹{fmt.format(fare || 0)}
            </div>
          </div>
        ) : isSelected && seg ? (
          <div className="text-xs text-gray-600">
            <div className="font-semibold text-gray-800 leading-tight">
              {seg.Airline?.AirlineName || seg.Airline?.AirlineCode}{" "}
              {seg.Airline?.AirlineCode}-{seg.Airline?.FlightNumber}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5 italic">Price again to refresh fare</div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">Not selected</div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="flex items-center border-b text-sm">
        <div className="px-4 py-3 font-semibold text-gray-700 border-r bg-gray-50 whitespace-nowrap">
          Your Search Criteria
        </div>
        <div className="px-4 py-3 text-blue-600 font-medium flex-1">
          {isAdvanceReturn ? (
            <>
              {origin} ↔ {destination}
            </>
          ) : (
            <>
              {origin} → {destination}
            </>
          )}
          {tripDate && <span className="text-gray-600 ml-1">, {tripDate}</span>}
        </div>
        {onDateShift && (
          <div className="flex items-center gap-2 px-3 py-3 border-l text-sm">
            <button
              type="button"
              disabled={dateShiftLoading}
              onClick={() => void onDateShift(-1)}
              className="text-blue-600 font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Prev day
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              disabled={dateShiftLoading}
              onClick={() => void onDateShift(1)}
              className="text-blue-600 font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next day →
            </button>
          </div>
        )}
        <button
          onClick={onBack}
          className="px-4 py-3 text-blue-600 underline hover:text-blue-800 whitespace-nowrap text-sm border-l"
        >
          Modify Search
        </button>
      </div>

      <div className="bg-blue-50 border-b px-4 py-2 text-sm text-gray-700">
        {isAdvanceReturn ? (
          <>
            Onward: {filteredOnward.length} result{filteredOnward.length !== 1 ? "s" : ""}
            {" · "}
            Return: {filteredReturn.length} result{filteredReturn.length !== 1 ? "s" : ""}
            {" · "}
            Select onward and return flights to continue
          </>
        ) : (
          <>
            Showing {filteredOnward.length} Result{filteredOnward.length !== 1 ? "s" : ""}.
          </>
        )}
      </div>

      {isAdvanceReturn && (
        <div className="px-4 py-3 border-b bg-orange-50 space-y-2">
          <div className="flex flex-col md:flex-row md:items-stretch gap-2">
            {renderSelectedFlightSummary("✈️ Selected Onward", "ob", selectedOnwardKey, filteredOnward)}
            {renderSelectedFlightSummary("✈️ Selected Return", "ib", selectedReturnKey, filteredReturn)}
            <div className="flex flex-col justify-center md:ml-auto shrink-0">
              {canContinueRoundtrip && (
                <div className="text-right mb-1">
                  <div className="text-[10px] font-semibold text-gray-500">Total Fare</div>
                  <div className="font-bold" style={{ color: OG }}>
                    ₹{fmt.format(selectedTotalFare || 0)}
                  </div>
                </div>
              )}
              <button
                type="button"
                disabled={!canContinueRoundtrip || bookingKey === "roundtrip"}
                onClick={() => void handleBookRoundtrip()}
                className="px-4 py-2 rounded text-white text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
                style={{ backgroundColor: OG }}
              >
                {bookingKey === "roundtrip" ? "Loading..." : "Continue to Booking →"}
              </button>
              {!canContinueRoundtrip && (
                <p className="text-[10px] text-gray-500 mt-1 text-center md:text-right max-w-[14rem]">
                  Price and select both onward and return flights to continue.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6 px-4 py-3 border-b text-sm items-center">
        {[
          { label: "Adult(12 +)", key: "adults" as const },
          { label: "Child(2-12)", key: "children" as const },
          { label: "Infant(< 2 Yrs)", key: "infants" as const },
        ].map(({ label, key }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-gray-600">{label}</span>
            <select
              className="border rounded px-2 py-1 text-sm focus:outline-none"
              value={localPassengers[key]}
              onChange={(e) => updatePassenger(key, Number(e.target.value))}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex min-h-[500px]">
        <div className="w-72 flex-shrink-0 border-r bg-gray-50 text-sm">
          <div className="flex items-center justify-between px-4 py-2 bg-blue-100 border-b">
            <span className="font-semibold text-gray-700">🔍 Filter</span>
            <button onClick={clearFilters} className="text-blue-600 underline text-xs hover:text-blue-800">
              Clear all filters
            </button>
          </div>

          <div className="border-b">
            <div className="px-4 py-2 font-semibold text-gray-700 bg-gray-100">▼ Stops</div>
            <div className="flex gap-2 px-4 py-3">
              {[0, 1].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => togStop(n)}
                  className={`w-10 h-8 border rounded text-sm font-medium transition-colors ${
                    fStops.has(n) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:border-blue-400"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="border-b px-4 py-3">
            <div className="font-semibold text-gray-700 mb-2">Search by Flight Number</div>
            <div className="relative">
              <input
                type="text"
                value={fFlightNum}
                onChange={(e) => setFFlightNum(e.target.value)}
                placeholder="eg. 3303,519"
                className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 pr-8"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            </div>
          </div>

          <div className="border-b">
            <div className="px-4 py-2 font-semibold text-gray-700 bg-gray-100">▼ Departure Times</div>
            <div className="px-4 py-2 space-y-2">
              {[
                { key: "morning", label: "Morning(04:00- 11:00)" },
                { key: "afternoon", label: "Afternoon(11:00 - 16:00)" },
                { key: "evening", label: "Evening(16:00 - 21:00)" },
                { key: "night", label: "Night(21:00 - 04:00 AM)" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fTimes.has(key)} onChange={() => togTime(key)} className="rounded" />
                  <span className="text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-b">
            <div className="px-4 py-2 font-semibold text-gray-700 bg-gray-100 flex items-center gap-2">
              <span>▼ Airlines:</span>
              <label className="flex items-center gap-1 text-xs font-normal">
                <input type="checkbox" checked={fRestrict} onChange={(e) => setFRestrict(e.target.checked)} />
                Restrict
              </label>
            </div>
            <div className="px-4 py-1 flex gap-2 text-xs border-b">
              <button
                type="button"
                onClick={() => setFAirlines(new Set(airlineList.map((a) => a.code)))}
                className="text-blue-600 underline hover:text-blue-800"
              >
                select
              </button>
              <span className="text-gray-400">/</span>
              <button type="button" onClick={() => setFAirlines(new Set())} className="text-blue-600 underline hover:text-blue-800">
                unselect all
              </button>
            </div>
            <div className="px-4 py-2 space-y-2">
              {airlineList.map(({ code, name }) => (
                <label key={code} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fAirlines.has(code)} onChange={() => togAirline(code)} />
                  <span className="text-gray-700">
                    {name}({code})
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          {isAdvanceReturn ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-2 min-h-[500px]">
              <div className="min-w-0 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                {renderFlightList(
                  filteredOnward,
                  "ob",
                  `✈️ Onward (OB) — ${origin} → ${destination} (${filteredOnward.length})`,
                  true,
                )}
              </div>
              <div className="min-w-0 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                {renderFlightList(
                  filteredReturn,
                  "ib",
                  `✈️ Return (IB) — ${destination} → ${origin} (${filteredReturn.length})`,
                  true,
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {renderFlightList(
                filteredOnward,
                "ob",
                `✈️ Onward — ${origin} → ${destination} (${filteredOnward.length})`,
                false,
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
