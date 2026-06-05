"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { flightAPI } from "@/lib/api";
import SeatMap from "@/Components/SeatMap";
import FlightSegmentPopup from "@/Components/FlightSegmentPopup";
import {
  getFlightDetailsFromFareQuoteData,
  getBookingDisplayFlightDetails,
  getFareQuoteJourneyPrice,
  formatConnectionStopsLabel,
  formatAirportWithCity,
  getJourneyEndpoints,
  isHoldAllowedForSelectedFlight,
  flightIsInternational,
  resolveRoundtripBookingFares,
  selectedFlightIsLcc,
} from "@/lib/flightDisplay";
import {
  FLIGHT_HOLD_FEATURE_ENABLED,
  isFlightHoldBookingActive,
  isFlightHoldFeatureEnabled,
} from "@/lib/flightHoldConfig";
import {
  applyDefaultFreeAncillariesToPassengers,
  getFareQuoteAncillaryOptions,
} from "@/lib/flightBaggageAddons";
import type { PaymentDataState } from "@/lib/bookingState";
import { getLccDefaultLeadPassengerAddress } from "@/config/lccLeadAddress";
import {
  getDefaultAdultDateOfBirth,
  resolvePassengerDateOfBirth,
} from "@/config/passengerBookingDefaults";
import { getFixedGenderForTitle } from "@/lib/passengerTitleGender";
import { formatUserDate } from "@/lib/dateLocale";
import { useDateLocale } from "@/Components/DateLocaleProvider";
import {
  applySavedTravellerToPassenger,
  getTravellerIdFromMember,
  normalizeTravellerMember,
  readTravellerTitle,
  toDateOnlyIso,
} from "@/lib/travellerFields";
import { saveBookingPassengersAsTravellers } from "@/lib/agentTravellerSave";
import PassengerTravellerTypeahead from "@/Components/PassengerTravellerTypeahead";
import { openVivaAgent } from "@/Components/AgentAssist";
import {
  clampDobToBounds,
  getDobInputBoundsIso,
  getPaxAgeValidationError,
  PAX_DOB_HINT,
} from "@/lib/passengerDobRules";
import {
  flightDetailsIsSpiceJet,
  getSpiceJetDistinctPassengerNamesError,
} from "@/lib/spiceJetPassengerRules";
import {
  mergePassportFullDetailRequiredAtBook,
  passengerHasSubstantivePassportData,
  validatePassportDetailsForBooking,
} from "@/lib/passportBookingRules";
import {
  buildPassengerNameRulesContext,
  getPassengerFirstNameValidationError,
  getPassengerLastNameValidationError,
  PASSENGER_FIRST_NAME_MAX,
  PASSENGER_LAST_NAME_MAX,
  sanitizePassengerFirstName,
  sanitizePassengerLastName,
} from "@/lib/passengerNameRules";
import {
  validateCoupon,
  releaseCoupon,
  couponErrorMessage,
  getBookingChannel,
} from "@/lib/couponClient";

const OG = "#FC6603";
const HOLD_BLUE = "#1e40af";
const HOLD_BLUE_LIGHT = "#3b82f6";

interface FlightBookingProps {
  selectedFlight: any;
  passengers?: {
    adults: number;
    children: number;
    infants: number;
    origin?: string;
    destination?: string;
  };
  user?: any;
  tripType?: string;
  timeRemaining: number | null;
  onTimeUpdate: (time: number) => void;
  onBack: () => void;
  onGoToPayment: (
    data: PaymentDataState,
    options?: { holdBooking?: boolean; holdFeeInr?: number | null },
  ) => void;
}

const STEPS = ["Contact Info", "Passengers", "Review & Pay"];
const SESSION_DURATION = 15 * 60; // 15 minutes in seconds

export default function FlightBooking({
  selectedFlight,
  passengers,
  user,
  tripType,
  timeRemaining: initialTimeRemaining,
  onTimeUpdate,
  onBack,
  onGoToPayment,
}: FlightBookingProps) {
  const { inputLang } = useDateLocale();
  const isHoldBooking = isFlightHoldBookingActive(selectedFlight);
  const ctaGradient = isHoldBooking
    ? `linear-gradient(90deg, ${HOLD_BLUE}, ${HOLD_BLUE_LIGHT})`
    : `linear-gradient(90deg, ${OG}, #ff8c38)`;

  const [step, setStep]                   = useState(0); // 0=contact, 1=passengers, 2=verify
  const [guestEmail, setGuestEmail]       = useState(user?.email || "");
  const [guestMobile, setGuestMobile]     = useState(user?.phone ? String(user.phone) : "");
  const [cellCountryCode, setCellCountryCode] = useState("+91");
  const [dialCodeOpen, setDialCodeOpen] = useState(false);
  const loadHoldFeeFnRef = useRef<null | (() => Promise<number | null>)>(null);
  const holdTicketEnabledRef = useRef(false);
  const dialCodeRef = useRef<HTMLDivElement | null>(null);
  const [promoCode, setPromoCode]         = useState("");
  const [discount, setDiscount]           = useState(0);
  const [appliedToken, setAppliedToken]     = useState("");
  const [promoApplied, setPromoApplied]   = useState(false);
  const [promoApplying, setPromoApplying]   = useState(false);
  const promoFareSnapshotRef = useRef<number | null>(null);
  const [passengerDetails, setPassengerDetails] = useState<any[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [editingIdx, setEditingIdx]       = useState<number | null>(null);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(initialTimeRemaining || SESSION_DURATION);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showAddOns, setShowAddOns] = useState(false);
  const [seatMapOpen, setSeatMapOpen] = useState<{ fl: "ob" | "ib" } | null>(null);
  const [addOnFlightTab, setAddOnFlightTab] = useState<"ob" | "ib">("ob");
  const [addOnSelectedPax, setAddOnSelectedPax] = useState(0);
  const [showGst, setShowGst] = useState(false);
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstSearch, setGstSearch] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [gstCompanyName, setGstCompanyName] = useState("");
  const [gstCompanyEmail, setGstCompanyEmail] = useState("");
  const [gstContactNo, setGstContactNo] = useState("");
  const [gstAddress, setGstAddress] = useState("");
  const [holdFeeInr, setHoldFeeInr] = useState<number | null>(null);
  const [holdFeeMessage, setHoldFeeMessage] = useState<string>("");
  const [holdFeeLoading, setHoldFeeLoading] = useState(false);
  const [holdTicketProceeding, setHoldTicketProceeding] = useState(false);
  const [isPanRequiredAtBook, setIsPanRequiredAtBook] = useState(false);
  const [isPanRequiredAtTicket, setIsPanRequiredAtTicket] = useState(false);
  const [isPassportRequiredAtBook, setIsPassportRequiredAtBook] = useState(false);
  const [isPassportRequiredAtTicket, setIsPassportRequiredAtTicket] = useState(false);
  const [isPassportFullDetailRequiredAtBook, setIsPassportFullDetailRequiredAtBook] =
    useState(false);
  const [isGSTMandatory, setIsGSTMandatory] = useState(false);
  const [countryList, setCountryList] = useState<{ isoCountryCode: string; countryName: string; countryCode?: string }[]>([]);

  const bookingItineraryDetails = useMemo(
    () => getBookingDisplayFlightDetails(selectedFlight),
    [selectedFlight],
  );
  const passengerNameRulesCtx = useMemo(
    () => buildPassengerNameRulesContext(selectedFlight, bookingItineraryDetails),
    [selectedFlight, bookingItineraryDetails],
  );
  const fareQuoteAncillaryOptions = useMemo(
    () => getFareQuoteAncillaryOptions(selectedFlight),
    [selectedFlight],
  );

  useEffect(() => {
    const intl = flightIsInternational(bookingItineraryDetails);
    const fullDetail = mergePassportFullDetailRequiredAtBook(
      selectedFlight?.fareQuoteData,
      selectedFlight?.returnFareQuoteData,
      intl,
    );
    setIsPassportFullDetailRequiredAtBook(fullDetail);
  }, [selectedFlight, bookingItineraryDetails]);

  useEffect(() => {
    if (step < 1 || passengerDetails.length === 0) return;
    setPassengerDetails((prev) =>
      applyDefaultFreeAncillariesToPassengers(
        prev,
        selectedFlight,
        bookingItineraryDetails,
        fareQuoteAncillaryOptions,
      ),
    );
  }, [step, passengerDetails.length, selectedFlight, bookingItineraryDetails, fareQuoteAncillaryOptions]);

  useEffect(() => {
    fetch('/api/country-list')
      .then(r => r.json())
      .then(data => setCountryList(Array.isArray(data) ? data : []))
      .catch(() => setCountryList([{ isoCountryCode: 'IN', countryName: 'India', countryCode: '+91' }]));
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!dialCodeRef.current) return;
      if (!dialCodeRef.current.contains(e.target as Node)) setDialCodeOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining <= 0) {
      setSessionExpired(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        onTimeUpdate(newTime);
        if (newTime <= 0) {
          clearInterval(timer);
          setSessionExpired(true);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onTimeUpdate]);

  const loadHoldFee = useCallback(async (): Promise<number | null> => {
    setHoldFeeLoading(true);
    try {
      const token = String(selectedFlight?.domainToken || "").trim() || (await flightAPI.getDomainToken());
      const resultToken =
        selectedFlight?.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.ResultToken ||
        selectedFlight?.ResultToken ||
        selectedFlight?.resultToken;
      if (!token || !resultToken) {
        setHoldFeeInr(null);
        setHoldFeeMessage("");
        return null;
      }
      const resp = await flightAPI.getHoldFee(String(resultToken), token);
      const fee = Number(resp?.HoldFee ?? resp?.holdFee ?? NaN);
      const rounded = Number.isFinite(fee) ? Math.round(fee) : null;
      setHoldFeeInr(rounded);
      setHoldFeeMessage(String(resp?.Message ?? resp?.message ?? "").trim());
      return rounded;
    } catch (e) {
      console.warn("[loadHoldFee]", e);
      setHoldFeeInr(null);
      setHoldFeeMessage("");
      return null;
    } finally {
      setHoldFeeLoading(false);
    }
  }, [selectedFlight]);

  loadHoldFeeFnRef.current = loadHoldFee;

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  const flightDetails =
    getFlightDetailsFromFareQuoteData(selectedFlight.fareQuoteData) ||
    selectedFlight.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.FlightDetails?.Details ||
    selectedFlight.FlightDetails?.Details ||
    selectedFlight.flightDetails?.details;

  const defaultFfAirlineCode = (() => {
    const seg = flightDetails?.[0]?.[0] as Record<string, unknown> | undefined;
    if (!seg) return "";
    const raw =
      seg.OperatorCode ??
      seg.operatorCode ??
      String(seg.FlightNumber ?? seg.flightNumber ?? "").slice(0, 2);
    return String(raw).trim().toUpperCase().slice(0, 3);
  })();

  const resolvedFares = resolveRoundtripBookingFares(selectedFlight);
  const price = resolvedFares.onwardPrice;

  console.log('\n========== FLIGHTBOOKING RECEIVED FLIGHT ==========');
  console.log('selectedFlight.isType2Roundtrip:', selectedFlight.isType2Roundtrip);
  console.log('selectedFlight.selectedReturn (Type 1 marker):', !!selectedFlight.selectedReturn);
  console.log('flightDetails structure:');
  console.log('  - flightDetails?.length:', flightDetails?.length);
  console.log('  - flightDetails[0]?.length:', flightDetails?.[0]?.length);
  console.log('  - flightDetails[0][0] exists:', !!flightDetails?.[0]?.[0]);
  console.log('  - flightDetails[0][1] exists:', !!flightDetails?.[0]?.[1]);
  if (flightDetails?.[0]?.[0]) {
    const fd0 = flightDetails[0][0];
    console.log('  - OB Segment: ', {
      airline: fd0.OperatorName || fd0.operatorName,
      from: fd0.Origin?.AirportCode || fd0.origin?.airportCode,
      to: fd0.Destination?.AirportCode || fd0.destination?.airportCode
    });
  }
  if (flightDetails?.[0]?.[1]) {
    const fd1 = flightDetails[0][1];
    console.log('  - IB Segment: ', {
      airline: fd1.OperatorName || fd1.operatorName,
      from: fd1.Origin?.AirportCode || fd1.origin?.airportCode,
      to: fd1.Destination?.AirportCode || fd1.destination?.airportCode
    });
  }
  console.log('=================================================\n');

  // Type 1 Roundtrip: separate OB/IB (regular return or advance return after per-leg pricing)
  const isType1Roundtrip =
    !!selectedFlight.selectedReturn || selectedFlight.advanceRoundtrip === true;
  
  // Type 2 Roundtrip: Has explicit marker (even if fareQuoteData converted it to Type 1 structure)
  // When updateFareQuote is called on Type 2, it returns as Type 1 structure (flightDetails.length === 2)
  const isType2RoundtripPaired = selectedFlight.isType2Roundtrip === true;
  
  // Overall roundtrip flag
  const isRoundtrip = isType1Roundtrip || isType2RoundtripPaired;

  const returnPrice = resolvedFares.returnPrice;

  // Prefer centralized resolver (advance return uses priced Segments, not fare-quote duplicates)
  const resolvedItinerary = getBookingDisplayFlightDetails(selectedFlight);
  let displayFlightDetails = resolvedItinerary ?? flightDetails;
  if (!resolvedItinerary && isType2RoundtripPaired) {
    if (flightDetails && flightDetails.length >= 2) {
      displayFlightDetails = [flightDetails[0], flightDetails[1]];
    }
  }

  const onwardJourney = getJourneyEndpoints(displayFlightDetails?.[0]);
  const routeOriginLabel =
    formatAirportWithCity(onwardJourney?.origin) ||
    (passengers?.origin ? formatAirportWithCity({ AirportCode: passengers.origin }) : "") ||
    "—";
  const routeDestinationLabel =
    formatAirportWithCity(onwardJourney?.destination) ||
    (passengers?.destination ? formatAirportWithCity({ AirportCode: passengers.destination }) : "") ||
    "—";

  const isLccBooking = selectedFlightIsLcc(selectedFlight, displayFlightDetails ?? flightDetails);

  let { totalFare, baseFare, taxFare, obBaseFare, obTax, ibBaseFare, ibTax } = resolvedFares;
  const isAdvanceReturn = selectedFlight.advanceRoundtrip === true;
  const fareSummaryUsesPassengerBreakup =
    !isAdvanceReturn && Boolean(price?.PassengerBreakup?.ADT);

  const addOnBaggageCost = passengerDetails.reduce((sum, p) => sum + (p.obBaggage?.Price || 0) + (p.ibBaggage?.Price || 0), 0);
  const addOnMealCost    = passengerDetails.reduce((sum, p) => sum + (p.obMeal?.Price || 0)    + (p.ibMeal?.Price || 0), 0);
  const addOnSeatCost    = passengerDetails.reduce((sum, p) => sum + (p.obSeat?.Price || 0)    + (p.ibSeat?.Price || 0), 0);
  const addOnTotal       = addOnBaggageCost + addOnMealCost + addOnSeatCost;
  const grandTotal       = totalFare + addOnTotal - discount;

  console.log('=== FLIGHT BOOKING DEBUG ===');
  console.log('tripType:', tripType);
  console.log('selectedFlight.isType2Roundtrip marker:', selectedFlight.isType2Roundtrip);
  console.log('Type 1 Roundtrip (selectedReturn exists):', isType1Roundtrip);
  console.log('Type 2 Roundtrip Paired (marker-based):', isType2RoundtripPaired);
  console.log('Is Roundtrip (either type):', isRoundtrip);
  console.log('flightDetails?.length:', flightDetails?.length);
  console.log('flightDetails[0]?.length:', flightDetails[0]?.length);
  console.log('flightDetails[1]?.length:', flightDetails[1]?.length);
  console.log('displayFlightDetails?.length:', displayFlightDetails?.length);
  console.log('price:', price);
  console.log('price?.PassengerBreakup:', price?.PassengerBreakup);
  console.log('price?.PassengerBreakup?.ADT:', price?.PassengerBreakup?.ADT);
  console.log('baseFare:', baseFare);
  console.log('taxFare:', taxFare);

  const formatDateTime = (dt: string) => {
    if (!dt) return "";
    return new Date(dt.replace(" ", "T")).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  };
  const formatDate = (dt: string) => {
    if (!dt) return "";
    return formatUserDate(dt.replace(" ", "T"), { day: "2-digit", month: "short", year: "numeric" });
  };
  const getDuration = (s?: string, e?: string) => {
    if (!s || !e) return "";
    const ms = new Date(e.replace(" ", "T")).getTime() - new Date(s.replace(" ", "T")).getTime();
    if (isNaN(ms) || ms < 0) return "";
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

  // ── Step 0: Contact Info ──
  const handleContactNext = async () => {
    if (!guestEmail.trim() || !guestMobile.trim()) {
      alert("Please enter email and mobile number"); return;
    }
    if (isFlightHoldFeatureEnabled()) {
      await loadHoldFeeFnRef.current?.();
    }

    const leadTitle = readTravellerTitle(user, "Adult") || "Mr";
    const defaultAdultDob = getDefaultAdultDateOfBirth();
    const leadGender = getFixedGenderForTitle(leadTitle) || "Male";
    const list: any[] = [];
    for (let i = 0; i < (passengers?.adults  || 1); i++) {
      list.push({
        type: "Adult",
        title: i === 0 ? leadTitle : "Mr",
        firstName: "",
        lastName: "",
        dob: defaultAdultDob,
        gender: i === 0 ? leadGender : "Male",
        index: i,
        pan: "",
        passport: "",
        passportIssue: "",
        passportExpiry: "",
        passportIssueCountry: "IN",
        ffAirlineCode: "",
        ffNumber: "",
        obMeal: null, obBaggage: null, obSeat: null,
        ibMeal: null, ibBaggage: null, ibSeat: null,
        savedTravellerOrigin: null,
      });
    }
    for (let i = 0; i < (passengers?.children || 0); i++) list.push({ type: "Child",  title: "Mstr", firstName: "", lastName: "", dob: "", gender: "Male", index: i, pan: "", passport: "", passportIssue: "", passportExpiry: "", passportIssueCountry: "IN", ffAirlineCode: "", ffNumber: "", obMeal: null, obBaggage: null, obSeat: null, ibMeal: null, ibBaggage: null, ibSeat: null, savedTravellerOrigin: null });
    for (let i = 0; i < (passengers?.infants  || 0); i++) list.push({ type: "Infant", title: "Mstr", firstName: "", lastName: "", dob: "", gender: "Male", index: i, pan: "", passport: "", passportIssue: "", passportExpiry: "", passportIssueCountry: "IN", ffAirlineCode: "", ffNumber: "", obMeal: null, obBaggage: null, obSeat: null, ibMeal: null, ibBaggage: null, ibSeat: null, savedTravellerOrigin: null });
    setPassengerDetails(
      applyDefaultFreeAncillariesToPassengers(
        list,
        selectedFlight,
        bookingItineraryDetails,
        fareQuoteAncillaryOptions,
      ),
    );
    if (user?.userId) fetchFamilyMembers();
    // Auto-open ancillary panel if airline requires meal or seat selection
    if (obMealRequired || obSeatRequired || ibMealRequired || ibSeatRequired) {
      setShowAddOns(true);
    }
    // PAN / passport / GST from update-fare-quote (OB + return leg when present; flags may live on FareQuoteDetails or UpdateFareQuote)
    const readFq = (fq: any) => {
      if (!fq || typeof fq !== "object") {
        return {
          panBook: false,
          panTicket: false,
          passportBook: false,
          passportTicket: false,
          gstMandatory: false,
        };
      }
      const uq = fq.UpdateFareQuote ?? fq.updateFareQuote ?? fq;
      const fd = uq?.FareQuoteDetails ?? uq?.fareQuoteDetails ?? {};
      return {
        panBook: !!(fd.IsPanRequiredAtBook ?? fd.isPanRequiredAtBook ?? uq?.IsPanRequiredAtBook ?? uq?.isPanRequiredAtBook),
        panTicket: !!(fd.IsPanRequiredAtTicket ?? fd.isPanRequiredAtTicket ?? uq?.IsPanRequiredAtTicket ?? uq?.isPanRequiredAtTicket),
        passportBook: !!(fd.IsPassportRequiredAtBook ?? fd.isPassportRequiredAtBook ?? uq?.IsPassportRequiredAtBook ?? uq?.isPassportRequiredAtBook),
        passportTicket: !!(fd.IsPassportRequiredAtTicket ?? fd.isPassportRequiredAtTicket ?? uq?.IsPassportRequiredAtTicket ?? uq?.isPassportRequiredAtTicket),
        gstMandatory: !!(fd.IsGSTMandatory ?? fd.isGSTMandatory ?? uq?.IsGSTMandatory ?? uq?.isGSTMandatory),
      };
    };
    const obFq = selectedFlight?.fareQuoteData;
    const ibFq = selectedFlight?.returnFareQuoteData;
    const ob = readFq(obFq);
    const ib = readFq(ibFq);
    const panReqBook = ob.panBook || ib.panBook;
    const panReqTicket = ob.panTicket || ib.panTicket;
    const passportReqBook = ob.passportBook || ib.passportBook;
    const passportReqTicket = ob.passportTicket || ib.passportTicket;
    const intlItinerary = flightIsInternational(displayFlightDetails ?? flightDetails);
    const passportFullDetailAtBook = mergePassportFullDetailRequiredAtBook(
      obFq,
      ibFq,
      intlItinerary,
    );
    setIsPanRequiredAtBook(panReqBook);
    setIsPanRequiredAtTicket(panReqTicket);
    setIsPassportRequiredAtBook(passportReqBook);
    setIsPassportRequiredAtTicket(passportReqTicket);
    setIsPassportFullDetailRequiredAtBook(passportFullDetailAtBook);
    const gstMandatory = ob.gstMandatory || ib.gstMandatory;
    setIsGSTMandatory(gstMandatory);
    // If GST is mandatory, auto-enable it
    if (gstMandatory) {
      setGstEnabled(true);
    }
    setStep(1);
  };

  const fetchFamilyMembers = async () => {
    setLoadingFamily(true);
    try {
      const response = await fetch(`/api/family-members?userId=${user.userId}`);
      if (response.ok) {
        const data = await response.json();
        const rows = Array.isArray(data.response) ? data.response : [];
        setFamilyMembers(rows.map((m: Record<string, unknown>) => normalizeTravellerMember(m)));
      }
    } catch (error) {
      console.error('Fetch Family Members Error:', error);
    }
    setLoadingFamily(false);
  };

  const showPassportFieldsForBooking = () =>
    isPassportRequiredAtBook ||
    isPassportRequiredAtTicket ||
    flightIsInternational(displayFlightDetails);

  /** Issue date + issue country required when API sets `IsPassportFullDetailRequiredAtBook`. */
  const passportRequiresFullDetailAtBook = () => {
    if (!showPassportFieldsForBooking()) return false;
    return isPassportFullDetailRequiredAtBook;
  };

  const clearPassportFields = <T extends Record<string, unknown>>(pax: T): T => ({
    ...pax,
    passport: "",
    passportIssue: "",
    passportExpiry: "",
    passportIssueCountry: "IN",
  });

  const passengerNameMatchKey = passengerDetails
    .map(
      (p) =>
        `${String(p.firstName || "").trim().toLowerCase()}|${String(p.lastName || "").trim().toLowerCase()}`,
    )
    .join(";");

  // When family list loads after names are filled, sync title/DOB (not passport on domestic).
  useEffect(() => {
    if (!familyMembers.length || passengerDetails.length === 0) return;
    const includePassport = showPassportFieldsForBooking();
    setPassengerDetails((prev) => {
      let changed = false;
      const next = prev.map((pax) => {
        const fn = String(pax.firstName || "").trim().toLowerCase();
        const ln = String(pax.lastName || "").trim().toLowerCase();
        if (!fn && !ln) return pax;
        const member = familyMembers.find((m) => {
          const mfn = String(m.firstName ?? m.FirstName ?? "").trim().toLowerCase();
          const mln = String(m.lastName ?? m.LastName ?? "").trim().toLowerCase();
          return mfn === fn && mln === ln;
        });
        if (!member) return pax;
        let merged = applySavedTravellerToPassenger(pax, member, {
          sanitizeFirstName: (raw) => sanitizePassengerFirstName(raw, passengerNameRulesCtx),
          sanitizeLastName: (raw) => sanitizePassengerLastName(raw, passengerNameRulesCtx),
          includePassport,
        });
        if (!includePassport) {
          merged = clearPassportFields(merged);
        }
        if (merged.type === "Adult") {
          merged.dob = getDefaultAdultDateOfBirth();
        } else {
          const refDay = getPassengerAgeReferenceDate();
          if (merged.dob) {
            merged.dob = clampDobToBounds(merged.dob, merged.type, refDay);
          }
        }
        if (JSON.stringify(merged) === JSON.stringify(pax)) return pax;
        changed = true;
        return merged;
      });
      return changed ? next : prev;
    });
  }, [
    familyMembers,
    passengerDetails.length,
    passengerNameMatchKey,
    isPassportRequiredAtBook,
    isPassportRequiredAtTicket,
    isPassportFullDetailRequiredAtBook,
    displayFlightDetails,
    passengerNameRulesCtx,
  ]);

  // Strip profile passport data whenever this booking does not require passport.
  useEffect(() => {
    if (showPassportFieldsForBooking()) return;
    setPassengerDetails((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        if (!passengerHasSubstantivePassportData(p)) return p;
        changed = true;
        return clearPassportFields(p);
      });
      return changed ? next : prev;
    });
  }, [
    isPassportRequiredAtBook,
    isPassportRequiredAtTicket,
    isPassportFullDetailRequiredAtBook,
    displayFlightDetails,
    passengerDetails.length,
  ]);

  const parseIsoDateOnly = (iso: string | undefined): Date | null => {
    const v = String(iso || "").trim();
    if (!v) return null;
    const d = new Date(`${v}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  };

  const toIsoDateLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getDobMinIsoForPaxType = (paxType: string): string | undefined =>
    getDobInputBoundsIso(paxType, getPassengerAgeReferenceDate()).min;

  const getPassportIssueMinIso = (pax: { dob?: string; type?: string }) => {
    const dob = String(pax?.dob || "").trim();
    if (dob) return dob;
    return getDobMinIsoForPaxType(String(pax?.type || "Adult"));
  };

  const getPassportIssueMaxIso = () => toIsoDateLocal(new Date());

  const getTravelEndIsoFromDetails = (details: any[][] | undefined): string | undefined => {
    if (!details || details.length === 0) return undefined;
    const lastLeg = details[details.length - 1];
    const lastSeg = Array.isArray(lastLeg) ? lastLeg[lastLeg.length - 1] : null;
    const dest = lastSeg?.Destination || lastSeg?.destination;
    const dt: string = String(dest?.DateTime || dest?.dateTime || "").trim();
    if (!dt) return undefined;
    const d = new Date(dt.replace(" ", "T"));
    if (isNaN(d.getTime())) return undefined;
    return toIsoDateLocal(d);
  };

  const getPassportExpiryMinIso = (details: any[][] | undefined): string => {
    const today = toIsoDateLocal(new Date());
    const travelEnd = getTravelEndIsoFromDetails(details);
    if (!travelEnd) return today;
    return travelEnd > today ? travelEnd : today;
  };

  /** Passport must remain valid at least 6 months from today (local date). */
  const getPassportExpirySixMonthsFromTodayIso = (): string => {
    const n = new Date();
    const localMidnight = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    const sixOut = new Date(localMidnight.getFullYear(), localMidnight.getMonth() + 6, localMidnight.getDate());
    return toIsoDateLocal(sixOut);
  };

  /** Earliest allowed expiry: later of (travel end vs today) and (today + 6 months). */
  const getEffectivePassportExpiryMinIso = (details: any[][] | undefined): string => {
    const travelOrToday = getPassportExpiryMinIso(details);
    const sixMo = getPassportExpirySixMonthsFromTodayIso();
    return travelOrToday > sixMo ? travelOrToday : sixMo;
  };

  /** Latest journey departure (local midnight), else today — used for pax age rules on travel date. */
  const getPassengerAgeReferenceDate = (): Date => {
    try {
      const legs = displayFlightDetails;
      const lastLeg = legs?.[legs.length - 1];
      const seg = lastLeg?.[0];
      const dt = seg?.Origin?.DateTime || seg?.origin?.dateTime;
      if (dt) {
        const raw = new Date(String(dt).replace(" ", "T"));
        if (!isNaN(raw.getTime())) {
          return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
        }
      }
    } catch {}
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  };

  const handleSelectFamilyMember = (idx: number, member: any) => {
    const includePassport = showPassportFieldsForBooking();
    const updated = [...passengerDetails];
    updated[idx] = applySavedTravellerToPassenger(updated[idx], member, {
      sanitizeFirstName: (raw) => sanitizePassengerFirstName(raw, passengerNameRulesCtx),
      sanitizeLastName: (raw) => sanitizePassengerLastName(raw, passengerNameRulesCtx),
      includePassport,
    });
    if (!includePassport) {
      updated[idx] = clearPassportFields(updated[idx]);
    }
    if (updated[idx].dob) {
      updated[idx].dob = clampDobToBounds(
        updated[idx].dob,
        updated[idx].type,
        getPassengerAgeReferenceDate(),
      );
    }
    const dobD = parseIsoDateOnly(updated[idx].dob);
    const issueD = parseIsoDateOnly(updated[idx].passportIssue);
    if (dobD && issueD && issueD.getTime() < dobD.getTime()) {
      updated[idx].passportIssue = updated[idx].dob;
    }
    updated[idx].obMeal = null; updated[idx].obBaggage = null; updated[idx].obSeat = null;
    updated[idx].ibMeal = null; updated[idx].ibBaggage = null; updated[idx].ibSeat = null;
    updated[idx].savedTravellerOrigin = getTravellerIdFromMember(member) || null;
    setPassengerDetails(
      applyDefaultFreeAncillariesToPassengers(
        updated,
        selectedFlight,
        bookingItineraryDetails,
        fareQuoteAncillaryOptions,
      ),
    );
  };

  const handlePassengerChange = (idx: number, field: string, value: string) => {
    const updated = [...passengerDetails];
    if (field === "title") {
      updated[idx].title = value;
      const fixedGender = getFixedGenderForTitle(value);
      if (fixedGender) updated[idx].gender = fixedGender;
    } else if (field === "gender") {
      const fixedGender = getFixedGenderForTitle(updated[idx]?.title);
      // If title implies a fixed gender, don't allow incompatible selection.
      updated[idx].gender = fixedGender || value;
    } else if (field === "dob") {
      if (updated[idx].type === "Adult") {
        updated[idx].dob = getDefaultAdultDateOfBirth();
        setPassengerDetails(updated);
        return;
      }
      const clamped = clampDobToBounds(value, updated[idx].type, getPassengerAgeReferenceDate());
      updated[idx].dob = clamped;
      if (showPassportFieldsForBooking()) {
        const dobD = parseIsoDateOnly(clamped);
        const issueD = parseIsoDateOnly(updated[idx].passportIssue);
        if (dobD && issueD && issueD.getTime() < dobD.getTime()) {
          updated[idx].passportIssue = value;
        }
      }
    } else if (field === "passportIssue") {
      const maxIso = getPassportIssueMaxIso();
      const minIso = getPassportIssueMinIso(updated[idx]);
      let v = value;
      if (minIso && v && v < minIso) v = minIso;
      if (v && v > maxIso) v = maxIso;
      updated[idx].passportIssue = v;
    } else if (field === "firstName") {
      updated[idx].firstName = sanitizePassengerFirstName(value, passengerNameRulesCtx);
    } else if (field === "lastName") {
      updated[idx].lastName = sanitizePassengerLastName(value, passengerNameRulesCtx);
    } else if (field === "ffAirlineCode") {
      updated[idx].ffAirlineCode = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3);
    } else if (field === "ffNumber") {
      updated[idx].ffNumber = value.toUpperCase();
    } else {
      updated[idx][field] = value;
    }
    setPassengerDetails(updated);
  };

  const handlePassengerNext = async () => {
    if (!showPassportFieldsForBooking()) {
      const needsClear = passengerDetails.some((p) => passengerHasSubstantivePassportData(p));
      if (needsClear) {
        setPassengerDetails((prev) =>
          prev.map((p) => (passengerHasSubstantivePassportData(p) ? clearPassportFields(p) : p)),
        );
      }
    }

    for (let i = 0; i < passengerDetails.length; i++) {
      const p = passengerDetails[i];
      const label = `${p.type} ${Number(p.index ?? 0) + 1}`;
      const fnErr = getPassengerFirstNameValidationError(
        p.firstName,
        `${label}: First name`,
        passengerNameRulesCtx,
      );
      if (fnErr) {
        alert(fnErr);
        return;
      }
      const lnErr = getPassengerLastNameValidationError(
        p.lastName,
        `${label}: Last name`,
        passengerNameRulesCtx,
      );
      if (lnErr) {
        alert(lnErr);
        return;
      }
      const ffNum = String(p.ffNumber || "").trim();
      const ffAirline = String(p.ffAirlineCode || "").trim();
      if (ffNum && !ffAirline) {
        alert(`${label}: Please enter the frequent flyer airline code (e.g. 6E, AI).`);
        return;
      }
      if (ffAirline && !ffNum) {
        alert(`${label}: Please enter the frequent flyer number, or leave both fields empty.`);
        return;
      }
      if (ffAirline && ffAirline.length < 2) {
        alert(`${label}: Frequent flyer airline code must be at least 2 characters.`);
        return;
      }
    }

    if (flightDetailsIsSpiceJet(displayFlightDetails ?? flightDetails)) {
      const spiceJetNameErr = getSpiceJetDistinctPassengerNamesError(passengerDetails);
      if (spiceJetNameErr) {
        alert(spiceJetNameErr);
        return;
      }
    }

    const ageRef = getPassengerAgeReferenceDate();
    for (const p of passengerDetails) {
      const dobStr = resolvePassengerDateOfBirth(p.type, p.dob);
      if (!dobStr) {
        alert(`Please enter date of birth for ${p.type} ${Number(p.index ?? 0) + 1}.`);
        return;
      }
      const ageErr = getPaxAgeValidationError(p.type, dobStr, ageRef);
      if (ageErr) {
        alert(`${p.type} ${Number(p.index ?? 0) + 1}: ${ageErr}`);
        return;
      }
    }

    // Validate PAN requirement (if either Book or Ticket is required)
    const showPanField = isPanRequiredAtBook || isPanRequiredAtTicket;
    const INDIAN_PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (showPanField) {
      for (const p of passengerDetails) {
        const pan = String(p.pan || "").trim().toUpperCase();
        if (!pan) {
          alert("PAN number is required for all passengers");
          return;
        }
        if (!INDIAN_PAN_REGEX.test(pan)) {
          alert(
            `Invalid PAN for ${p.type} ${Number(p.index ?? 0) + 1}. Use format ABCDE1234F (5 letters, 4 digits, 1 letter).`,
          );
          return;
        }
      }
    }

    if (showPassportFieldsForBooking()) {
      const passportErr = validatePassportDetailsForBooking(passengerDetails, {
        requiresFullDetail: passportRequiresFullDetailAtBook(),
        parseIsoDateOnly,
        getPassportIssueMinIso,
        getEffectivePassportExpiryMinIso,
        flightDetails: displayFlightDetails,
      });
      if (passportErr) {
        alert(passportErr);
        return;
      }
    }

    // Validate GST requirement when mandatory
    if (isGSTMandatory && (!gstNumber.trim() || !gstCompanyName.trim() || !gstCompanyEmail.trim() || !gstContactNo.trim() || !gstAddress.trim())) {
      alert("GST details are mandatory. Please fill all GST fields."); return;
    }

    // Enforce required meal / seat selections
    const nonInfants = passengerDetails.filter(p => p.type !== "Infant");
    if (obMealRequired && mealOptions.length > 0) {
      const missing = nonInfants.filter(p => !p.obMeal);
      if (missing.length > 0) {
        setShowAddOns(true);
        alert(`Meal selection is mandatory for this flight.\nPlease choose a meal for: ${missing.map(p => `${p.type} ${p.index + 1}`).join(", ")}`);
        return;
      }
    }
    if (obSeatRequired && seatOptions.length > 0) {
      const missing = nonInfants.filter(p => !p.obSeat);
      if (missing.length > 0) {
        setShowAddOns(true);
        alert(`Seat selection is mandatory for this flight.\nPlease choose a seat for: ${missing.map(p => `${p.type} ${p.index + 1}`).join(", ")}`);
        return;
      }
    }
    if (isRoundtrip) {
      if (ibMealRequired && ibMealOptions.length > 0) {
        const missing = nonInfants.filter(p => !p.ibMeal);
        if (missing.length > 0) {
          setShowAddOns(true);
          setAddOnFlightTab("ib");
          alert(`Meal selection is mandatory for the return flight.\nPlease choose a meal for: ${missing.map(p => `${p.type} ${p.index + 1}`).join(", ")}`);
          return;
        }
      }
      if (ibSeatRequired && ibSeatOptions.length > 0) {
        const missing = nonInfants.filter(p => !p.ibSeat);
        if (missing.length > 0) {
          setShowAddOns(true);
          setAddOnFlightTab("ib");
          alert(`Seat selection is mandatory for the return flight.\nPlease choose a seat for: ${missing.map(p => `${p.type} ${p.index + 1}`).join(", ")}`);
          return;
        }
      }
    }

    // Call extra-services API for any leg that has add-on fees > 0
    const domainToken = selectedFlight?.domainToken || "";
    const obResultToken =
      selectedFlight?.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.ResultToken ||
      selectedFlight?.ResultToken ||
      selectedFlight?.resultToken;
    let ibResultToken =
      selectedFlight?.returnFareQuoteData?.UpdateFareQuote?.FareQuoteDetails?.ResultToken ||
      selectedFlight?.selectedReturn?.ResultToken ||
      selectedFlight?.selectedReturn?.resultToken;
    
    // Type 2 Roundtrip: Use same result token for both OB and IB (paired flights)
    if (isType2RoundtripPaired && !ibResultToken) {
      ibResultToken = obResultToken;
    }

    const obPriceChanged = !!(
      selectedFlight?.fareQuoteData?.isPriceChanged ||
      selectedFlight?.fareQuoteData?.IsPriceChanged ||
      selectedFlight?.fareQuoteData?.UpdateFareQuote?.PriceChanged ||
      selectedFlight?.fareQuoteData?.PriceChanged
    );
    const ibPriceChanged = !!(
      selectedFlight?.returnFareQuoteData?.isPriceChanged ||
      selectedFlight?.returnFareQuoteData?.IsPriceChanged ||
      selectedFlight?.returnFareQuoteData?.UpdateFareQuote?.PriceChanged ||
      selectedFlight?.returnFareQuoteData?.PriceChanged
    );

    const obBreakup = getFareQuoteJourneyPrice(selectedFlight?.fareQuoteData)?.PriceBreakup;
    const ibBreakup = getFareQuoteJourneyPrice(selectedFlight?.returnFareQuoteData)?.PriceBreakup;

    const obFees: any = {
      ExtraBaggageFee: passengerDetails.reduce((s, p) => s + (p.obBaggage?.Price || 0), 0),
      ExtraMealFee:    passengerDetails.reduce((s, p) => s + (p.obMeal?.Price    || 0), 0),
      ExtraSeatFee:    passengerDetails.reduce((s, p) => s + (p.obSeat?.Price    || 0), 0),
    };
    if (obPriceChanged && obBreakup) {
      obFees.BasicFare = obBreakup.BasicFare ?? 0;
      obFees.Tax       = obBreakup.Tax       ?? 0;
    }

    const ibFees: any = {
      ExtraBaggageFee: passengerDetails.reduce((s, p) => s + (p.ibBaggage?.Price || 0), 0),
      ExtraMealFee:    passengerDetails.reduce((s, p) => s + (p.ibMeal?.Price    || 0), 0),
      ExtraSeatFee:    passengerDetails.reduce((s, p) => s + (p.ibSeat?.Price    || 0), 0),
    };
    if (ibPriceChanged && ibBreakup) {
      ibFees.BasicFare = ibBreakup.BasicFare ?? 0;
      ibFees.Tax       = ibBreakup.Tax       ?? 0;
    }

    try {
      const calls: Promise<any>[] = [];
      // Always send fees (even 0) so backend stays in sync if user removes a previously added service
      if (isType2RoundtripPaired) {
        // Type 2 Roundtrip: OB and IB share the same token — send a single call with combined fees
        console.log('[extra-services] Roundtrip Type 2 (OB+IB paired) — single call, token:', obResultToken);
        if (obResultToken && domainToken) {
          const combinedFees: any = {
            ExtraBaggageFee: (obFees.ExtraBaggageFee || 0) + (ibFees.ExtraBaggageFee || 0),
            ExtraMealFee:    (obFees.ExtraMealFee    || 0) + (ibFees.ExtraMealFee    || 0),
            ExtraSeatFee:    (obFees.ExtraSeatFee    || 0) + (ibFees.ExtraSeatFee    || 0),
          };
          if (obFees.BasicFare !== undefined || ibFees.BasicFare !== undefined)
            combinedFees.BasicFare = (obFees.BasicFare ?? 0) + (ibFees.BasicFare ?? 0);
          if (obFees.Tax !== undefined || ibFees.Tax !== undefined)
            combinedFees.Tax = (obFees.Tax ?? 0) + (ibFees.Tax ?? 0);
          calls.push(flightAPI.saveExtraServices(obResultToken, domainToken, combinedFees));
        }
      } else {
        // Type 1 Roundtrip or Oneway: separate tokens, separate calls
        if (isRoundtrip)
          console.log('[extra-services] Roundtrip Type 1 (OB/IB separate) — two calls, OB token:', obResultToken, 'IB token:', ibResultToken);
        else
          console.log('[extra-services] Oneway — single call, token:', obResultToken);
        if (obResultToken && domainToken)
          calls.push(flightAPI.saveExtraServices(obResultToken, domainToken, obFees));
        if (ibResultToken && domainToken)
          calls.push(flightAPI.saveExtraServices(ibResultToken, domainToken, ibFees));
      }
      if (calls.length > 0) await Promise.all(calls);
    } catch (err) {
      console.error("Extra services API error:", err);
      // Non-blocking — proceed to review even if the call fails
    }

    if (holdTicketEnabledRef.current) {
      await loadHoldFeeFnRef.current?.();
    }

    if (user?.userId) {
      await saveBookingPassengersAsTravellers({
        passengers: passengerDetails,
        userId: user.userId,
        familyMembers,
      });
      await fetchFamilyMembers();
    }

    setStep(2);
  };

  const handleAddOnSelect = (paxIdx: number, flight: "ob" | "ib", type: "meal" | "baggage" | "seat", value: any) => {
    const updated = [...passengerDetails];
    const key = `${flight}${type.charAt(0).toUpperCase()}${type.slice(1)}`;
    updated[paxIdx][key] = value;
    setPassengerDetails(updated);
  };

  const validatePassengerNamesForPayment = (): boolean => {
    for (let i = 0; i < passengerDetails.length; i++) {
      const p = passengerDetails[i];
      const label = `${p.type} ${Number(p.index ?? 0) + 1}`;
      const fnErr = getPassengerFirstNameValidationError(
        p.firstName,
        `${label}: First name`,
        passengerNameRulesCtx,
      );
      if (fnErr) {
        alert(fnErr);
        return false;
      }
      const lnErr = getPassengerLastNameValidationError(
        p.lastName,
        `${label}: Last name`,
        passengerNameRulesCtx,
      );
      if (lnErr) {
        alert(lnErr);
        return false;
      }
      const ffNum = String(p.ffNumber || "").trim();
      const ffAirline = String(p.ffAirlineCode || "").trim();
      if (ffNum && !ffAirline) {
        alert(`${label}: Please enter the frequent flyer airline code (e.g. 6E, AI).`);
        return false;
      }
      if (ffAirline && !ffNum) {
        alert(`${label}: Please enter the frequent flyer number, or leave both fields empty.`);
        return false;
      }
      if (ffAirline && ffAirline.length < 2) {
        alert(`${label}: Frequent flyer airline code must be at least 2 characters.`);
        return false;
      }
    }
    if (flightDetailsIsSpiceJet(displayFlightDetails ?? flightDetails)) {
      const spiceJetNameErr = getSpiceJetDistinctPassengerNamesError(passengerDetails);
      if (spiceJetNameErr) {
        alert(spiceJetNameErr);
        return false;
      }
    }
    return true;
  };

  const passengerDetailsForPayment = () => {
    const withAdultDob = passengerDetails.map((p) =>
      p.type === "Adult" ? { ...p, dob: getDefaultAdultDateOfBirth() } : p,
    );
    if (showPassportFieldsForBooking()) return withAdultDob;
    return withAdultDob.map((p) =>
      passengerHasSubstantivePassportData(p) ? clearPassportFields(p) : p,
    );
  };

  const buildPaymentData = (): PaymentDataState => {
    const data: PaymentDataState = {
      passengerDetails: passengerDetailsForPayment(),
      guestEmail,
      guestMobile,
      cellCountryCode,
      discount,
      promoCode,
      appliedToken: appliedToken || undefined,
    };
    if (isLccBooking) {
      data.leadPassengerAddress = getLccDefaultLeadPassengerAddress();
    }
    return data;
  };

  const handleConfirmBooking = () => {
    if (!validatePassengerNamesForPayment()) return;
    onGoToPayment(buildPaymentData(), { holdBooking: false });
  };

  const handleHoldTicketProceed = async () => {
    if (!isFlightHoldFeatureEnabled() || !holdTicketEnabled) return;
    if (!validatePassengerNamesForPayment()) return;
    setHoldTicketProceeding(true);
    try {
      let fee = holdFeeInr;
      if (fee == null || !Number.isFinite(fee) || fee <= 0) {
        fee = (await loadHoldFeeFnRef.current?.()) ?? null;
      }
      if (fee == null || !Number.isFinite(fee) || fee <= 0) {
        alert(
          "Could not fetch hold fee from the server. Please wait a moment and try again, or use Proceed to Payment for a full ticket purchase.",
        );
        return;
      }
      onGoToPayment(buildPaymentData(), { holdBooking: true, holdFeeInr: fee });
    } finally {
      setHoldTicketProceeding(false);
    }
  };

  const clearPromoState = () => {
    setPromoCode("");
    setDiscount(0);
    setAppliedToken("");
    setPromoApplied(false);
    promoFareSnapshotRef.current = null;
  };

  const handleRemovePromo = async () => {
    const userOid = Number(user?.userId);
    if (appliedToken && userOid > 0) {
      try {
        await releaseCoupon({ appliedToken, userOid });
      } catch {
        /* still clear UI */
      }
    }
    clearPromoState();
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      alert("Please enter a promo code");
      return;
    }
    const userOid = Number(user?.userId);
    if (!userOid || userOid <= 0) {
      alert("Please sign in to apply a promo code");
      return;
    }
    const fareForCoupon = Math.round((totalFare + addOnTotal) * 100) / 100;
    setPromoApplying(true);
    try {
      const result = await validateCoupon({
        code: promoCode.trim(),
        userOid,
        channel: getBookingChannel(),
        totalFare: fareForCoupon,
        resultTokenHash: String(
          selectedFlight?.resultToken || selectedFlight?.ResultToken || "",
        ).slice(0, 128) || undefined,
      });
      if (!result.valid || !result.discountAmount) {
        alert(couponErrorMessage(result));
        return;
      }
      setDiscount(Math.round(result.discountAmount));
      setPromoCode(result.promoCode || promoCode.trim().toUpperCase());
      setAppliedToken(result.appliedToken || "");
      setPromoApplied(true);
      promoFareSnapshotRef.current = fareForCoupon;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not apply promo code");
    } finally {
      setPromoApplying(false);
    }
  };

  useEffect(() => {
    if (!promoApplied || promoFareSnapshotRef.current == null) return;
    const current = Math.round((totalFare + addOnTotal) * 100) / 100;
    if (Math.abs(current - promoFareSnapshotRef.current) > 0.01) {
      void handleRemovePromo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalFare, addOnTotal, promoApplied]);


  const paxTypeIcon: Record<string, string> = { Adult: "🧑", Child: "👦", Infant: "👶" };

  console.log('=== FLIGHT BOOKING COMPONENT ===');
  console.log('Current step:', step);
  console.log('selectedFlight:', selectedFlight);
  console.log('fareQuoteData:', selectedFlight?.fareQuoteData);

  const isInternational = flightIsInternational(displayFlightDetails);

  // Extract add-ons from fare quote data (handle both uppercase and lowercase keys)
  const fareQuoteDetails = selectedFlight?.fareQuoteData?.UpdateFareQuote?.FareQuoteDetails ||
                          selectedFlight?.fareQuoteData?.updateFareQuote?.fareQuoteDetails;
  
  const firstNameHint: string =
    fareQuoteDetails?.firstNameFormat ||
    fareQuoteDetails?.FirstNameFormat ||
    "Enter first name exactly as it appears on your passport or government ID.";
  const lastNameHint: string =
    fareQuoteDetails?.lastNameFormat ||
    fareQuoteDetails?.LastNameFormat ||
    "Enter last name exactly as it appears on your passport or government ID.";
  const baggageOptions = fareQuoteDetails?.baggage?.[0] || fareQuoteDetails?.Baggage?.[0] || [];
  const mealOptions = fareQuoteDetails?.mealDynamic?.[0] || fareQuoteDetails?.MealDynamic?.[0] || [];
  const seatOptions = fareQuoteDetails?.seatDynamic?.[0]?.SegmentSeat ||
                     fareQuoteDetails?.SeatDynamic?.[0]?.SegmentSeat || [];

  const obMealRequired = !!(fareQuoteDetails?.IsMealRequired || fareQuoteDetails?.isMealRequired);
  const obSeatRequired = !!(fareQuoteDetails?.IsSeatRequired || fareQuoteDetails?.isSeatRequired);

  // IB (return) add-on options
  const returnFareQuoteDetails = selectedFlight?.returnFareQuoteData?.UpdateFareQuote?.FareQuoteDetails ||
                                 selectedFlight?.returnFareQuoteData?.updateFareQuote?.fareQuoteDetails;
  const ibBaggageOptions = returnFareQuoteDetails?.baggage?.[0] || returnFareQuoteDetails?.Baggage?.[0] || [];
  const ibMealOptions    = returnFareQuoteDetails?.mealDynamic?.[0] || returnFareQuoteDetails?.MealDynamic?.[0] || [];
  const ibSeatOptions    = returnFareQuoteDetails?.seatDynamic?.[0]?.SegmentSeat ||
                           returnFareQuoteDetails?.SeatDynamic?.[0]?.SegmentSeat || [];

  const ibMealRequired = !!(returnFareQuoteDetails?.IsMealRequired || returnFareQuoteDetails?.isMealRequired);
  const ibSeatRequired = !!(returnFareQuoteDetails?.IsSeatRequired || returnFareQuoteDetails?.isSeatRequired);

  /** Env flag + update-fare-quote `isHoldAllowed`. */
  const holdTicketEnabled =
    FLIGHT_HOLD_FEATURE_ENABLED && isHoldAllowedForSelectedFlight(selectedFlight);
  holdTicketEnabledRef.current = holdTicketEnabled;


  const getLegRefundable = (legIndex: number, seg: any): boolean => {
    const fq = legIndex === 0 ? fareQuoteDetails : returnFareQuoteDetails;
    const raw =
      fq?.Attr?.IsRefundable ??
      fq?.attr?.isRefundable ??
      fq?.IsRefundable ??
      fq?.isRefundable;
    if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
    if (raw === false || raw === "false" || raw === 0 || raw === "0") return false;
    const segRaw = seg?.Attr?.IsRefundable ?? seg?.attr?.isRefundable;
    return segRaw === true || segRaw === "true" || segRaw === 1 || segRaw === "1";
  };

  console.log('=== ADD-ONS DEBUG ===');
  console.log('fareQuoteDetails:', fareQuoteDetails);
  console.log('baggageOptions length:', baggageOptions.length);
  console.log('baggageOptions:', baggageOptions);
  console.log('mealOptions length:', mealOptions.length);
  console.log('mealOptions:', mealOptions);
  console.log('seatOptions length:', seatOptions.length);
  console.log('seatOptions:', seatOptions);
  console.log('Show add-ons button?', baggageOptions.length > 0 || mealOptions.length > 0 || seatOptions.length > 0);

  if (sessionExpired) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
          <div className="text-6xl mb-4">⏰</div>
          <h2 className="text-2xl font-bold mb-4" style={{ color: OG }}>Session Expired</h2>
          <p className="text-gray-600 mb-6">
            Your booking session has expired. Please search for flights again to continue.
          </p>
          <button
            onClick={onBack}
            className="w-full py-3 rounded-xl font-bold text-white text-base transition-all hover:opacity-90"
            style={{ background: `linear-gradient(90deg, ${OG}, #ff8c38)` }}
          >
            Search Flights Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-5xl mx-auto">
      {/* Back */}
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-primary hover:text-primary-dark font-medium">
        ← Back to Results
      </button>

      {/* Hold Booking notice */}
      {selectedFlight?.holdBooking && (
        <div className="mb-4 rounded-xl border-2 border-blue-300 bg-blue-50 px-4 py-3 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🔒</span>
          <div>
            <div className="font-bold text-sm text-blue-800">Hold Booking</div>
            <div className="text-xs text-blue-700 mt-0.5">
              Your seat will be reserved but the ticket will <strong>not</strong> be issued immediately.
              Complete payment to confirm and receive your ticket.
            </div>
          </div>
        </div>
      )}

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
              Complete your booking before the timer expires
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

      {/* Step indicator */}
      <div className="flex items-center mb-6">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors"
                style={{
                  background: i <= step ? OG : "white",
                  borderColor: i <= step ? OG : "#d1d5db",
                  color: i <= step ? "white" : "#9ca3af",
                }}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span className="text-[10px] mt-1 font-medium" style={{ color: i <= step ? OG : "#9ca3af" }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 mb-3" style={{ background: i < step ? OG : "#e5e7eb" }} />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── Left column: step content ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Flight Info Card */}
          <div className="rounded-2xl overflow-hidden shadow-md border border-orange-100">
            <div style={{ background: `linear-gradient(135deg, ${OG} 0%, #ff8c38 100%)` }} className="px-5 py-3 flex items-center justify-between">
              <div className="text-white">
                <div className="text-xs font-semibold opacity-80 uppercase tracking-wider">
                  {tripType === "multicity" ? "Multi City" : isRoundtrip ? "Round Trip" : "One Way"}
                </div>
                <div className="font-bold text-lg">
                  {tripType === "multicity" && displayFlightDetails && displayFlightDetails.length > 1
                    ? displayFlightDetails.map((seg: any) =>
                        formatAirportWithCity(seg?.[0]?.Origin || seg?.[0]?.origin) || "—"
                      ).join(" → ") + " → " +
                      (() => {
                        const last = displayFlightDetails[displayFlightDetails.length - 1];
                        return formatAirportWithCity(last?.[0]?.Destination || last?.[0]?.destination) || "—";
                      })()
                    : (
                        <>
                          {routeOriginLabel} {isRoundtrip ? "↔" : "→"} {routeDestinationLabel}
                        </>
                      )
                  }
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-3xl">✈️</span>
              </div>
            </div>
            <div className="bg-white px-5 py-4">
              {displayFlightDetails?.map((segment: any, si: number) => {
                const segFirst = segment?.[0];
                const segLast = segment?.[(segment?.length ?? 1) - 1] || segFirst;
                if (!segFirst) return null;
                const orig = segFirst.Origin || segFirst.origin;
                const dest = segLast?.Destination || segLast?.destination;
                return (
                  <div key={si} className={si > 0 ? "mt-4 pt-4 border-t border-dashed border-gray-200" : ""}>
                    {(isRoundtrip || tripType === "multicity") && (
                      <div className="text-xs font-semibold mb-2" style={{ color: OG }}>
                        {tripType === "multicity"
                          ? `✈ Leg ${si + 1}`
                          : si === 0 ? "✈ Onward" : "✈ Return"}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {/* Airline */}
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <img
                          src={`/airlines/${(segFirst.OperatorCode || segFirst.operatorCode || (segFirst.FlightNumber || segFirst.flightNumber || "").slice(0, 2) || "").trim()}.gif`}
                          alt={segFirst.OperatorName || segFirst.operatorName}
                          className="w-10 h-10 object-contain flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).src = "/airlines/nologo.gif"; }}
                        />
                        <div>
                          <div className="font-semibold text-sm text-gray-800">{segFirst.OperatorName || segFirst.operatorName}</div>
                          <div className="text-xs text-gray-400">{segFirst.OperatorCode || segFirst.operatorCode} {segFirst.FlightNumber || segFirst.flightNumber}</div>
                          <div className="text-[10px] text-gray-400">{segFirst.Attr?.CabinClass || segFirst.attr?.cabinClass}</div>
                        </div>
                      </div>
                      {/* Route */}
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <div className="text-xl font-black text-gray-900">{formatDateTime(orig?.DateTime || orig?.dateTime)}</div>
                          <div className="text-sm font-bold text-gray-700">{formatAirportWithCity(orig)}</div>
                          <div className="text-[11px] text-gray-400">{formatDate(orig?.DateTime || orig?.dateTime)}</div>
                        </div>
                        <div className="flex flex-col items-center px-2">
                          <div className="text-[11px] text-gray-400">{getDuration(orig?.DateTime || orig?.dateTime, dest?.DateTime || dest?.dateTime)}</div>
                          <div className="flex items-center gap-1 my-0.5">
                            <div className="w-10 h-px bg-gray-300" />
                            <FlightSegmentPopup
                              segment={segment}
                              departureCity={orig?.CityName || orig?.cityName || orig?.AirportCode || orig?.airportCode || ""}
                              arrivalCity={(() => { const last = segment?.[segment.length - 1]; const d = last?.Destination || last?.destination; return d?.CityName || d?.cityName || d?.AirportCode || d?.airportCode || ""; })()}
                            />
                            <div className="w-10 h-px bg-gray-300" />
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {formatConnectionStopsLabel(segment?.length || 0)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-black text-gray-900">{formatDateTime(dest?.DateTime || dest?.dateTime)}</div>
                          <div className="text-sm font-bold text-gray-700">{formatAirportWithCity(dest)}</div>
                          <div className="text-[11px] text-gray-400">{formatDate(dest?.DateTime || dest?.dateTime)}</div>
                        </div>
                      </div>
                      {/* Baggage badge */}
                      <div className="text-center hidden sm:block">
                        <div className="text-xs font-semibold text-gray-700">🧳 {segFirst.Attr?.Baggage || segFirst.attr?.baggage || "15 Kg"}</div>
                        {(() => {
                          const refundable = getLegRefundable(si, segFirst);
                          return (
                            <div className={`text-[10px] font-semibold mt-0.5 ${refundable ? "text-green-600" : "text-red-500"}`}>
                              {refundable ? "✅ Refundable" : "❌ Non-Refundable"}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── STEP 0: Contact Info ── */}
          {step === 0 && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-visible">
              <div className="px-5 py-3 border-b border-gray-100" style={{ background: "#fff7ed" }}>
                <h3 className="font-bold text-gray-800">📧 Contact Information</h3>
                <p className="text-xs text-gray-500 mt-0.5">Booking confirmation will be sent to this contact</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address *</label>
                    <input
                      type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)}
                      placeholder="you@example.com"
                      disabled={!!user}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                      style={{ focusRingColor: OG } as any}
                      onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                      onBlur={e => e.target.style.boxShadow = ""}
                    />
                    {user && <p className="text-xs text-gray-500 mt-1">✓ Using your account email</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile Number *</label>
                    <div className="flex">
                      <div ref={dialCodeRef} className="relative">
                        <button
                          type="button"
                          className="border border-r-0 border-gray-200 rounded-l-xl px-3 py-2.5 text-sm text-gray-700 bg-gray-50 focus:outline-none hover:bg-gray-100 min-w-[84px] flex items-center justify-between gap-2"
                          onClick={() => setDialCodeOpen((v) => !v)}
                          aria-haspopup="listbox"
                          aria-expanded={dialCodeOpen}
                        >
                          <span>{cellCountryCode}</span>
                          <span className="text-[10px] text-gray-400">▼</span>
                        </button>
                        {dialCodeOpen && (
                          <div
                            role="listbox"
                            className="absolute z-50 mt-1 w-80 max-h-80 overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl"
                          >
                            {[
                              // Ensure default exists even if API list is empty
                              ...(countryList && countryList.length
                                ? countryList
                                    .map((c) => ({
                                      isoCountryCode: c.isoCountryCode,
                                      countryName: c.countryName,
                                      countryCode: String(c.countryCode || "").trim(),
                                    }))
                                    .filter((c) => c.countryCode.startsWith("+"))
                                : [{ isoCountryCode: "IN", countryName: "India", countryCode: "+91" }]),
                            ].map((c) => (
                              <button
                                key={c.isoCountryCode}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                                onClick={() => {
                                  setCellCountryCode(c.countryCode || "+91");
                                  setDialCodeOpen(false);
                                }}
                              >
                                <span className="text-gray-800">{c.countryName}</span>
                                <span className="text-gray-500 font-semibold">{c.countryCode}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        type="tel" value={guestMobile}
                        onChange={e => setGuestMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        inputMode="numeric"
                        placeholder="Phone number"
                        className="flex-1 border border-gray-200 rounded-r-xl px-4 py-2.5 text-sm focus:outline-none"
                        onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                        onBlur={e => e.target.style.boxShadow = ""}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleContactNext}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 active:scale-[0.99]"
                  style={{ background: ctaGradient }}
                >
                  Continue to Passenger Details →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 1: Passengers ── */}
          {step === 1 && (
            <div className="relative z-10 bg-white rounded-2xl shadow-md border border-gray-100 overflow-visible">
              <div className="px-5 py-3 border-b border-gray-100" style={{ background: "#fff7ed" }}>
                <h3 className="font-bold text-gray-800">🧑‍✈️ Passenger Details</h3>
                <p className="text-xs text-gray-500 mt-0.5">Enter names exactly as on passport / government ID</p>
              </div>
              <div className="p-5 space-y-3">
                {(() => {
                  const dobRefDay = getPassengerAgeReferenceDate();
                  return passengerDetails.map((pax, idx) => {
                  const dobBounds = getDobInputBoundsIso(pax.type, dobRefDay);
                  return (
                  <div key={idx} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">{paxTypeIcon[pax.type]}</span>
                      <span className="text-sm font-semibold text-gray-700">{pax.type} {pax.index + 1}</span>
                      <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-semibold text-white" style={{ background: OG }}>{pax.type}</span>
                    </div>
                    
                    {user?.userId && (
                      <p className="mb-2 text-[11px] text-gray-500">
                        Type a passenger name to search saved profiles from previous bookings.
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Title *</label>
                        <select
                          value={pax.title}
                          onChange={e => handlePassengerChange(idx, "title", e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                          onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                          onBlur={e => e.target.style.boxShadow = ""}
                        >
                          {pax.type === "Adult" && (
                            <>
                              <option value="Mr">Mr</option>
                              <option value="Ms">Ms</option>
                              <option value="Mrs">Mrs</option>
                            </>
                          )}
                          {pax.type === "Child" && (
                            <>
                              <option value="Miss">Miss</option>
                              <option value="Mstr">Mstr</option>
                            </>
                          )}
                          {pax.type === "Infant" && (
                            <>
                              <option value="Miss">Miss</option>
                              <option value="Mstr">Mstr</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 mb-1">
                          First Name *
                          <span className="relative group inline-flex items-center">
                            <svg className="w-3.5 h-3.5 text-blue-400 cursor-help flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span className="absolute bottom-full right-0 mb-2 w-72 bg-gray-800 text-white text-[11px] rounded-lg px-3 py-2 hidden group-hover:block z-[100] shadow-xl pointer-events-none leading-relaxed">
                              {firstNameHint}
                            </span>
                          </span>
                        </label>
                        {user?.userId ? (
                          <PassengerTravellerTypeahead
                            userId={user.userId}
                            value={pax.firstName}
                            paxType={pax.type}
                            travelRefDate={dobRefDay}
                            accentColor={OG}
                            placeholder="Type name to search saved pax"
                            maxLength={PASSENGER_FIRST_NAME_MAX}
                            onValueChange={(v) => handlePassengerChange(idx, "firstName", v)}
                            onSelect={(member) => handleSelectFamilyMember(idx, member)}
                          />
                        ) : (
                          <input
                            type="text"
                            value={pax.firstName}
                            placeholder="As on ID"
                            maxLength={PASSENGER_FIRST_NAME_MAX}
                            onChange={(e) => handlePassengerChange(idx, "firstName", e.target.value)}
                            onKeyDown={(e) => {
                              if (/[0-9]/.test(e.key)) e.preventDefault();
                            }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                            onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                            onBlur={e => e.target.style.boxShadow = ""}
                          />
                        )}
                      </div>
                      <div>
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 mb-1">
                          Last Name *
                          <span className="relative group inline-flex items-center">
                            <svg className="w-3.5 h-3.5 text-blue-400 cursor-help flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span className="absolute bottom-full right-0 mb-2 w-72 bg-gray-800 text-white text-[11px] rounded-lg px-3 py-2 hidden group-hover:block z-[100] shadow-xl pointer-events-none leading-relaxed">
                              {lastNameHint}
                            </span>
                          </span>
                        </label>
                        <input
                          type="text"
                          value={pax.lastName}
                          placeholder="As on ID"
                          maxLength={PASSENGER_LAST_NAME_MAX}
                          onChange={(e) => handlePassengerChange(idx, "lastName", e.target.value)}
                          onKeyDown={(e) => {
                            if (/[0-9]/.test(e.key)) e.preventDefault();
                          }}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                          onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                          onBlur={e => e.target.style.boxShadow = ""}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Gender *</label>
                        <select
                          value={getFixedGenderForTitle(pax.title) || pax.gender}
                          onChange={e => handlePassengerChange(idx, "gender", e.target.value)}
                          disabled={!!getFixedGenderForTitle(pax.title)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                          onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                          onBlur={e => e.target.style.boxShadow = ""}
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                        {!!getFixedGenderForTitle(pax.title) && (
                          <p className="text-[10px] text-gray-500 mt-1">
                            Gender is fixed for title <span className="font-semibold">{pax.title}</span>
                          </p>
                        )}
                      </div>
                      {pax.type !== "Adult" && (
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            Date of Birth *
                          </label>
                          <input
                            type="date" lang={inputLang} value={pax.dob}
                            max={dobBounds.max}
                            min={dobBounds.min}
                            onChange={e => handlePassengerChange(idx, "dob", e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                            onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                            onBlur={e => e.target.style.boxShadow = ""}
                          />
                          <p className="text-[10px] text-gray-500 mt-1">
                            {PAX_DOB_HINT[pax.type] || PAX_DOB_HINT.Adult}
                          </p>
                        </div>
                      )}
                      <div className="col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            FF Airline Code
                          </label>
                          <input
                            type="text"
                            value={pax.ffAirlineCode || ""}
                            placeholder={defaultFfAirlineCode || "e.g. 6E"}
                            maxLength={3}
                            onChange={(e) => handlePassengerChange(idx, "ffAirlineCode", e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none uppercase"
                            onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                            onBlur={e => e.target.style.boxShadow = ""}
                          />
                          <p className="text-[10px] text-gray-500 mt-1">IATA airline code</p>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            Frequent Flyer Number
                          </label>
                          <input
                            type="text"
                            value={pax.ffNumber || ""}
                            placeholder="Optional — loyalty number"
                            maxLength={32}
                            onChange={(e) => handlePassengerChange(idx, "ffNumber", e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                            onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                            onBlur={e => e.target.style.boxShadow = ""}
                          />
                        </div>
                      </div>
                      {(isPanRequiredAtBook || isPanRequiredAtTicket) && (
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            PAN Number {(isPanRequiredAtBook ? "At Booking" : "")} {(isPanRequiredAtTicket && !isPanRequiredAtBook ? "At Ticket" : "")} *
                          </label>
                          <input
                            type="text" 
                            value={pax.pan} 
                            placeholder="e.g. AAAAA1234A"
                            onChange={e => handlePassengerChange(idx, "pan", e.target.value.toUpperCase())}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                            onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                            onBlur={e => e.target.style.boxShadow = ""}
                          />
                        </div>
                      )}
                      {(isPassportRequiredAtBook || isPassportRequiredAtTicket || isInternational) && (
                          <>
                            <div className="col-span-3 mt-1">
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-xs font-bold text-gray-700">🛂 Passport Details</span>
                                {isInternational && !isPassportRequiredAtBook && !isPassportRequiredAtTicket ? (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                                    {passportRequiresFullDetailAtBook()
                                      ? "International — full passport details"
                                      : "International — passport no. & expiry"}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-red-500 font-semibold">* Required</span>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Passport Number *</label>
                              <input
                                type="text"
                                value={pax.passport}
                                placeholder="e.g. A12345678"
                                onChange={e => handlePassengerChange(idx, "passport", e.target.value.toUpperCase())}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
                                onFocus={e => { e.target.style.boxShadow = `0 0 0 2px ${OG}33`; }}
                                onBlur={e => { e.target.style.boxShadow = ""; }}
                              />
                            </div>
                            {passportRequiresFullDetailAtBook() && (
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Issue Country *</label>
                              <select
                                value={pax.passportIssueCountry}
                                onChange={e => handlePassengerChange(idx, "passportIssueCountry", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
                              >
                                {countryList.length === 0 && <option value="IN">India (IN)</option>}
                                {countryList.map(c => (
                                  <option key={c.isoCountryCode} value={c.isoCountryCode}>
                                    {c.countryName} ({c.isoCountryCode})
                                  </option>
                                ))}
                              </select>
                            </div>
                            )}
                            {passportRequiresFullDetailAtBook() && (
                            <div>
                              <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 mb-1">
                                Issue Date *
                                <button
                                  type="button"
                                  aria-label="Issue date info"
                                  title="Must be on or after date of birth"
                                  className="w-4 h-4 rounded-full border border-gray-300 text-gray-500 flex items-center justify-center text-[10px] leading-none bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-200"
                                >
                                  i
                                </button>
                              </label>
                              <input
                                type="date"
                                lang={inputLang}
                                value={pax.passportIssue}
                                min={getPassportIssueMinIso(pax) || undefined}
                                max={getPassportIssueMaxIso()}
                                onChange={e => handlePassengerChange(idx, "passportIssue", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
                              />
                              {!pax.dob && pax.type !== "Adult" && (
                                <p className="text-[10px] text-gray-500 mt-1">
                                  Earliest selectable issue date matches the oldest {pax.type === "Infant" ? "infant" : "child"} allowed (same lower bound as date of birth).
                                </p>
                              )}
                            </div>
                            )}
                            <div>
                              <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 mb-1">
                                Expiry Date *
                                <button
                                  type="button"
                                  aria-label="Expiry date info"
                                  title={`Must be on or after your last travel date and at least 6 months from today. Earliest selectable date is ${getEffectivePassportExpiryMinIso(displayFlightDetails)}.`}
                                  className="w-4 h-4 rounded-full border border-gray-300 text-gray-500 flex items-center justify-center text-[10px] leading-none bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-200"
                                >
                                  i
                                </button>
                              </label>
                              <input
                                type="date"
                                lang={inputLang}
                                value={pax.passportExpiry}
                                min={getEffectivePassportExpiryMinIso(displayFlightDetails)}
                                onChange={e => handlePassengerChange(idx, "passportExpiry", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
                              />
                            </div>
                          </>
                      )}
                    </div>

                  </div>
                );
                });
                })()}

                {/* GST Details */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setShowGst(!showGst)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white text-sm font-bold text-gray-800 hover:bg-gray-50 transition-colors"
                  >
                    <span>Add GST Details {isGSTMandatory && <span className="text-red-500">*</span>}</span>
                    <span
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold leading-none"
                      style={{ borderColor: OG, color: OG }}
                    >
                      {showGst ? "−" : "+"}
                    </span>
                  </button>

                  {showGst && (
                    <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-3 space-y-3">
                      {/* Search row */}
                      <div className="flex justify-end">
                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-500 bg-gray-50">
                          <input
                            type="text"
                            value={gstSearch}
                            onChange={e => setGstSearch(e.target.value)}
                            placeholder="Search by Name / GST NO."
                            className="bg-transparent outline-none text-sm w-48 placeholder-gray-400"
                          />
                          <span className="text-gray-400">🔍</span>
                          {gstSearch && (
                            <button
                              onClick={() => setGstSearch("")}
                              className="text-xs font-semibold ml-1"
                              style={{ color: OG }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Fields row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* GST/UIN Number with checkbox */}
                        <div>
                          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 mb-1">
                            <input
                              type="checkbox"
                              checked={gstEnabled}
                              onChange={e => setGstEnabled(e.target.checked)}
                              disabled={isGSTMandatory}
                              className="accent-primary"
                            />
                            GST/UIN Number {isGSTMandatory && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type="text"
                            value={gstNumber}
                            onChange={e => setGstNumber(e.target.value.toUpperCase())}
                            disabled={!gstEnabled}
                            placeholder="e.g. 27AAAAA0000A1Z5"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                            onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                            onBlur={e => e.target.style.boxShadow = ""}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">GST Company Name {isGSTMandatory && <span className="text-red-500">*</span>}</label>
                          <input
                            type="text"
                            value={gstCompanyName}
                            onChange={e => setGstCompanyName(e.target.value)}
                            disabled={!gstEnabled}
                            placeholder="Company Name"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                            onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                            onBlur={e => e.target.style.boxShadow = ""}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">GST Company Email {isGSTMandatory && <span className="text-red-500">*</span>}</label>
                          <input
                            type="email"
                            value={gstCompanyEmail}
                            onChange={e => setGstCompanyEmail(e.target.value)}
                            disabled={!gstEnabled}
                            placeholder="gst@company.com"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                            onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                            onBlur={e => e.target.style.boxShadow = ""}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">GST Company Contact No {isGSTMandatory && <span className="text-red-500">*</span>}</label>
                          <input
                            type="tel"
                            value={gstContactNo}
                            onChange={e => setGstContactNo(e.target.value)}
                            disabled={!gstEnabled}
                            placeholder="Contact Number"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                            onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                            onBlur={e => e.target.style.boxShadow = ""}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">GST Company Address {isGSTMandatory && <span className="text-red-500">*</span>}</label>
                          <input
                            type="text"
                            value={gstAddress}
                            onChange={e => setGstAddress(e.target.value)}
                            disabled={!gstEnabled}
                            placeholder="Registered Company Address"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                            onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                            onBlur={e => e.target.style.boxShadow = ""}
                          />
                        </div>
                      </div>

                      <p className="text-xs text-red-500">{isGSTMandatory ? "(GST Details are mandatory for this booking)" : "(Note : Please fill GST Details only for corporate customer)"}</p>
                    </div>
                  )}
                </div>

                {/* Ancillary Services */}
                {(baggageOptions.length > 0 || mealOptions.length > 0 || seatOptions.length > 0 || ibBaggageOptions.length > 0 || ibMealOptions.length > 0 || ibSeatOptions.length > 0) && passengerDetails.length > 0 && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 overflow-hidden">
                    {/* Header */}
                    <button
                      onClick={() => setShowAddOns(!showAddOns)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold"
                      style={{ color: OG }}
                    >
                      <span>✈️ Ancillary Services <span className="font-normal text-gray-500">(Meal, Seat &amp; Baggage)</span></span>
                      <span>{showAddOns ? "▲" : "▼"}</span>
                    </button>

                    {showAddOns && (
                      <div className="bg-white border-t border-orange-100 p-4">
                        {/* Flight tabs — only for roundtrip */}
                        {isRoundtrip && (
                          <div className="flex mb-4 border-b border-gray-200">
                            {["ob", "ib"].map((tab) => (
                              <button
                                key={tab}
                                onClick={() => setAddOnFlightTab(tab as "ob" | "ib")}
                                className="flex-1 py-2 text-sm font-semibold border-b-2 transition-colors"
                                style={{
                                  borderColor: addOnFlightTab === tab ? OG : "transparent",
                                  color: addOnFlightTab === tab ? OG : "#6b7280",
                                }}
                              >
                                ✈ {tab === "ob" ? "Outbound" : "Inbound"}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Required services notice */}
                        {(obMealRequired || obSeatRequired || ibMealRequired || ibSeatRequired) && (
                          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex items-start gap-2">
                            <span className="mt-0.5">⚠️</span>
                            <span>
                              The airline requires:{" "}
                              {[
                                (obMealRequired || ibMealRequired) && "Meal",
                                (obSeatRequired || ibSeatRequired) && "Seat",
                              ].filter(Boolean).join(" & ")}{" "}
                              selection for all passengers before you can proceed.
                            </span>
                          </div>
                        )}

                        <div className="flex gap-4">
                          {/* Passenger list */}
                          <div className="w-36 flex-shrink-0 space-y-1">
                            <div className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Select Passenger</div>
                            {passengerDetails.map((pax, idx) => (
                              <button
                                key={idx}
                                onClick={() => setAddOnSelectedPax(idx)}
                                className="w-full text-left rounded-lg px-3 py-2 text-xs transition-all border"
                                style={{
                                  borderColor: addOnSelectedPax === idx ? OG : "#e5e7eb",
                                  background: addOnSelectedPax === idx ? `${OG}10` : "white",
                                  color: addOnSelectedPax === idx ? OG : "#374151",
                                }}
                              >
                                <div className="font-semibold">{paxTypeIcon[pax.type]} {pax.type} {pax.index + 1}</div>
                                <div className="text-gray-400 truncate">{pax.firstName || "(no name)"}</div>
                                {/* Summary dots */}
                                <div className="flex gap-1 mt-1">
                                  {(addOnFlightTab === "ob" ? pax.obBaggage : pax.ibBaggage) && <span title="Baggage">🧳</span>}
                                  {(addOnFlightTab === "ob" ? pax.obMeal : pax.ibMeal)
                                    ? <span title="Meal selected">🍽️</span>
                                    : (addOnFlightTab === "ob" ? obMealRequired : ibMealRequired) && pax.type !== "Infant" && <span title="Meal required" className="text-red-500">🍽️</span>}
                                  {(addOnFlightTab === "ob" ? pax.obSeat : pax.ibSeat)
                                    ? <span title="Seat selected">💺</span>
                                    : (addOnFlightTab === "ob" ? obSeatRequired : ibSeatRequired) && pax.type !== "Infant" && <span title="Seat required" className="text-red-500">💺</span>}
                                </div>
                              </button>
                            ))}
                          </div>

                          {/* Add-on options for selected pax + flight */}
                          {(() => {
                            const pax = passengerDetails[addOnSelectedPax];
                            if (!pax) return null;
                            const fl = addOnFlightTab;
                            const activeBaggageOptions = fl === "ob" ? baggageOptions : ibBaggageOptions;
                            const activeMealOptions    = fl === "ob" ? mealOptions    : ibMealOptions;
                            const activeSeatOptions    = fl === "ob" ? seatOptions    : ibSeatOptions;
                            const activeMealRequired   = fl === "ob" ? obMealRequired : ibMealRequired;
                            const activeSeatRequired   = fl === "ob" ? obSeatRequired : ibSeatRequired;
                            const leg = fl === "ob" ? displayFlightDetails?.[0] : displayFlightDetails?.[1];
                            const legFirst = leg?.[0];
                            const legLast = leg?.[(leg?.length ?? 1) - 1];
                            const route =
                              legFirst && legLast
                                ? `${legFirst.Origin?.AirportCode || legFirst.origin?.airportCode || ""}→${legLast.Destination?.AirportCode || legLast.destination?.airportCode || ""}`
                                : "";
                            return (
                              <div className="flex-1 space-y-3">
                                <div className="text-xs font-semibold text-gray-700 mb-1">
                                  {pax.type} {pax.index + 1} details{pax.firstName ? `: (${pax.firstName} ${pax.lastName})` : ""}
                                  {route && <span className="ml-2 font-bold" style={{ color: OG }}>{route}</span>}
                                </div>

                                {/* Baggage */}
                                {activeBaggageOptions.length > 0 && pax.type !== "Infant" && (
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">🧳 Baggage</label>
                                    <select
                                      value={(fl === "ob" ? pax.obBaggage : pax.ibBaggage)?.Code || ""}
                                      onChange={(e) => {
                                        const selected = activeBaggageOptions.find((b: any) => b.Code === e.target.value);
                                        handleAddOnSelect(addOnSelectedPax, fl, "baggage", selected || null);
                                      }}
                                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                                    >
                                      <option value="">No Excess/Extra Baggage</option>
                                      {activeBaggageOptions.filter((b: any) => b.Code !== "NoBaggage").map((bag: any, bIdx: number) => (
                                        <option key={bIdx} value={bag.Code}>
                                          {bag.Weight}kg — ₹{bag.Price}{bag.Text ? ` (${bag.Text})` : ""}
                                        </option>
                                      ))}
                                    </select>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Extra charges will be applicable</p>
                                  </div>
                                )}

                                {/* Meal */}
                                {activeMealOptions.length > 0 && (
                                  <div>
                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
                                      🍽️ Meal Preference
                                      {activeMealRequired && (
                                        <span className="text-[10px] font-bold text-white bg-red-500 rounded px-1.5 py-0.5 leading-none">Required</span>
                                      )}
                                    </label>
                                    <select
                                      value={(fl === "ob" ? pax.obMeal : pax.ibMeal)?.Code || ""}
                                      onChange={(e) => {
                                        const selected = activeMealOptions.find((m: any) => m.Code === e.target.value);
                                        handleAddOnSelect(addOnSelectedPax, fl, "meal", selected || null);
                                      }}
                                      className="w-full rounded-lg px-3 py-2 text-sm bg-white"
                                      style={{
                                        border: activeMealRequired && !(fl === "ob" ? pax.obMeal : pax.ibMeal)
                                          ? "2px solid #ef4444"
                                          : "1px solid #e5e7eb",
                                      }}
                                    >
                                      <option value="">{activeMealRequired ? "-- Select a meal (Required) --" : "No meal"}</option>
                                      {activeMealOptions.filter((m: any) => m.Code !== "NoMeal").map((meal: any, mIdx: number) => (
                                        <option key={mIdx} value={meal.Code}>
                                          {meal.AirlineDescription || meal.Code} — ₹{meal.Price}
                                        </option>
                                      ))}
                                    </select>
                                    {activeMealRequired && !(fl === "ob" ? pax.obMeal : pax.ibMeal) && (
                                      <p className="text-[10px] text-red-500 mt-0.5">Meal selection is mandatory for this passenger</p>
                                    )}
                                  </div>
                                )}

                                {/* Seat */}
                                {activeSeatOptions.length > 0 && pax.type !== "Infant" && (
                                  <div>
                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
                                      💺 Seat Preference
                                      {activeSeatRequired && (
                                        <span className="text-[10px] font-bold text-white bg-red-500 rounded px-1.5 py-0.5 leading-none">Required</span>
                                      )}
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setSeatMapOpen({ fl })}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                                        style={{ background: `linear-gradient(90deg, ${OG}, #ff8c38)`, border: activeSeatRequired && !(fl === "ob" ? pax.obSeat : pax.ibSeat) ? "2px solid #ef4444" : "none" }}
                                      >
                                        Select Seats
                                      </button>
                                      {(fl === "ob" ? pax.obSeat : pax.ibSeat) && (
                                        <div className="flex items-center gap-1.5 text-xs">
                                          <span className="px-2 py-1 rounded font-bold text-white" style={{ background: OG }}>
                                            {(fl === "ob" ? pax.obSeat : pax.ibSeat).Code}
                                          </span>
                                          <span className="text-gray-500">
                                            ₹{(fl === "ob" ? pax.obSeat : pax.ibSeat).Price}
                                          </span>
                                          <button
                                            onClick={() => handleAddOnSelect(addOnSelectedPax, fl, "seat", null)}
                                            className="text-gray-400 hover:text-red-500 text-base leading-none"
                                            title="Remove seat"
                                          >×</button>
                                        </div>
                                      )}
                                    </div>
                                    {activeSeatRequired && !(fl === "ob" ? pax.obSeat : pax.ibSeat) && (
                                      <p className="text-[10px] text-red-500 mt-0.5">Seat selection is mandatory for this passenger</p>
                                    )}
                                  </div>
                                )}

                                {activeBaggageOptions.length === 0 && activeMealOptions.length === 0 && activeSeatOptions.length === 0 && (
                                  <p className="text-xs text-gray-400">No ancillary options available for this flight.</p>
                                )}
                                <p className="text-[10px] text-gray-400">Note: Meals and seat are subject to availability</p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* T&C */}
                <label className="flex items-start gap-3 cursor-pointer bg-orange-50 rounded-xl p-3 border border-orange-100 mt-2">
                  <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-0.5 accent-primary" />
                  <span className="text-xs text-gray-600">
                    I agree to the <a href="#" className="underline font-semibold" style={{ color: OG }}>Terms &amp; Conditions</a> and <a href="#" className="underline font-semibold" style={{ color: OG }}>Privacy Policy</a>. Passenger names are as per government-issued ID.
                  </span>
                </label>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setStep(0)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">← Back</button>
                  <button
                    onClick={handlePassengerNext} disabled={!acceptedTerms}
                    className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-40"
                    style={{ background: acceptedTerms ? ctaGradient : "#e5e7eb", color: acceptedTerms ? "white" : "#9ca3af" }}
                  >
                    Review Booking →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Review ── */}
          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100" style={{ background: "#fff7ed" }}>
                <h3 className="font-bold text-gray-800">✅ Review Your Booking</h3>
                <p className="text-xs text-gray-500 mt-0.5">Verify all details before proceeding to payment</p>
              </div>
              <div className="p-5 space-y-4">
                {/* Contact */}
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div className="text-sm">
                    <span className="font-semibold text-gray-700">📧 {guestEmail}</span>
                    <span className="mx-2 text-gray-300">|</span>
                    <span className="text-gray-500">📱 {cellCountryCode} {guestMobile}</span>
                  </div>
                  <button onClick={() => setStep(0)} className="text-xs font-semibold" style={{ color: OG }}>Edit</button>
                </div>

                {/* Passengers review */}
                <div className="space-y-2">
                  {passengerDetails.map((pax, idx) => (
                    <div key={idx} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-2.5 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span>{paxTypeIcon[pax.type]}</span>
                        <div>
                          {editingIdx === idx ? (
                            <div className="flex gap-2">
                              <input
                                value={pax.firstName}
                                maxLength={PASSENGER_FIRST_NAME_MAX}
                                onChange={(e) => handlePassengerChange(idx, "firstName", e.target.value)}
                                onKeyDown={(e) => {
                                  if (/[0-9]/.test(e.key)) e.preventDefault();
                                }}
                                className="border rounded px-2 py-1 text-sm w-28 min-w-0 flex-1 focus:outline-none"
                                style={{ borderColor: OG }}
                              />
                              <input
                                value={pax.lastName}
                                maxLength={PASSENGER_LAST_NAME_MAX}
                                onChange={(e) => handlePassengerChange(idx, "lastName", e.target.value)}
                                onKeyDown={(e) => {
                                  if (/[0-9]/.test(e.key)) e.preventDefault();
                                }}
                                className="border rounded px-2 py-1 text-sm w-28 min-w-0 flex-1 focus:outline-none"
                                style={{ borderColor: OG }}
                              />
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-gray-800">{pax.firstName} {pax.lastName}</span>
                          )}
                          <div className="text-[11px] text-gray-400">{pax.type} {pax.index + 1}</div>
                          {pax.ffNumber?.trim() && pax.ffAirlineCode?.trim() ? (
                            <div className="text-[11px] text-gray-500">
                              FF ({pax.ffAirlineCode.trim()}): {pax.ffNumber.trim()}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {editingIdx === idx ? (
                        <button
                          type="button"
                          onClick={() => {
                            const p = passengerDetails[idx];
                            const label = `${p.type} ${Number(p.index ?? 0) + 1}`;
                            const fnErr = getPassengerFirstNameValidationError(
                              p.firstName,
                              `${label}: First name`,
                              passengerNameRulesCtx,
                            );
                            if (fnErr) {
                              alert(fnErr);
                              return;
                            }
                            const lnErr = getPassengerLastNameValidationError(
                              p.lastName,
                              `${label}: Last name`,
                              passengerNameRulesCtx,
                            );
                            if (lnErr) {
                              alert(lnErr);
                              return;
                            }
                            setEditingIdx(null);
                          }}
                          className="text-xs font-bold text-green-600"
                        >
                          Save
                        </button>
                      ) : (
                        <button onClick={() => setEditingIdx(idx)} className="text-xs font-semibold" style={{ color: OG }}>Edit</button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 inline-flex h-10 items-center justify-center rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    ← Edit Passengers
                  </button>
                  {!isHoldBooking && holdTicketEnabled && (
                    <div className="flex-1">
                      <button
                        type="button"
                        disabled={holdTicketProceeding}
                        title="Reserve your booking without immediate ticketing when hold is allowed by the airline."
                        onClick={() => void handleHoldTicketProceed()}
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl text-sm font-semibold border-2 border-blue-600 text-blue-900 bg-blue-50 hover:bg-blue-100 transition-all disabled:opacity-60 disabled:cursor-wait"
                      >
                        {holdTicketProceeding ? "Please wait…" : "Hold"}
                      </button>
                      {(holdFeeInr != null || holdFeeLoading) && (
                        <div className="mt-1 text-[11px] text-gray-500">
                          {holdFeeLoading ? (
                            <span>Fetching hold fee…</span>
                          ) : (
                            <>
                              Hold this ticket for{" "}
                              <span className="font-semibold text-blue-900">₹{holdFeeInr!.toLocaleString()}</span>
                              {holdFeeMessage ? <span className="text-gray-400"> · {holdFeeMessage}</span> : null}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleConfirmBooking}
                    className="flex-1 inline-flex h-10 items-center justify-center rounded-xl border-2 border-transparent text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: ctaGradient }}
                  >
                    Proceed to Payment →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: Fare Summary ── */}
        <div className="w-full lg:w-72 flex-shrink-0 space-y-3 lg:sticky lg:top-4 self-start">

          {/* Fare card */}
          <div className="rounded-2xl overflow-hidden shadow-md border border-orange-100">
            <div className="px-4 py-3 text-white font-bold text-sm" style={{ background: OG }}>
              💰 Fare Summary
            </div>
            <div className="bg-white p-4 space-y-2 text-sm">
              {passengers && fareSummaryUsesPassengerBreakup ? (
                <>
                  {(passengers.adults || 0) > 0 && price.PassengerBreakup.ADT && (
                    <div className="flex justify-between text-gray-700">
                      <span>Adult × {passengers.adults}</span>
                      <span>₹{(price.PassengerBreakup.ADT.BasePrice * passengers.adults)?.toLocaleString()}</span>
                    </div>
                  )}
                  {(passengers.children || 0) > 0 && price.PassengerBreakup.CHD && (
                    <div className="flex justify-between text-gray-700">
                      <span>Child × {passengers.children}</span>
                      <span>₹{(price.PassengerBreakup.CHD.BasePrice * passengers.children)?.toLocaleString()}</span>
                    </div>
                  )}
                  {(passengers.infants || 0) > 0 && price.PassengerBreakup.INF && (
                    <div className="flex justify-between text-gray-700">
                      <span>Infant × {passengers.infants}</span>
                      <span>₹{(price.PassengerBreakup.INF.BasePrice * passengers.infants)?.toLocaleString()}</span>
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
              {step === 2 && holdTicketEnabled && !isHoldBooking && (
                <div className="flex justify-between text-sm text-blue-900 pt-1 border-t border-dashed border-blue-100 mt-1">
                  <span>Hold fee (if you hold ticket)</span>
                  <span className="font-semibold tabular-nums">
                    {holdFeeLoading ? "…" : holdFeeInr != null ? `₹${holdFeeInr.toLocaleString()}` : "—"}
                  </span>
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
                  <span>🍽 Meals</span>
                  <span>₹{addOnMealCost.toLocaleString()}</span>
                </div>
              )}
              {addOnSeatCost > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>💺 Seats</span>
                  <span>₹{addOnSeatCost.toLocaleString()}</span>
                </div>
              )}
              {promoApplied && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>🎟 {promoCode}</span>
                  <span>− ₹{discount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-bold text-base">
                <span className="text-gray-800">Grand Total</span>
                <span style={{ color: OG }}>₹{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Promo code */}
          <div className="rounded-2xl border border-orange-100 bg-white shadow-sm p-4">
            <div className="font-semibold text-sm text-gray-700 mb-2">🎟 Promo / Coupon</div>
            {!promoApplied ? (
              <>
                <div className="flex gap-2">
                  <input
                    type="text" value={promoCode} placeholder="Enter code"
                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${OG}33`}
                    onBlur={e => e.target.style.boxShadow = ""}
                  />
                  <button onClick={handleApplyPromo} className="text-white text-sm font-semibold px-3 py-2 rounded-lg" style={{ background: OG }}>Apply</button>
                </div>
                <div className="text-[10px] text-gray-400 mt-1.5">Try: SAVE10 · FLAT500 · WELCOME</div>
              </>
            ) : (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span className="text-green-700 text-sm font-semibold">{promoCode} — saved ₹{discount}</span>
                <button type="button" onClick={() => void handleRemovePromo()} className="text-red-500 text-xs ml-2">✕</button>
              </div>
            )}
          </div>

          {/* Policies */}
          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-xs text-gray-600 space-y-1.5">
            <div className="font-semibold text-gray-700 mb-1">📋 Key Policies</div>
            <div>🔒 Booking is instant &amp; confirmed</div>
            <div>✉️ E-ticket sent within minutes</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span>💬 24/7 support:</span>
              <button
                type="button"
                onClick={openVivaAgent}
                className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-0.5 font-semibold hover:bg-orange-100/80 transition-colors"
                style={{ color: OG }}
                title="Talk to Viva — your travel agent"
              >
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white text-sm shadow-sm"
                  style={{ background: OG }}
                  aria-hidden
                >
                  🤖
                </span>
                Viva Agent
              </button>
            </div>
            <div>🧳 Baggage as per airline policy</div>
          </div>
        </div>

      </div>
    </div>

    {/* Seat Map Modal */}
    {seatMapOpen && (() => {
      const fl = seatMapOpen.fl;
      const activeSeatOpts = fl === "ob" ? seatOptions : ibSeatOptions;
      const leg = fl === "ib" ? displayFlightDetails?.[1] : displayFlightDetails?.[0];
      const segFirst = leg?.[0];
      const segLast = leg?.[(leg?.length ?? 1) - 1];
      const origin = segFirst?.Origin?.AirportCode || segFirst?.origin?.airportCode || "—";
      const dest = segLast?.Destination?.AirportCode || segLast?.destination?.airportCode || "—";
      const route = `${origin} → ${dest}`;
      const nonInfants = passengerDetails.filter(p => p.type !== "Infant");
      const paxList = nonInfants.map(p => ({
        name: [p.firstName, p.lastName].filter(Boolean).join(" ") || `${p.type}`,
        type: p.type,
        currentSeat: fl === "ob" ? p.obSeat : p.ibSeat,
      }));
      return (
        <SeatMap
          seatOptions={activeSeatOpts}
          passengers={paxList}
          route={route}
          onClose={() => setSeatMapOpen(null)}
          onConfirm={(selections) => {
            nonInfants.forEach((pax, i) => {
              const paxIdx = passengerDetails.indexOf(pax);
              handleAddOnSelect(paxIdx, fl, "seat", selections[i] || null);
            });
            setSeatMapOpen(null);
          }}
        />
      );
    })()}
    </>
  );
}
