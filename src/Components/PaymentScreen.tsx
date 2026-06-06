"use client";
import { useState, useEffect } from "react";
import { flightAPI, paymentAPI } from "@/lib/api";
import {
  getBookingDisplayFlightDetails,
  getFlightDetailsFromFareQuoteData,
  getFareQuoteJourneyPrice,
  formatConnectionStopsLabel,
  resolveRoundtripBookingFares,
} from "@/lib/flightDisplay";
import {
  getIbResultTokenForPayment,
  getObResultTokenForPayment,
  getPaymentTripTypeForInitiate,
  isSeparateLegRoundtripPayment,
} from "@/lib/flightPayment";
import { formatUserDate } from "@/lib/dateLocale";
import type { LeadPassengerAddress } from "@/lib/leadPassengerAddress";
import { isFlightHoldBookingActive } from "@/lib/flightHoldConfig";
import {
  debitAgentWallet,
  fetchAgentWallet,
  formatWalletAmount,
  isAgentWalletUser,
  makeFlightWalletAppReference,
  resolveAgentUserId,
  type AgentWallet,
} from "@/lib/agentWallet";

const HDFC_PENDING_KEY = "hdfc_pending_booking";

const OG = "#FC6603";
const HOLD_BLUE = "#1e40af";
const HOLD_BLUE_LIGHT = "#3b82f6";

interface PaymentScreenProps {
  selectedFlight: any;
  passengers: { adults: number; children: number; infants: number };
  passengerDetails: any[];
  guestEmail: string;
  guestMobile: string;
  cellCountryCode: string;
  discount: number;
  promoCode: string;
  markupAmount?: number;
  markupRuleId?: number | null;
  leadPassengerAddress?: LeadPassengerAddress;
  tripType: string;
  timeRemaining?: number;
  user?: { userId?: number | string; id?: number | string } | null;
  onPaymentSuccess: (
    paymentData: any,
    paymentProof: { gateway: "razorpay" | "hdfc" | "wallet"; payId?: string; orderId?: string; appReference?: string },
  ) => void;
  onBack: () => void;
}

export default function PaymentScreen({
  selectedFlight,
  passengers,
  passengerDetails,
  guestEmail,
  guestMobile,
  cellCountryCode,
  discount,
  promoCode,
  markupAmount = 0,
  leadPassengerAddress,
  tripType,
  timeRemaining = 900,
  user,
  onPaymentSuccess,
  onBack,
}: PaymentScreenProps) {

  const [step, setStep] = useState<"summary" | "processing" | "validating">(
    "summary",
  );
  const [error, setError] = useState("");
  const [detectedGateway, setDetectedGateway] = useState<"razorpay" | "hdfc" | "wallet" | null>(null);
  const [agentWallet, setAgentWallet] = useState<AgentWallet | null>(null);
  const agentPayment = isAgentWalletUser(user);
  /** Hold flow: amount to charge now (from hold-fee API), loaded from flight state or refetched. */
  const [holdPaymentInr, setHoldPaymentInr] = useState<number | null>(null);

  useEffect(() => {
    if (!agentPayment || !user) {
      setAgentWallet(null);
      return;
    }
    const userId = resolveAgentUserId(user);
    fetchAgentWallet(userId)
      .then(setAgentWallet)
      .catch(() => setAgentWallet(null));
  }, [agentPayment, user]);

  // Type 1 Roundtrip: separate OB/IB (regular or advance return)
  const isType1Roundtrip = isSeparateLegRoundtripPayment(selectedFlight);
  const isAdvanceReturn = selectedFlight.advanceRoundtrip === true;
  const paymentTripType = getPaymentTripTypeForInitiate(selectedFlight, tripType);
  
  // Type 2 Roundtrip: Has explicit marker (paired OB+IB in single selection)
  const isType2RoundtripPaired = selectedFlight.isType2Roundtrip === true;
  
  // Overall roundtrip flag
  const isRoundtrip = isType1Roundtrip || isType2RoundtripPaired;

  // Hold Booking mode — changes button/card colors to blue to match the banner
  const holdBooking = isFlightHoldBookingActive(selectedFlight);
  const accentColor = holdBooking ? HOLD_BLUE : OG;
  const accentColorLight = holdBooking ? HOLD_BLUE_LIGHT : "#ff8c38";

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resolvedFares = resolveRoundtripBookingFares(selectedFlight);
  const price =
    getFareQuoteJourneyPrice(selectedFlight.fareQuoteData) ||
    selectedFlight.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.JourneyList?.[0]?.Price ||
    selectedFlight.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.JourneyList?.Price ||
    selectedFlight.Price ||
    selectedFlight.price ||
    resolvedFares.onwardPrice;

  const returnPrice = isType1Roundtrip
    ? (getFareQuoteJourneyPrice(selectedFlight.returnFareQuoteData) ||
       selectedFlight.returnFareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.JourneyList?.Price ||
       selectedFlight.selectedReturn?.Price ||
       selectedFlight.selectedReturn?.price ||
       resolvedFares.returnPrice)
    : isType2RoundtripPaired
    ? (selectedFlight.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.JourneyList?.[1]?.Price ||
       getFareQuoteJourneyPrice(selectedFlight.fareQuoteData))
    : null;

  const resultToken = getObResultTokenForPayment(selectedFlight);

  const domainToken = selectedFlight.domainToken || "";

  const flightDetails =
    getFlightDetailsFromFareQuoteData(selectedFlight.fareQuoteData) ||
    selectedFlight.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails
      ?.FlightDetails?.Details ||
    selectedFlight.FlightDetails?.Details ||
    selectedFlight.flightDetails?.details;

  const displayFlightDetails = getBookingDisplayFlightDetails(selectedFlight) ?? flightDetails;

  const outboundSegments = displayFlightDetails?.[0];
  const firstSeg = outboundSegments?.[0];
  const lastOutboundSeg = outboundSegments?.[(outboundSegments?.length ?? 1) - 1];
  const origin = firstSeg?.Origin || firstSeg?.origin;
  const dest = lastOutboundSeg?.Destination || lastOutboundSeg?.destination;

  // Return leg for UI must reflect the selected IB flight (esp. Advance Return).
  const returnSegments = isRoundtrip ? displayFlightDetails?.[1] : undefined;
  const returnSeg = returnSegments?.[0];
  const returnSegLast = returnSegments?.[(returnSegments?.length ?? 1) - 1];

  const returnOrigin = returnSeg?.Origin || returnSeg?.origin;
  const returnDest = returnSegLast?.Destination || returnSegLast?.destination;

  // Get return flight pricing details
  const returnBaseFare =
    returnPrice?.PriceBreakup?.BasicFare ||
    returnPrice?.priceBreakup?.basicFare ||
    0;
  const returnTaxFare =
    returnPrice?.PriceBreakup?.Tax || returnPrice?.priceBreakup?.tax || 0;

  console.log('=== PAYMENT SCREEN DEBUG ===');
  console.log('tripType:', tripType);
  console.log('selectedFlight.isType2Roundtrip marker:', selectedFlight.isType2Roundtrip);
  console.log('Type 1 Roundtrip (selectedReturn exists):', isType1Roundtrip);
  console.log('Type 2 Roundtrip Paired (marker-based):', isType2RoundtripPaired);
  console.log('Is Roundtrip (either type):', isRoundtrip);
  console.log('flightDetails?.length:', flightDetails?.length);
  console.log('flightDetails[0]?.length:', flightDetails[0]?.length);
  console.log('flightDetails[1]?.length:', flightDetails[1]?.length);
  console.log('displayFlightDetails?.length:', displayFlightDetails?.length);
  console.log('returnSeg:', returnSeg);
  console.log('returnOrigin:', returnOrigin);
  console.log('returnDest:', returnDest);
  console.log('returnPrice:', returnPrice);
  console.log('returnPrice?.PassengerBreakup:', returnPrice?.PassengerBreakup);
  console.log('returnBaseFare:', returnBaseFare);
  console.log('returnTaxFare:', returnTaxFare);

  // Fare math - calculate onward flight total
  const adtB = price?.PassengerBreakup?.ADT;
  const chdB = price?.PassengerBreakup?.CHD;
  const infB = price?.PassengerBreakup?.INF;

  let onwardTotal = 0;
  if (adtB && passengers.adults > 0) {
    onwardTotal += (adtB.BasePrice + adtB.Tax) * passengers.adults;
  }
  if (chdB && passengers.children > 0 && chdB.BasePrice > 0) {
    onwardTotal += (chdB.BasePrice + chdB.Tax) * passengers.children;
  }
  if (infB && passengers.infants > 0 && infB.BasePrice > 0) {
    onwardTotal += (infB.BasePrice + infB.Tax) * passengers.infants;
  }

  // If no passenger breakdown, use total display fare
  if (onwardTotal === 0) {
    onwardTotal = price?.TotalDisplayFare || price?.totalDisplayFare || 0;
  }

  // Calculate return flight total (for all passengers)
  // For Type 1: Calculate separate return pricing
  // For Type 2: Calculate but don't show separately in UI (combined as "Paired Roundtrip Flights")
  let returnTotal = 0;
  if (isRoundtrip && returnPrice) {
    const returnAdtB = returnPrice?.PassengerBreakup?.ADT;
    const returnChdB = returnPrice?.PassengerBreakup?.CHD;
    const returnInfB = returnPrice?.PassengerBreakup?.INF;

    if (returnAdtB && passengers.adults > 0) {
      returnTotal +=
        (returnAdtB.BasePrice + returnAdtB.Tax) * passengers.adults;
    }
    if (returnChdB && passengers.children > 0 && returnChdB.BasePrice > 0) {
      returnTotal +=
        (returnChdB.BasePrice + returnChdB.Tax) * passengers.children;
    }
    if (returnInfB && passengers.infants > 0 && returnInfB.BasePrice > 0) {
      returnTotal +=
        (returnInfB.BasePrice + returnInfB.Tax) * passengers.infants;
    }

    // If no passenger breakdown, use total display fare
    if (returnTotal === 0) {
      returnTotal =
        returnPrice?.TotalDisplayFare || returnPrice?.totalDisplayFare || 0;
    }
  }

  // Fare total must match the booking page Grand Total, which uses TotalDisplayFare
  // (base + taxes + fees). The PassengerBreakup base+tax sum (onwardTotal/returnTotal)
  // omits fees and under-totals, so use the centralized resolver for all journey types.
  // onwardTotal/returnTotal are still used below for the hold-fee initiate payload.
  const baseTotal = resolvedFares.totalFare;

  // Booking-page fare display values (mirrored below so the breakdown matches it exactly).
  const { baseFare, taxFare, obBaseFare, obTax, ibBaseFare, ibTax } = resolvedFares;
  const fareSummaryUsesPassengerBreakup =
    !isAdvanceReturn && Boolean(price?.PassengerBreakup?.ADT);

  const addOnBaggageCost = passengerDetails.reduce((sum, p) => sum + (p.obBaggage?.Price || 0) + (p.ibBaggage?.Price || 0), 0);
  const addOnMealCost    = passengerDetails.reduce((sum, p) => sum + (p.obMeal?.Price || 0)    + (p.ibMeal?.Price || 0), 0);
  const addOnSeatCost    = passengerDetails.reduce((sum, p) => sum + (p.obSeat?.Price || 0)    + (p.ibSeat?.Price || 0), 0);
  const addOnTotal       = addOnBaggageCost + addOnMealCost + addOnSeatCost;
  // Preserve paise precision (e.g. ₹10,813.79) like the booking page; avoid float noise.
  const totalAmount = Math.round((baseTotal + addOnTotal + markupAmount - discount) * 100) / 100;

  useEffect(() => {
    if (!holdBooking) {
      setHoldPaymentInr(null);
      return;
    }
    const fromFlight = Number(selectedFlight?.holdFeeInr ?? selectedFlight?.HoldFeeInr ?? NaN);
    if (Number.isFinite(fromFlight) && fromFlight > 0) {
      setHoldPaymentInr(Math.round(fromFlight));
      return;
    }
    setHoldPaymentInr(null);
    let cancelled = false;
    (async () => {
      try {
        const rt =
          selectedFlight?.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.ResultToken ||
          selectedFlight?.ResultToken ||
          selectedFlight?.resultToken;
        const tok = String(selectedFlight?.domainToken || "").trim() || (await flightAPI.getDomainToken());
        if (!rt || !tok) return;
        const r = await flightAPI.getHoldFee(String(rt), tok);
        const fee = Math.round(Number(r?.HoldFee ?? r?.holdFee ?? NaN));
        if (!cancelled && Number.isFinite(fee) && fee > 0) setHoldPaymentInr(fee);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    holdBooking,
    selectedFlight?.holdFeeInr,
    selectedFlight?.HoldFeeInr,
    selectedFlight?.domainToken,
    selectedFlight?.ResultToken,
    selectedFlight?.resultToken,
    selectedFlight?.fareQuoteData,
  ]);

  const payNowAmount: number | null = holdBooking
    ? holdPaymentInr != null && holdPaymentInr > 0
      ? holdPaymentInr
      : null
    : totalAmount;
  const holdFeePending = holdBooking && payNowAmount == null;

  const fmt = (dt: string) =>
    dt
      ? new Date(dt.replace(" ", "T")).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "";
  const fmtD = (dt: string) =>
    dt
      ? formatUserDate(dt.replace(" ", "T"), {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "";
  const getDur = (s?: string, e?: string) => {
    if (!s || !e) return "";
    const ms =
      new Date(e.replace(" ", "T")).getTime() -
      new Date(s.replace(" ", "T")).getTime();
    return ms > 0
      ? `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
      : "";
  };

  const getReturnResultToken = () => {
    if (!isRoundtrip) return undefined;
    
    // Type 1: Get IB token from returnFareQuoteData
    if (isType1Roundtrip) {
      return selectedFlight.returnFareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.ResultToken ||
        selectedFlight.selectedReturn?.ResultToken ||
        selectedFlight.selectedReturn?.resultToken;
    }
    
    // Type 2: Use same token as OB (paired roundtrip)
    if (isType2RoundtripPaired) {
      return resultToken;
    }
  };

  const handlePay = async () => {
    if (holdBooking && (payNowAmount == null || payNowAmount <= 0)) {
      setError(
        "Hold fee is not available yet. Please wait a moment or go back to booking and try again.",
      );
      return;
    }
    setError("");
    setStep("processing");
    try {
      const amountToCharge = holdBooking ? (payNowAmount as number) : totalAmount;

      // For now: let backend compute amounts from itinerary tokens (no obFare/ibFare)
      // - Non-hold (oneway/roundtrip/specialreturn): omit (tokens + tripType are enough)
      // - Advance Return: omit (backend needs both OB+IB via tokens)
      // - Hold-fee flow: keep sending fare amounts (amountToCharge now)
      const omitLegFaresForInitiate = !holdBooking || selectedFlight.advanceRoundtrip === true;
      const obForPayment = omitLegFaresForInitiate
        ? undefined
        : holdBooking
          ? amountToCharge
          : onwardTotal;
      const ibForPayment = omitLegFaresForInitiate
        ? undefined
        : holdBooking
          ? isType1Roundtrip
            ? 0
            : undefined
          : isType1Roundtrip
            ? returnTotal
            : undefined;

      const returnTokenForPayment = isType1Roundtrip ? getReturnResultToken() : undefined;
      if (isType1Roundtrip && !returnTokenForPayment) {
        throw new Error("Return flight token is missing. Go back and select return flights again.");
      }
      if (!resultToken) {
        throw new Error("Onward flight token is missing. Go back and select flights again.");
      }

      // Agent B2B: debit wallet (available to book) instead of payment gateway
      if (agentPayment && user) {
        setDetectedGateway("wallet");
        setStep("validating");
        const userId = resolveAgentUserId(user);
        const wallet = await fetchAgentWallet(userId);
        if (!wallet) {
          throw new Error("Unable to load wallet balance. Please try again.");
        }
        if (amountToCharge > wallet.availableToBook) {
          throw new Error(
            `Insufficient available to book. Required ${formatWalletAmount(amountToCharge)}, available ${formatWalletAmount(wallet.availableToBook)}.`,
          );
        }

        const appReference = makeFlightWalletAppReference(resultToken);
        const debitRes = await debitAgentWallet(
          userId,
          userId,
          amountToCharge,
          appReference,
          holdBooking ? "Flight hold booking" : "Flight booking",
        );

        onPaymentSuccess(debitRes, { gateway: "wallet", appReference });
        return;
      }

      const orderRes = await flightAPI.initiatePayment(
        resultToken,
        domainToken,
        returnTokenForPayment,
        paymentTripType,
        obForPayment,
        ibForPayment,
        holdBooking,
      );

      if (!orderRes.pgatewayOrderId)
        throw new Error("Failed to create payment order");

      /** After initiatePayment, flight auth cache may hold a refreshed JWT (401 retry). */
      const tokenForPaymentApis =
        (await flightAPI.getDomainToken().catch(() => "")) || domainToken;

      const { pgatewayOrderId, pgateway, url } = orderRes;
      const gateway = (pgateway || "razorpay").toLowerCase() as "razorpay" | "hdfc";
      setDetectedGateway(gateway);

      if (gateway === "hdfc") {
        if (!url) throw new Error("HDFC did not return a payment URL");

        const leadPax = passengerDetails[0] || {};
        sessionStorage.setItem(HDFC_PENDING_KEY, JSON.stringify({
          selectedFlight,
          passengers,
          passengerDetails,
          guestEmail,
          guestMobile,
          cellCountryCode,
          discount,
          promoCode,
          markupAmount,
          leadPassengerAddress,
          tripType,
          domainToken: tokenForPaymentApis,
          orderId: pgatewayOrderId,
          pgateway,
        }));

        window.location.href = url;
        return;
      }

      // Razorpay flow
      const leadPax = passengerDetails[0];
      const payRes: any = await paymentAPI.processRazorpayPayment(
        pgatewayOrderId,
        amountToCharge,
        undefined,
        {
          name: leadPax ? `${leadPax.firstName || ""} ${leadPax.lastName || ""}`.trim() : undefined,
          email: guestEmail || undefined,
          contact: guestMobile || undefined,
        },
      );

      setStep("validating");
      const validRes = await flightAPI.validatePayment(
        {
          payId: payRes.razorpay_payment_id,
          orderId: payRes.razorpay_order_id,
          signature: payRes.razorpay_signature,
          pgateway,
          resultToken,
        },
        tokenForPaymentApis,
      );

      if (validRes.validationResult !== "VALID") {
        throw new Error(`Payment validation failed: ${validRes.validationResult || "Unknown result"}`);
      }

      onPaymentSuccess(validRes, {
        gateway: "razorpay",
        payId: payRes.razorpay_payment_id,
        orderId: payRes.razorpay_order_id,
      });
    } catch (err: any) {
      setError(err.message || "Payment failed. Please try again.");
      setStep("summary");
    }
  };

  const paxIcon: Record<string, string> = {
    Adult: "🧑",
    Child: "👦",
    Infant: "👶",
  };

  const formatPaxDob = (iso: string | undefined) => {
    const v = String(iso || "").trim();
    if (!v || v.length < 10) return "—";
    const d = new Date(`${v.slice(0, 10)}T12:00:00`);
    return isNaN(d.getTime()) ? v : formatUserDate(d, { year: "numeric", month: "short", day: "numeric" });
  };

  const mealLabel = (m: any) =>
    m ? String(m.AirlineDescription || m.Description || m.description || m.Code || "").trim() : "";
  const seatLabel = (s: any) => (s ? String(s.Code || s.code || "").trim() : "");
  const baggageLabel = (b: any) => {
    if (!b) return "";
    const w = b.Weight ?? b.weight;
    const t = b.Text || b.text || b.Description || b.description;
    const bits: string[] = [];
    if (w != null && String(w).trim() !== "") bits.push(`${w} kg`);
    if (t) bits.push(String(t));
    if (bits.length) return bits.join(" · ");
    return String(b.Code || "").trim();
  };

  const formatObIbPair = (obText: string, ibText: string, obHas: boolean, ibHas: boolean): string | null => {
    if (!obHas && !ibHas) return null;
    if (!isRoundtrip) {
      if (obHas) return obText;
      if (ibHas) return ibText;
      return null;
    }
    if (obHas && ibHas) {
      if (obText === ibText) return obText;
      return `Outbound: ${obText} · Return: ${ibText}`;
    }
    if (obHas) return `Outbound: ${obText}`;
    return `Return: ${ibText}`;
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark"
      >
        ← Back to Booking
      </button>

      {/* Timer Banner */}
      <div 
        className="mb-4 rounded-xl p-4 flex items-center justify-between"
        style={{ 
          background: timeRemaining < 300 ? '#fee2e2' : '#fff7ed',
          border: `2px solid ${timeRemaining < 300 ? '#ef4444' : OG}`
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⏰</span>
          <div>
            <div className="font-bold text-sm" style={{ color: timeRemaining < 300 ? '#dc2626' : OG }}>
              Time Remaining
            </div>
            <div className="text-xs text-gray-600">
              Complete payment before the timer expires
            </div>
          </div>
        </div>
        <div 
          className="text-3xl font-bold tabular-nums"
          style={{ color: timeRemaining < 300 ? '#dc2626' : OG }}
        >
          {formatTime(timeRemaining)}
        </div>
      </div>

      {/* Light orange banner */}
      <div
        className="rounded-2xl overflow-hidden shadow-lg mb-5"
        style={{
          background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
          border: "1px solid #fed7aa",
        }}
      >
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: OG }}
            >
              {tripType === "multicity" ? "Multi City" : isRoundtrip ? "Round Trip" : "One Way"}
            </div>
            {tripType === "multicity" && flightDetails ? (
              <>
                <div className="text-2xl font-black text-gray-800">
                  {flightDetails.map((leg: any, i: number) => {
                    const s = leg?.[0];
                    const o = s?.Origin || s?.origin;
                    return (
                      <span key={i}>
                        {i > 0 && <span className="mx-2" style={{ color: OG }}>→</span>}
                        {o?.CityName || o?.cityName || o?.AirportCode || o?.airportCode || "—"}
                      </span>
                    );
                  })}
                  {(() => {
                    const lastLeg = flightDetails[flightDetails.length - 1];
                    const s = lastLeg?.[0];
                    const d = s?.Destination || s?.destination;
                    return (
                      <>
                        <span className="mx-2" style={{ color: OG }}>→</span>
                        {d?.CityName || d?.cityName || d?.AirportCode || d?.airportCode || "—"}
                      </>
                    );
                  })()}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {flightDetails.map((leg: any, i: number) => {
                    const s = leg?.[0];
                    const o = s?.Origin || s?.origin;
                    const d = s?.Destination || s?.destination;
                    return (
                      <span key={i}>
                        {i > 0 && <span className="mx-1">·</span>}
                        <span className="font-semibold">Leg {i + 1}:</span>{" "}
                        {o?.AirportCode || o?.airportCode} → {d?.AirportCode || d?.airportCode}{" "}
                        {fmtD(o?.DateTime || o?.dateTime)}
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-black text-gray-800">
                  {origin?.CityName || origin?.cityName || origin?.AirportCode || origin?.airportCode}
                  <span className="mx-3" style={{ color: OG }}>{isRoundtrip ? "↔" : "→"}</span>
                  {dest?.CityName || dest?.cityName || dest?.AirportCode || dest?.airportCode}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  <span className="font-semibold">Outbound:</span>{" "}
                  {fmtD(origin?.DateTime || origin?.dateTime)} ·{" "}
                  {fmt(origin?.DateTime || origin?.dateTime)} →{" "}
                  {fmt(dest?.DateTime || dest?.dateTime)}
                  {isRoundtrip && (
                    <>
                      <br />
                      <span className="font-semibold">Return:</span>{" "}
                      {fmtD(returnOrigin?.DateTime || returnOrigin?.dateTime)} ·{" "}
                      {fmt(returnOrigin?.DateTime || returnOrigin?.dateTime)} →{" "}
                      {fmt(returnDest?.DateTime || returnDest?.dateTime)}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {holdBooking ? "Hold fee (pay now)" : "Total Payable"}
            </div>
            <div className="text-3xl font-black" style={{ color: holdBooking ? HOLD_BLUE : OG }}>
              {holdFeePending ? "…" : `₹${(payNowAmount as number).toLocaleString()}`}
            </div>
            {holdBooking ? (
              <div className="text-[11px] text-gray-500 mt-1 max-w-[220px] ml-auto leading-snug">
                Full fare ₹{totalAmount.toLocaleString()} is due when you complete ticketing.
              </div>
            ) : (
              discount > 0 && (
                <div className="text-xs text-green-600 font-medium mt-0.5">
                  🎟 Saved ₹{discount.toLocaleString()} ({promoCode})
                </div>
              )
            )}
          </div>
        </div>

        {/* Flight route strips */}
        {tripType === "multicity" && flightDetails
          ? flightDetails.map((leg: any, li: number) => {
              const s = leg?.[0];
              if (!s) return null;
              const o = s.Origin || s.origin;
              const d = s.Destination || s.destination;
              return (
                <div
                  key={li}
                  className="px-6 py-3 flex items-center gap-4 text-sm"
                  style={{ background: li % 2 === 0 ? "#ffe8cc" : "#ffd699", borderTop: "1px solid #fed7aa" }}
                >
                  <div className="text-xs font-bold w-12 flex-shrink-0" style={{ color: OG }}>Leg {li + 1}</div>
                  <div className="text-center">
                    <div className="text-xl font-black text-gray-800">{fmt(o?.DateTime || o?.dateTime)}</div>
                    <div className="font-semibold text-gray-600">{o?.AirportCode || o?.airportCode}</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="text-xs font-bold" style={{ color: OG }}>
                      {getDur(o?.DateTime || o?.dateTime, d?.DateTime || d?.dateTime)}
                    </div>
                    <div className="flex items-center gap-1 w-full my-1">
                      <div className="flex-1 h-px" style={{ background: OG, opacity: 0.4 }} />
                      <span className="text-base" style={{ color: OG }}>✈</span>
                      <div className="flex-1 h-px" style={{ background: OG, opacity: 0.4 }} />
                    </div>
                    <div className="text-[11px] font-semibold" style={{ color: OG }}>
                      Non-stop · {s.OperatorCode || s.operatorCode} {s.FlightNumber || s.flightNumber}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-gray-800">{fmt(d?.DateTime || d?.dateTime)}</div>
                    <div className="font-semibold text-gray-600">{d?.AirportCode || d?.airportCode}</div>
                  </div>
                </div>
              );
            })
          : firstSeg && (
              <div
                className="px-6 py-3 flex items-center gap-4 text-sm"
                style={{ background: "#ffe8cc", borderTop: "1px solid #fed7aa" }}
              >
                <div className="text-center">
                  <div className="text-xl font-black text-gray-800">{fmt(origin?.DateTime || origin?.dateTime)}</div>
                  <div className="font-semibold text-gray-600">{origin?.AirportCode || origin?.airportCode}</div>
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <div className="text-xs font-bold" style={{ color: OG }}>
                    {getDur(origin?.DateTime || origin?.dateTime, dest?.DateTime || dest?.dateTime)}
                  </div>
                  <div className="flex items-center gap-1 w-full my-1">
                    <div className="flex-1 h-px" style={{ background: OG, opacity: 0.4 }} />
                    <span className="text-base" style={{ color: OG }}>✈</span>
                    <div className="flex-1 h-px" style={{ background: OG, opacity: 0.4 }} />
                  </div>
                  <div className="text-[11px] font-semibold" style={{ color: OG }}>
                    {formatConnectionStopsLabel(outboundSegments?.length || 0)} ·{" "}
                    {(outboundSegments || [])
                      .map(
                        (s: any) =>
                          `${s?.OperatorCode || s?.operatorCode || ""} ${s?.FlightNumber || s?.flightNumber || ""}`.trim(),
                      )
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-gray-800">{fmt(dest?.DateTime || dest?.dateTime)}</div>
                  <div className="font-semibold text-gray-600">{dest?.AirportCode || dest?.airportCode}</div>
                </div>
              </div>
            )
        }

        {/* Flight route strip - Return */}
        {isRoundtrip && returnSeg && returnSegLast && (
          <div
            className="px-6 py-3 flex items-center gap-4 text-sm"
            style={{ background: "#ffd699", borderTop: "1px solid #fed7aa" }}
          >
            <div className="text-center">
              <div className="text-xl font-black text-gray-800">
                {fmt(returnOrigin?.DateTime || returnOrigin?.dateTime)}
              </div>
              <div className="font-semibold text-gray-600">
                {returnOrigin?.AirportCode || returnOrigin?.airportCode}
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className="text-xs font-bold" style={{ color: OG }}>
                {getDur(
                  returnOrigin?.DateTime || returnOrigin?.dateTime,
                  returnDest?.DateTime || returnDest?.dateTime,
                )}
              </div>
              <div className="flex items-center gap-1 w-full my-1">
                <div
                  className="flex-1 h-px"
                  style={{ background: OG, opacity: 0.4 }}
                />
                <span className="text-base" style={{ color: OG }}>
                  ✈
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ background: OG, opacity: 0.4 }}
                />
              </div>
              <div className="text-[11px] font-semibold" style={{ color: OG }}>
                {formatConnectionStopsLabel(returnSegments?.length || 0)} ·{" "}
                {(returnSegments || [])
                  .map(
                    (s: any) =>
                      `${s?.OperatorCode || s?.operatorCode || ""} ${s?.FlightNumber || s?.flightNumber || ""}`.trim(),
                  )
                  .filter(Boolean)
                  .join(", ")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-black text-gray-800">
                {fmt(returnDest?.DateTime || returnDest?.dateTime)}
              </div>
              <div className="font-semibold text-gray-600">
                {returnDest?.AirportCode || returnDest?.airportCode}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left: Passengers + Fare breakdown ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Passengers */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div
              className="px-5 py-3 border-b border-gray-100 flex items-center justify-between"
              style={{ background: "#fff7ed" }}
            >
              <h3 className="font-bold text-gray-800">🧑✈️ Passengers</h3>
              <span className="text-xs text-gray-500">
                {passengerDetails.length} traveller
                {passengerDetails.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="p-4 space-y-3">
              {passengerDetails.map((p, i) => {
                const obM = mealLabel(p.obMeal);
                const ibM = mealLabel(p.ibMeal);
                const obS = seatLabel(p.obSeat);
                const ibS = seatLabel(p.ibSeat);
                const obB = baggageLabel(p.obBaggage);
                const ibB = baggageLabel(p.ibBaggage);
                const mealStr = formatObIbPair(obM, ibM, !!obM, !!ibM);
                const seatStr = formatObIbPair(obS, ibS, !!obS, !!ibS);
                const bagStr = formatObIbPair(obB, ibB, !!obB, !!ibB);
                const pass = String(p.passport || "").trim();
                const pex = String(p.passportExpiry || "").trim();
                const displayName = [p.title, p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "—";
                const idx = Number(p.index ?? i) + 1;
                return (
                  <div key={i} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100/80">
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0">{paxIcon[p.type] || "🧑"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-sm text-gray-800">{displayName}</div>
                            <div className="text-[11px] text-gray-400">
                              {p.type} {idx}
                            </div>
                          </div>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white shrink-0"
                            style={{ background: accentColor }}
                          >
                            {String(p.type || "?")[0]}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                          <div>
                            <span className="text-gray-400">Date of birth</span>{" "}
                            <span className="text-gray-800 font-medium">{formatPaxDob(p.dob)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Gender</span>{" "}
                            <span className="text-gray-800 font-medium">{p.gender || "—"}</span>
                          </div>
                          {pass && (
                            <div className="sm:col-span-2">
                              <span className="text-gray-400">Passport no.</span>{" "}
                              <span className="text-gray-800 font-medium">{pass}</span>
                              {pex ? (
                                <>
                                  <span className="text-gray-400 ml-2">Expires</span>{" "}
                                  <span className="text-gray-800 font-medium">{formatPaxDob(pex)}</span>
                                </>
                              ) : null}
                            </div>
                          )}
                          {!pass && pex ? (
                            <div className="sm:col-span-2">
                              <span className="text-gray-400">Passport expires</span>{" "}
                              <span className="text-gray-800 font-medium">{formatPaxDob(pex)}</span>
                            </div>
                          ) : null}
                          {String(p.ffNumber || "").trim() && String(p.ffAirlineCode || p.FFAirlineCode || "").trim() ? (
                            <div className="sm:col-span-2">
                              <span className="text-gray-400">Frequent flyer</span>{" "}
                              <span className="text-gray-800 font-medium">
                                {String(p.ffAirlineCode || p.FFAirlineCode).trim()} — {String(p.ffNumber).trim()}
                              </span>
                            </div>
                          ) : null}
                          {mealStr ? (
                            <div className="sm:col-span-2">
                              <span className="text-gray-400">Meal</span>{" "}
                              <span className="text-gray-800 font-medium">{mealStr}</span>
                            </div>
                          ) : null}
                          {seatStr ? (
                            <div className="sm:col-span-2">
                              <span className="text-gray-400">Seat</span>{" "}
                              <span className="text-gray-800 font-medium">{seatStr}</span>
                            </div>
                          ) : null}
                          {bagStr ? (
                            <div className="sm:col-span-2">
                              <span className="text-gray-400">Baggage</span>{" "}
                              <span className="text-gray-800 font-medium">{bagStr}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-4 pt-2 border-t border-gray-100 text-xs text-gray-600">
                <div>📧 {guestEmail}</div>
                <div>📱 +91 {guestMobile}</div>
              </div>
            </div>
          </div>

          {/* Fare breakdown */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div
              className="px-5 py-3 border-b border-gray-100"
              style={{ background: "#fff7ed" }}
            >
              <h3 className="font-bold text-gray-800">💳 Fare Breakdown</h3>
            </div>
            <div className="p-4 space-y-2 text-sm">
              {/* Flight Pricing — mirrors the booking page Fare Summary (base per passenger
                  + a single combined "Taxes & Fees"), so totals match across both pages. */}
              {passengers && fareSummaryUsesPassengerBreakup ? (
                <>
                  {(passengers.adults || 0) > 0 && adtB && (
                    <div className="flex justify-between text-gray-700">
                      <span>Adult × {passengers.adults}</span>
                      <span>₹{(adtB.BasePrice * passengers.adults)?.toLocaleString()}</span>
                    </div>
                  )}
                  {(passengers.children || 0) > 0 && chdB && (
                    <div className="flex justify-between text-gray-700">
                      <span>Child × {passengers.children}</span>
                      <span>₹{(chdB.BasePrice * passengers.children)?.toLocaleString()}</span>
                    </div>
                  )}
                  {(passengers.infants || 0) > 0 && infB && (
                    <div className="flex justify-between text-gray-700">
                      <span>Infant × {passengers.infants}</span>
                      <span>₹{(infB.BasePrice * passengers.infants)?.toLocaleString()}</span>
                    </div>
                  )}
                </>
              ) : isAdvanceReturn ? (
                <>
                  <div className="flex justify-between text-gray-700">
                    <span>Onward — Base Fare</span>
                    <span>₹{(obBaseFare ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Onward — Taxes &amp; Fees</span>
                    <span>₹{(obTax ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-700 pt-1 border-t border-dashed border-gray-100">
                    <span>Return — Base Fare</span>
                    <span>₹{(ibBaseFare ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Return — Taxes &amp; Fees</span>
                    <span>₹{(ibTax ?? 0).toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-gray-700">
                    <span>Base Fare</span>
                    <span>₹{baseFare?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Taxes &amp; Fees</span>
                    <span>₹{taxFare?.toLocaleString()}</span>
                  </div>
                </>
              )}
              {fareSummaryUsesPassengerBreakup && (
                <div className="flex justify-between text-gray-500">
                  <span>Taxes &amp; Fees</span>
                  <span>₹{taxFare?.toLocaleString()}</span>
                </div>
              )}

              {addOnBaggageCost > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>🧳 Extra Baggage</span>
                  <span>₹{addOnBaggageCost.toLocaleString()}</span>
                </div>
              )}
              {addOnMealCost > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>🍽️ Meals</span>
                  <span>₹{addOnMealCost.toLocaleString()}</span>
                </div>
              )}
              {addOnSeatCost > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>💺 Seats</span>
                  <span>₹{addOnSeatCost.toLocaleString()}</span>
                </div>
              )}
              {markupAmount > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Agent Markup</span>
                  <span>₹{markupAmount.toLocaleString()}</span>
                </div>
              )}
              {!holdBooking && discount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>🎟 Promo ({promoCode})</span>
                  <span>− ₹{discount.toLocaleString()}</span>
                </div>
              )}
              {holdBooking ? (
                <>
                  <div className="border-t pt-2 mt-2 flex justify-between text-sm text-gray-600">
                    <span>Estimated full fare (reference)</span>
                    <span>₹{totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="pt-2 flex justify-between font-bold text-base">
                    <span className="text-gray-800">Hold fee (pay now)</span>
                    <span style={{ color: HOLD_BLUE }} className="text-lg">
                      {holdFeePending ? "…" : `₹${(payNowAmount as number).toLocaleString()}`}
                    </span>
                  </div>
                </>
              ) : (
                <div className="border-t pt-2 mt-2 flex justify-between font-bold text-base">
                  <span className="text-gray-800">Total Payable</span>
                  <span style={{ color: OG }} className="text-lg">
                    ₹{totalAmount.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Pay CTA ── */}
        <div className="w-full lg:w-72 flex-shrink-0 space-y-3">
          {/* Pay card */}
          <div className={`bg-white rounded-2xl shadow-md overflow-hidden ${holdBooking ? "border-2 border-blue-300" : "border border-orange-100"}`}>
            <div
              className="px-5 py-4 text-white text-center"
              style={{
                background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColorLight} 100%)`,
              }}
            >
              <div className="text-xs font-semibold opacity-80 uppercase tracking-widest mb-1">
                {holdBooking ? "Amount to Hold" : "Amount to Pay"}
              </div>
              <div className="text-4xl font-black">
                {holdFeePending ? "…" : `₹${(payNowAmount as number).toLocaleString()}`}
              </div>
              {holdBooking && (
                <div className="text-xs mt-1 opacity-90 font-medium">
                  🔒 Hold fee (from airline) · full fare when you ticket
                </div>
              )}
              {!holdBooking && discount > 0 && (
                <div className="text-xs mt-1 opacity-80">
                  You're saving ₹{discount.toLocaleString()}!
                </div>
              )}
            </div>

            <div className="p-4 space-y-3">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs font-medium">
                  ⚠️ {error}
                </div>
              )}

              {step === "processing" && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div
                    className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                    style={{ borderColor: `${accentColor} ${accentColor} ${accentColor} transparent` }}
                  />
                  <p className="text-sm font-semibold text-gray-700">
                    {detectedGateway === "wallet"
                      ? "Debiting wallet…"
                      : detectedGateway === "hdfc"
                        ? "Redirecting to HDFC…"
                        : "Opening Razorpay…"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {detectedGateway === "wallet"
                      ? "Using your available to book balance"
                      : detectedGateway === "hdfc"
                        ? "You will be redirected to the HDFC payment page"
                        : "Please complete payment in the popup"}
                  </p>
                </div>
              )}

              {step === "validating" && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div
                    className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                    style={{
                      borderColor: `#22c55e #22c55e #22c55e transparent`,
                    }}
                  />
                  <p className="text-sm font-semibold text-gray-700">
                    {detectedGateway === "wallet" ? "Confirming wallet debit…" : "Validating Payment…"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {detectedGateway === "wallet"
                      ? "Proceeding to book your flight"
                      : "Confirming with payment gateway"}
                  </p>
                </div>
              )}

              {step === "summary" && (
                <button
                  onClick={handlePay}
                  disabled={holdFeePending}
                  className="w-full py-4 rounded-xl font-black text-white text-base flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] shadow-lg disabled:opacity-45 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(90deg, ${accentColor}, ${accentColorLight})`,
                    boxShadow: `0 4px 20px ${accentColor}55`,
                  }}
                >
                  🔒{" "}
                  {holdBooking
                    ? holdFeePending
                      ? "Loading hold fee…"
                      : `Confirm Hold · ₹${(payNowAmount as number).toLocaleString()}`
                    : agentPayment
                      ? `Pay with Wallet · ₹${totalAmount.toLocaleString()}`
                      : `Pay ₹${totalAmount.toLocaleString()}`}
                </button>
              )}

              {agentPayment && agentWallet && step === "summary" && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-gray-700">
                  Available to book:{" "}
                  <span className="font-semibold text-gray-900">
                    {formatWalletAmount(agentWallet.availableToBook)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <span>🔐</span>
                <span>
                  {agentPayment
                    ? "256-bit SSL encrypted · B2B wallet debit"
                    : `256-bit SSL encrypted · ${detectedGateway === "hdfc" ? "HDFC Payment Gateway" : "Razorpay"}`}
                </span>
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className={`bg-white rounded-2xl p-4 space-y-2 text-xs text-gray-600 ${holdBooking ? "border border-blue-200" : "border border-orange-100"}`}>
            <div className="font-semibold text-gray-700 mb-2">
              ✅ {holdBooking ? "About Hold Booking" : "Why Book With Us"}
            </div>
            <div className="flex items-center gap-2">
              🔒 Secure payment via {detectedGateway === "hdfc" ? "HDFC Payment Gateway" : "Razorpay"}
            </div>
            <div className="flex items-center gap-2">
              {holdBooking ? "🪑 Seat reserved — ticket issued after payment" : "✉️ Instant e-ticket on email"}
            </div>
            <div className="flex items-center gap-2">
              🔄 Easy cancellation &amp; rebooking
            </div>
            <div className="flex items-center gap-2">
              📞 24/7 customer support
            </div>
            <div className="flex items-center gap-2">
              🏆 1M+ happy travellers
            </div>
          </div>

          {/* Payment methods */}
          <div className={`bg-white rounded-2xl p-4 ${holdBooking ? "border border-blue-200" : "border border-orange-100"}`}>
            <div className="text-xs font-semibold text-gray-600 mb-2">
              Accepted Payment Methods
            </div>
            <div className="flex flex-wrap gap-2">
              {["UPI", "Cards", "Net Banking", "Wallets", "EMI"].map((m) => (
                <span
                  key={m}
                  className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-gray-200 text-gray-600"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
