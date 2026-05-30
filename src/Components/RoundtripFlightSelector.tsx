"use client";

import { useState } from "react";
import { flightAPI } from "@/lib/api";
import { getJourneyEndpoints } from "@/lib/flightDisplay";
import { formatUserDate } from "@/lib/dateLocale";

const OG = "#FC6603";

interface RoundtripFlightSelectorProps {
  results: any;
  domainToken: string;
  onSelectFlight: (flight: any) => void;
  onBack: () => void;
}

export default function RoundtripFlightSelector({
  results,
  domainToken,
  onSelectFlight,
  onBack,
}: RoundtripFlightSelectorProps) {
  const [selectedOnwardIndex, setSelectedOnwardIndex] = useState<number | null>(null);
  const [selectedReturnIndex, setSelectedReturnIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [priceChangeInfo, setPriceChangeInfo] = useState<{
    changes: { label: string; oldPrice: number; newPrice: number }[];
    onConfirm: () => void;
  } | null>(null);

  const extractNewPrice = (res: any): number =>
    res?.UpdateFareQuote?.FareQuoteDetails?.JourneyList?.Price?.TotalDisplayFare || 0;

  const isPriceChanged = (res: any): boolean =>
    !!(res?.isPriceChanged || res?.IsPriceChanged ||
       res?.UpdateFareQuote?.PriceChanged || res?.UpdateFareQuote?.priceChanged ||
       res?.updateFareQuote?.priceChanged || res?.PriceChanged || res?.priceChanged);

  const flights =
    results?.Search?.FlightDataList?.JourneyList?.[0] ||
    results?.search?.flightDataList?.journeyList?.[0] ||
    [];

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

  const handleContinue = async () => {
    if (selectedOnwardIndex === null || selectedReturnIndex === null) {
      alert("Please select both onward and return flights");
      return;
    }

    setLoading(true);
    try {
      // Get the selected flights
      const selectedOnwardFlight = flights[selectedOnwardIndex];
      const selectedReturnFlight = flights[selectedReturnIndex];
      
      const onwardResultToken = selectedOnwardFlight.ResultToken || selectedOnwardFlight.resultToken;
      const returnResultToken = selectedReturnFlight.ResultToken || selectedReturnFlight.resultToken;

      if (!domainToken) {
        throw new Error("Domain token not available");
      }

      console.log('\n========== ROUNDTRIP FLIGHT SELECTION ==========');
      console.log('Selected Onward Index:', selectedOnwardIndex);
      console.log('Selected Return Index:', selectedReturnIndex);
      console.log('Onward Result Token:', onwardResultToken);
      console.log('Return Result Token:', returnResultToken);
      console.log('================================================\n');

      // Call update fare quote for both flights in parallel
      const [onwardFareQuoteResponse, returnFareQuoteResponse] = await Promise.all([
        flightAPI.updateFareQuote(onwardResultToken, domainToken),
        flightAPI.updateFareQuote(returnResultToken, domainToken),
      ]);

      const combinedFlight = {
        ...selectedOnwardFlight,
        selectedOnwardIndex,
        selectedReturnIndex,
        selectedReturn: selectedReturnFlight,
        fareQuoteData: onwardFareQuoteResponse,
        returnFareQuoteData: returnFareQuoteResponse,
        domainToken,
      };

      // Collect price changes
      const changes: { label: string; oldPrice: number; newPrice: number }[] = [];
      const obOld = selectedOnwardFlight.Price?.TotalDisplayFare || selectedOnwardFlight.price?.totalDisplayFare || 0;
      const ibOld = selectedReturnFlight.Price?.TotalDisplayFare || selectedReturnFlight.price?.totalDisplayFare || 0;
      if (isPriceChanged(onwardFareQuoteResponse))
        changes.push({ label: "Outbound", oldPrice: obOld, newPrice: extractNewPrice(onwardFareQuoteResponse) });
      if (isPriceChanged(returnFareQuoteResponse))
        changes.push({ label: "Return", oldPrice: ibOld, newPrice: extractNewPrice(returnFareQuoteResponse) });

      if (changes.length > 0) {
        setLoading(false);
        setPriceChangeInfo({ changes, onConfirm: () => { setPriceChangeInfo(null); onSelectFlight(combinedFlight); } });
        return;
      }

      onSelectFlight(combinedFlight);
    } catch (error) {
      console.error("Failed to update fare quote:", error);
      alert("Failed to get updated fare. Please try again.");
    }
    setLoading(false);
  };

  const renderFlightSegment = (
    flight: any,
    segmentIndex: number,
    isSelected: boolean,
    onSelect: () => void,
    label: string
  ) => {
    const flightDetails =
      flight.FlightDetails?.Details || flight.flightDetails?.details;
    const price = flight.Price || flight.price;

    if (!flightDetails || !price) return null;

    const journeyLegs = flightDetails[segmentIndex];
    const jx = getJourneyEndpoints(journeyLegs);
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
      flightDetail.operatorCode;

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
              className="w-10 h-10 object-contain flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
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
              {origin.AirportCode || origin.airportCode}
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
              {destination.AirportCode || destination.airportCode}
            </div>
            <div className="text-xs text-gray-500">
              {formatDate(destination.DateTime || destination.dateTime)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
          <span>
            Baggage: {flightDetail.Attr?.Baggage || flightDetail.attr?.baggage}
          </span>
          <span
            className={
              flightDetail.Attr?.IsRefundable || flightDetail.attr?.isRefundable
                ? "text-green-600"
                : "text-red-600"
            }
          >
            {flightDetail.Attr?.IsRefundable || flightDetail.attr?.isRefundable
              ? "Refundable"
              : "Non-refundable"}
          </span>
        </div>
      </div>
    );
  };

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

  return (
    <>
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-primary hover:text-primary-dark">
          ← Back to Search
        </button>
        <h2 className="text-xl font-semibold">Select Roundtrip Flights</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Onward Flights */}
        <div>
          <h3 className="text-lg font-bold mb-4 pb-2 border-b-2" style={{ borderColor: OG }}>
            ✈️ Onward Flights
          </h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {flights.map((flight: any, index: number) =>
              renderFlightSegment(
                flight,
                0,
                selectedOnwardIndex === index,
                () => setSelectedOnwardIndex(index),
                "Onward"
              )
            )}
          </div>
        </div>

        {/* Return Flights */}
        <div>
          <h3 className="text-lg font-bold mb-4 pb-2 border-b-2" style={{ borderColor: OG }}>
            ✈️ Return Flights
          </h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {flights.map((flight: any, index: number) =>
              renderFlightSegment(
                flight,
                1,
                selectedReturnIndex === index,
                () => setSelectedReturnIndex(index),
                "Return"
              )
            )}
          </div>
        </div>
      </div>

      {/* Summary and Continue Button */}
      <div className="mt-8 pt-6 border-t">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Onward Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm font-semibold text-gray-600 mb-2">Onward</div>
            {selectedOnwardIndex !== null ? (
              <div>
                <div className="font-bold text-lg">
                  ₹
                  {(
                    flights[selectedOnwardIndex].Price?.TotalDisplayFare ||
                    flights[selectedOnwardIndex].price?.totalDisplayFare
                  )?.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">✅ Selected</div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Not selected</div>
            )}
          </div>

          {/* Return Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm font-semibold text-gray-600 mb-2">Return</div>
            {selectedReturnIndex !== null ? (
              <div>
                <div className="font-bold text-lg">
                  ₹
                  {(
                    flights[selectedReturnIndex].Price?.TotalDisplayFare ||
                    flights[selectedReturnIndex].price?.totalDisplayFare
                  )?.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">✅ Selected</div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Not selected</div>
            )}
          </div>

          {/* Total Summary */}
          <div className="bg-orange-50 rounded-lg p-4 border-2" style={{ borderColor: OG }}>
            <div className="text-sm font-semibold mb-2" style={{ color: OG }}>
              Total
            </div>
            {selectedOnwardIndex !== null && selectedReturnIndex !== null ? (
              <div>
                <div className="font-bold text-lg" style={{ color: OG }}>
                  ₹
                  {(
                    (flights[selectedOnwardIndex].Price?.TotalDisplayFare ||
                      flights[selectedOnwardIndex].price?.totalDisplayFare) +
                    (flights[selectedReturnIndex].Price?.TotalDisplayFare ||
                      flights[selectedReturnIndex].price?.totalDisplayFare)
                  )?.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">for 1 passenger</div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Select both flights</div>
            )}
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={selectedOnwardIndex === null || selectedReturnIndex === null || loading}
          className="w-full py-4 rounded-xl font-bold text-white text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(90deg, ${OG}, #ff8c38)`,
          }}
        >
          {loading ? "Processing..." : "Continue to Booking →"}
        </button>
      </div>
    </div>
    {priceChangedModal}
    </>
  );
}
