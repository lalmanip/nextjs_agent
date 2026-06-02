"use client";
import { useState, useEffect, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  bookingState,
  HDFC_PENDING_MY_BOOKINGS_GET_TICKET_KEY,
} from "@/lib/bookingState";
import { commitBookingSkipBook } from "@/lib/commitBooking";
import { flightAPI, paymentAPI } from "@/lib/api";
import {
  readPassportIssuingCountry,
  withPassportIssuingCountryForApi,
} from "@/lib/travellerFields";
import { formatUserDate } from "@/lib/dateLocale";
import { useDateLocale } from "@/Components/DateLocaleProvider";
import { validateRequiredTravellerDateOfBirth } from "@/utils/validation";
import {
  isOtpApiSuccess,
  MY_BOOKINGS_VIEW_OTP_REQUEST_TYPE,
  otpApiMessage,
} from "@/lib/myBookingsOtp";
import { getAgentPortalLoginUrl } from "@/lib/agentPortal";
import { clearUserSession } from "@/lib/authSession";

interface UserDashboardProps {
  user: any;
  onBack: () => void;
  initialTab?: string;
  /** Changes when dashboard URL query changes (e.g. ?tab=bookings) — triggers a bookings refetch. */
  bookingsRefreshKey?: string;
}

const HEADERS = {
  "Content-Type": "application/json",
  "X-API-KEY": "viv-8806f318-1ecf-11ee-b64f-36e9be0141c6",
};

const OG = "#FC6603"; // primary orange

/** My Bookings: status from `flightItinerary.status` (API). */
const FLIGHT_ITINERARY_STATUS_DISPLAY: Record<number, string> = {
  1: "BOOKING PENDING",
  2: "BOOKING IN PROGRESS PENDING",
  3: "BOOKING FAILED",
  4: "BOOKING CANCELLED",
  5: "BOOKING CONFIRMED",
};

function itineraryStatusCodeFromBooking(b: any): number | null {
  const c = b?.itineraryStatusCode;
  if (typeof c === "number" && FLIGHT_ITINERARY_STATUS_DISPLAY[c]) return c;
  const rev: Record<string, number> = {
    "BOOKING PENDING": 1,
    "BOOKING IN PROGRESS PENDING": 2,
    "BOOKING FAILED": 3,
    "BOOKING CANCELLED": 4,
    "BOOKING CONFIRMED": 5,
    BOOKING_PENDING: 1,
    BOOKING_IN_PROGRESS: 2,
    BOOKING_FAILED: 3,
    BOOKING_CANCELLED: 4,
    BOOKING_CONFIRMED: 5,
  };
  const s = String(b?.status ?? "").trim();
  if (rev[s] != null) return rev[s];
  const n = Number(s);
  if (Number.isFinite(n) && FLIGHT_ITINERARY_STATUS_DISPLAY[n]) return n;
  return null;
}

function normalizeBookingDetailList(raw: unknown): any[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "[]" || t === "null") return [];
    try {
      const p = JSON.parse(t);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Tokens for MT `initiatePayment?resultToken=…` before commit-booking (My Bookings → Generate E-Ticket). */
function resolveBookingResultTokensForInitiatePayment(b: any): {
  resultToken: string;
  returnResultToken: string;
  tripTypeForInitiatePayment: "oneway" | "roundtrip";
} {
  const fromObj = (o: any): { ob: string; ib: string } => {
    if (!o || typeof o !== "object") return { ob: "", ib: "" };
    const ob = String(
      o.resultToken ??
        o.ResultToken ??
        o.shoppingResultToken ??
        o.ShoppingResultToken ??
        o.fareQuoteResultToken ??
        o.FareQuoteResultToken ??
        "",
    ).trim();
    const ib = String(
      o.returnResultToken ??
        o.ReturnResultToken ??
        o.ibResultToken ??
        o.IbResultToken ??
        o.inboundResultToken ??
        o.InboundResultToken ??
        "",
    ).trim();
    return { ob, ib };
  };

  let { ob, ib } = fromObj(b);
  if (!ob) {
    try {
      const rawAttr = b?.attributes ?? b?.Attributes ?? b?.bookingAttributes ?? b?.BookingAttributes;
      if (rawAttr) {
        const parsed = typeof rawAttr === "string" ? JSON.parse(rawAttr) : rawAttr;
        const inner = fromObj(parsed);
        if (!ob) ob = inner.ob;
        if (!ib) ib = inner.ib;
      }
    } catch {
      /* ignore */
    }
  }

  const fi = b?.flightItinerary ?? b?.FlightItinerary ?? {};
  if (!ob) {
    const inner = fromObj(fi);
    ob = inner.ob;
    if (!ib) ib = inner.ib;
  }

  const jtRaw = b?.journeyType ?? b?.JourneyType ?? b?.tripType ?? b?.TripType ?? fi?.journeyType ?? fi?.JourneyType;
  const jtStr = String(jtRaw ?? "").toLowerCase();
  let trip: "oneway" | "roundtrip" = "oneway";
  if (jtRaw === 2 || jtRaw === "2" || jtStr.includes("round")) trip = "roundtrip";
  else {
    const segs: any[] = Array.isArray(b?.segments) ? b.segments : [];
    const tips = new Set(
      segs
        .map((s) => Number(s?.tripIndicator ?? s?.TripIndicator))
        .filter((n) => n === 1 || n === 2),
    );
    if (tips.has(1) && tips.has(2)) trip = "roundtrip";
  }
  if (ib && ib !== ob) trip = "roundtrip";

  return { resultToken: ob, returnResultToken: ib, tripTypeForInitiatePayment: trip };
}

function isMyBookingRoundtrip(booking: {
  isRoundtrip?: boolean;
  tripTypeForInitiatePayment?: string;
  itinerary?: Array<{ tripIndicator?: number | null }>;
}): boolean {
  if (booking.isRoundtrip === true) return true;
  if (booking.tripTypeForInitiatePayment === "roundtrip") return true;
  const tips = new Set(
    (booking.itinerary ?? [])
      .map((s) => Number(s?.tripIndicator))
      .filter((n) => n === 1 || n === 2),
  );
  return tips.has(1) && tips.has(2);
}

/** Rupees to charge in Razorpay (same unit as `PaymentScreen` / `processRazorpayPayment`). */
function getMyBookingPayableAmountInr(booking: any, orderRes: Record<string, unknown>): number {
  const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : NaN;
  };
  const fromOrder = n(
    orderRes.Amount ??
      orderRes.amount ??
      orderRes.TotalAmount ??
      orderRes.totalAmount ??
      orderRes.PayableAmount ??
      orderRes.payableAmount,
  );
  if (fromOrder > 0) {
    if (fromOrder >= 1_000_000) return Math.round(fromOrder / 100);
    return Math.round(fromOrder);
  }
  const bf = booking?.bookingFare;
  if (bf && typeof bf === "object") {
    const pub = n(bf.publishedFare ?? bf.PublishedFare ?? bf.offeredFare ?? bf.OfferedFare);
    if (pub > 0) return Math.round(pub);
    const base = n(bf.baseFare ?? bf.BaseFare);
    const tax = n(bf.tax ?? bf.Tax);
    if (base + tax > 0) return Math.round(base + tax);
  }
  const f = booking?.transactions?.[0]?.attributes?.Fare;
  if (f && typeof f === "object") {
    const pub = n(f.PublishedFare ?? f.publishedFare);
    if (pub > 0) return Math.round(pub);
    const base = n(f.BaseFare ?? f.baseFare);
    const tax = n(f.Tax ?? f.tax);
    if (base + tax > 0) return Math.round(base + tax);
  }
  return 0;
}

function tripIndicatorToLegLabel(t: unknown): string {
  const n = Number(t);
  if (n === 1) return "Outbound";
  if (n === 2) return "Return";
  return "";
}

function formatMealDetailItem(m: any): string {
  if (!m || typeof m !== "object") return "";
  const title =
    m.mealName ??
    m.MealName ??
    m.mealType ??
    m.MealType ??
    m.description ??
    m.Description ??
    m.ssrDescription ??
    m.SsrDescription ??
    m.airlineDescription ??
    m.AirlineDescription ??
    m.remarks ??
    m.Remarks ??
    m.title ??
    m.Title ??
    "";
  const code = m.code ?? m.Code ?? m.ssrCode ?? m.SSRCode ?? m.mealCode ?? m.MealCode ?? "";
  const name = String(title || code).trim();
  if (!name) return "";
  const leg = tripIndicatorToLegLabel(
    m.tripIndicator ?? m.TripIndicator ?? m.segmentIndicator ?? m.SegmentIndicator,
  );
  return leg ? `${leg}: ${name}` : name;
}

function formatSeatDetailItem(s: any): string {
  if (!s || typeof s !== "object") return "";
  const code =
    s.seatNumber ??
    s.SeatNumber ??
    s.seatNo ??
    s.SeatNo ??
    s.code ??
    s.Code ??
    s.seatCode ??
    s.SeatCode ??
    "";
  if (!code) return "";
  const leg = tripIndicatorToLegLabel(
    s.tripIndicator ?? s.TripIndicator ?? s.segmentIndicator ?? s.SegmentIndicator,
  );
  const c = String(code).trim();
  return leg ? `${leg}: ${c}` : c;
}

/** Meal / seat strings from getMyAllBookings passenger payloads (several possible shapes). */
function getPassengerMealAndSeatDisplay(p: any): { meals: string; seats: string } {
  const mealRows: any[] = [
    ...normalizeBookingDetailList(p?.flightBookingMealDetailsList),
    ...normalizeBookingDetailList(p?.FlightBookingMealDetailsList),
    ...normalizeBookingDetailList(p?.flightBookingMealDetails),
    ...normalizeBookingDetailList(p?.FlightBookingMealDetails),
    ...normalizeBookingDetailList(p?.mealDetails),
    ...normalizeBookingDetailList(p?.MealDetails),
  ];
  const seatRows: any[] = [
    ...normalizeBookingDetailList(p?.flightBookingSeatDetailsList),
    ...normalizeBookingDetailList(p?.FlightBookingSeatDetailsList),
    ...normalizeBookingDetailList(p?.flightBookingSeatDetails),
    ...normalizeBookingDetailList(p?.FlightBookingSeatDetails),
    ...normalizeBookingDetailList(p?.seatDetails),
    ...normalizeBookingDetailList(p?.SeatDetails),
  ];

  let meals = mealRows.map(formatMealDetailItem).filter(Boolean);
  let seats = seatRows.map(formatSeatDetailItem).filter(Boolean);

  if (meals.length === 0) {
    const single = formatMealDetailItem(p?.mealDetail ?? p?.MealDetail ?? p?.selectedMeal ?? p?.SelectedMeal);
    if (single) meals = [single];
  }
  if (seats.length === 0) {
    const single = formatSeatDetailItem(p?.seatDetail ?? p?.SeatDetail ?? p?.selectedSeat ?? p?.SelectedSeat);
    if (single) seats = [single];
  }

  if (meals.length === 0) {
    const flat = String(p?.mealName ?? p?.MealName ?? p?.meal ?? p?.Meal ?? "").trim();
    if (flat) meals = [flat];
  }
  if (seats.length === 0) {
    const flat = String(
      p?.seatNumber ?? p?.SeatNumber ?? p?.seatNo ?? p?.SeatNo ?? p?.seat ?? p?.Seat ?? "",
    ).trim();
    if (flat) seats = [flat];
  }

  try {
    const rawAttr = p?.attributes;
    if (rawAttr) {
      const obj = typeof rawAttr === "string" ? JSON.parse(rawAttr) : rawAttr;
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        meals.push(
          ...normalizeBookingDetailList(
            obj.flightBookingMealDetailsList ??
              obj.FlightBookingMealDetailsList ??
              obj.mealDetails ??
              obj.MealDetails,
          ).map(formatMealDetailItem),
        );
        seats.push(
          ...normalizeBookingDetailList(
            obj.flightBookingSeatDetailsList ??
              obj.FlightBookingSeatDetailsList ??
              obj.seatDetails ??
              obj.SeatDetails,
          ).map(formatSeatDetailItem),
        );
      }
    }
  } catch {
    /* ignore */
  }

  const uniq = (arr: string[]) => Array.from(new Set(arr));
  return {
    meals: uniq(meals).join(" · ") || "",
    seats: uniq(seats).join(" · ") || "",
  };
}

export default function UserDashboard({
  user,
  onBack,
  initialTab = "overview",
  bookingsRefreshKey = "",
}: UserDashboardProps) {
  const router = useRouter();
  const { inputLang } = useDateLocale();

  const handleSignOut = () => {
    clearUserSession();
    window.location.href = getAgentPortalLoginUrl();
  };

  const resolveDashboardTab = (tab: string): "overview" | "bookings" | "family" =>
    tab === "manage"
      ? "bookings"
      : tab === "overview" || tab === "bookings" || tab === "family"
        ? tab
        : "overview";

  const [activeTab, setActiveTab] = useState<"overview" | "bookings" | "family">(() =>
    resolveDashboardTab(initialTab),
  );
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [bookingDetail, setBookingDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [message, setMessage] = useState("");
  const [cancelChargesLoading, setCancelChargesLoading] = useState(false);
  const [cancelCharges, setCancelCharges] = useState<any>(null);
  const [cancelChargesError, setCancelChargesError] = useState<string>("");
  const [releasePnrLoading, setReleasePnrLoading] = useState(false);
  const [releasePnrMessage, setReleasePnrMessage] = useState("");
  const [releasePnrError, setReleasePnrError] = useState("");
  const [releasePnrSucceeded, setReleasePnrSucceeded] = useState(false);
  const [getTicketLoading, setGetTicketLoading] = useState(false);
  const [getTicketError, setGetTicketError] = useState("");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelModalOpening, setCancelModalOpening] = useState(false);
  /** After successful cancel + ticket status poll; only Close should remain usable. */
  const [cancelFormLockedAfterSubmit, setCancelFormLockedAfterSubmit] = useState(false);
  const [cancelMode, setCancelMode] = useState<"full" | "partial">("full");
  const [cancelOtp, setCancelOtp] = useState("");
  const [cancelOtpStatus, setCancelOtpStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [cancelOtpMessage, setCancelOtpMessage] = useState<string>("");
  const [viewOtpModalOpen, setViewOtpModalOpen] = useState(false);
  /** App reference (or row fallback) for the booking whose View link is sending OTP. */
  const [viewOtpSendingKey, setViewOtpSendingKey] = useState<string | null>(null);
  const [viewOtpTarget, setViewOtpTarget] = useState<any>(null);
  const [viewOtp, setViewOtp] = useState("");
  const [viewOtpStatus, setViewOtpStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [viewOtpMessage, setViewOtpMessage] = useState("");
  const [viewOtpVerifying, setViewOtpVerifying] = useState(false);
  const [cancelRemarks, setCancelRemarks] = useState("Test remarks");
  const [cancelSelectedTicketIds, setCancelSelectedTicketIds] = useState<number[]>([]);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelSubmitResult, setCancelSubmitResult] = useState<any>(null);
  const [cancelSubmitError, setCancelSubmitError] = useState<string>("");
  /** Local UI: appReference keys where get-change-request-status returned ChangeRequestStatus 1 (full cancel). */
  const [canceledVerifiedByAppRef, setCanceledVerifiedByAppRef] = useState<Record<string, boolean>>(
    {},
  );
  /** Ticket IDs cancelled in-session per appReference (partial cancel). */
  const [canceledTicketIdsByAppRef, setCanceledTicketIdsByAppRef] = useState<Record<string, number[]>>(
    {},
  );
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [showAddFamily, setShowAddFamily] = useState(false);
  /** Which list row is in edit mode (index is stable and unique in the UI). */
  const [editingFamilyRowIndex, setEditingFamilyRowIndex] = useState<number | null>(null);
  const [editingTravellerId, setEditingTravellerId] = useState<string | null>(null);
  const [familyEditOriginal, setFamilyEditOriginal] = useState<any>(null);
  const [familyEdit, setFamilyEdit] = useState<{
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    email: string;
    passportUserName: string;
    passportNationality: string;
    passportNumber: string;
    PassportIssueCountryCode: string;
    passportIssueDate: string;
    passportExpiryDate: string;
  }>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    email: "",
    passportUserName: "",
    passportNationality: "",
    passportNumber: "",
    PassportIssueCountryCode: "IN",
    passportIssueDate: "",
    passportExpiryDate: "",
  });
  const [familyUpdateLoading, setFamilyUpdateLoading] = useState(false);
  const [familyUpdateError, setFamilyUpdateError] = useState("");
  const [countryList, setCountryList] = useState<
    { isoCountryCode: string; countryName: string; countryCode?: string }[]
  >([]);
  const [newMember, setNewMember] = useState<{
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    passportIssueDate: string | null;
    email: string | null;
    passportUserName: string | null;
    passportNationality: string;
    passportExpiryDay: string | null;
    passportExpiryMonth: string | null;
    passportExpiryYear: string | null;
    passportNumber: string | null;
    PassportIssueCountryCode: string | null;
  }>({
    firstName: "",
    lastName: "",
    dateOfBirth: null,
    passportIssueDate: null,
    email: null,
    passportUserName: null,
    passportNationality: "",
    passportExpiryDay: null,
    passportExpiryMonth: null,
    passportExpiryYear: null,
    passportNumber: null,
    PassportIssueCountryCode: "IN",
  });

  useEffect(() => {
    fetch("/api/country-list")
      .then((r) => r.json())
      .then((data) => setCountryList(Array.isArray(data) ? data : []))
      .catch(() =>
        setCountryList([{ isoCountryCode: "IN", countryName: "India", countryCode: "+91" }]),
      );
  }, []);

  const [fStops, setFStops] = useState<Set<string>>(
    new Set(["nonstop", "1stop"]),
  );
  const [fTimes, setFTimes] = useState<Set<string>>(
    new Set(["earlyam", "morning"]),
  );
  const [fAirlines, setFAirlines] = useState<Set<string>>(
    new Set(["EK", "AI", "G9"]),
  );

  const tog = (set: Set<string>, k: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    n.has(k) ? n.delete(k) : n.add(k);
    fn(n);
  };

  useEffect(() => {
    setActiveTab(resolveDashboardTab(initialTab));
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === "bookings") {
      void fetchBookings();
    }
    if (activeTab === "family" && familyMembers.length === 0) {
      void fetchFamilyMembers();
    }
  }, [activeTab, bookingsRefreshKey]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && activeTab === "bookings") {
        void fetchBookings();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [activeTab]);

  useEffect(() => {
    setGetTicketError("");
  }, [selectedBooking?.appReference, selectedBooking?.resultToken]);

  const fetchBookings = async () => {
    setLoadingBookings(true);
    try {
      const url = `/api/flight/my-bookings?email=${encodeURIComponent(user.email)}`;
      console.log("=== FETCH BOOKINGS REQUEST ===");
      console.log("Endpoint URL:", url);
      console.log("User Email:", user.email);

      const r = await fetch(url);

      console.log("=== FETCH BOOKINGS RESPONSE ===");
      console.log("Status:", r.status, r.statusText);

      if (r.ok) {
        const d = await r.json();
        console.log("Response Data:", d);
        // New response shape:
        // { response: [ { appReference, bookings: [ ... ] } ], status, message }
        const groups: any[] = Array.isArray(d?.response) ? d.response : [];

        const statusLabel = (s: any): string => {
          const n = Number(s);
          const map: Record<number, string> = {
            1: "BOOKING_PENDING",
            2: "BOOKING_IN_PROGRESS",
            3: "BOOKING_FAILED",
            4: "BOOKING_CANCELLED",
            5: "BOOKING_CONFIRMED",
          };
          if (Number.isFinite(n) && map[n]) return map[n];
          return String(s ?? "UNKNOWN");
        };

        const resolveItineraryStatusCode = (b: any): number | null => {
          const fi = b?.flightItinerary ?? b?.FlightItinerary ?? {};
          const fromFi = Number(fi?.status ?? fi?.Status);
          if (Number.isFinite(fromFi) && FLIGHT_ITINERARY_STATUS_DISPLAY[fromFi]) {
            return fromFi;
          }
          const fromBooking = Number(b?.status);
          if (Number.isFinite(fromBooking) && FLIGHT_ITINERARY_STATUS_DISPLAY[fromBooking]) {
            return fromBooking;
          }
          return null;
        };

        const paxTypeLabel = (t: any): string => {
          const n = Number(t);
          if (n === 1) return "ADULT";
          if (n === 2) return "CHILD";
          if (n === 3) return "INFANT";
          return String(t ?? "");
        };

        const toFareAttributes = (bookingFare: any) => {
          if (!bookingFare || typeof bookingFare !== "object") return null;
          return {
            Currency: bookingFare.currency,
            BaseFare: bookingFare.baseFare,
            Tax: bookingFare.tax,
            PublishedFare: bookingFare.publishedFare ?? bookingFare.offeredFare,
          };
        };

        const transformedBookings = groups.flatMap((g: any) => {
          const appRef = String(g?.appReference || "").trim();
          const list: any[] = Array.isArray(g?.bookings) ? g.bookings : [];
          return list.map((b: any) => {
            const segs: any[] = Array.isArray(b?.segments) ? b.segments : [];
            const firstSeg = segs[0] || {};
            const lastSeg = segs[segs.length - 1] || firstSeg || {};
            const pax: any[] = Array.isArray(b?.passengers) ? b.passengers : [];
            const lead =
              pax.find((p: any) => p?.isLeadPax) ||
              pax[0] ||
              {};

            const fareAttr = toFareAttributes(b?.bookingFare);
            const fallbackBookingId = b?.bookingId ?? b?.BookingId ?? b?.id;
            const tboSourceRaw = b?.source ?? b?.Source ?? b?.supplierSource ?? b?.SupplierSource;
            const tboSource =
              tboSourceRaw != null && String(tboSourceRaw).trim() !== ""
                ? String(tboSourceRaw).trim()
                : "4";
            const transactions =
              fareAttr || fallbackBookingId
                ? [
                    {
                      bookId: fallbackBookingId,
                      BookId: fallbackBookingId,
                      attributes: fareAttr ? { Fare: fareAttr } : undefined,
                    },
                  ]
                : [];

            const itineraryStatusCode = resolveItineraryStatusCode(b);
            const status =
              itineraryStatusCode != null
                ? FLIGHT_ITINERARY_STATUS_DISPLAY[itineraryStatusCode]
                : String(statusLabel(b?.status)).replace(/_/g, " ");

            const {
              resultToken: mtResultToken,
              returnResultToken: mtReturnResultToken,
              tripTypeForInitiatePayment,
            } = resolveBookingResultTokensForInitiatePayment(b);

            const tripIndicators = new Set(
              segs
                .map((s) => Number(s?.tripIndicator ?? s?.TripIndicator))
                .filter((n) => n === 1 || n === 2),
            );
            const isRoundtrip =
              tripTypeForInitiatePayment === "roundtrip" ||
              (tripIndicators.has(1) && tripIndicators.has(2));
            const onwardSegs = isRoundtrip
              ? segs.filter((s) => Number(s?.tripIndicator ?? s?.TripIndicator) === 1)
              : segs;
            const onwardFirst = onwardSegs[0] || firstSeg;
            const onwardLast = onwardSegs[onwardSegs.length - 1] || onwardFirst;
            const fromLoc =
              b?.origin ?? onwardFirst?.originAirportCode ?? firstSeg?.originAirportCode ?? "—";
            const toLoc =
              b?.destination ??
              (isRoundtrip
                ? onwardLast?.destinationAirportCode
                : lastSeg?.destinationAirportCode) ??
              firstSeg?.destinationAirportCode ??
              "—";

            return {
              appReference: String(b?.appReference || appRef).trim(),
              pnr: String(b?.pnr || "").trim(),
              resultToken: mtResultToken,
              returnResultToken: mtReturnResultToken,
              tripTypeForInitiatePayment,
              isRoundtrip,
              tboSource,
              itineraryStatusCode,
              fromLoc,
              toLoc,
              status,
              passengerCount: pax.length,
              cabinClass: b?.cabinClass ?? firstSeg?.cabinClass ?? "—",
              phone: lead?.contactNo ?? lead?.phone ?? "—",
              email: lead?.email ?? "—",
              createdOn: b?.createdAt ?? b?.invoiceCreatedOn ?? b?.updatedAt ?? null,
              journeyStart: firstSeg?.departureTime ?? null,
              journeyEnd: lastSeg?.arrivalTime ?? null,
              itinerary: segs.map((s: any) => ({
                airlineName: s?.airlineName ?? b?.airlineName ?? "—",
                airlineCode: s?.airlineCode ?? b?.airlineCode ?? "—",
                flightNumber: s?.flightNumber ?? "—",
                airlinePnr: b?.pnr ?? "",
                tripIndicator: s?.tripIndicator ?? s?.TripIndicator ?? null,
                segmentIndicator: s?.segmentIndicator ?? s?.SegmentIndicator ?? null,
                fromAirportCode: s?.originAirportCode ?? "—",
                toAirportCode: s?.destinationAirportCode ?? "—",
                departureDatetime: s?.departureTime ?? null,
                arrivalDatetime: s?.arrivalTime ?? null,
                checkinBaggage: s?.baggage ?? "",
                cabinBaggage: s?.cabinBaggage ?? "",
                isRefundable: b?.nonRefundable ? "Non Refundable" : "Refundable",
              })),
              passengers: pax.map((p: any) => ({
                ...p,
                passengerType: paxTypeLabel(p?.paxType),
              })),
              transactions,
              bookingFare: b?.bookingFare,
            };
          });
        });

        // Sort by journeyStart/createdOn descending (most recent first)
        transformedBookings.sort((a: any, b: any) => {
          const dateA = new Date(a.journeyStart || a.createdOn || 0).getTime();
          const dateB = new Date(b.journeyStart || b.createdOn || 0).getTime();
          return dateB - dateA;
        });

        setBookings(transformedBookings);
        // If a booking is currently selected, refresh it from the new list so
        // newly derived fields (e.g. itinerary.tripIndicator) are available for actions like cancellation.
        setSelectedBooking((prev: any) => {
          if (!prev) return prev;
          const prevApp = String(prev?.appReference || "").trim();
          const prevBook = String(prev?.transactions?.[0]?.bookId || prev?.transactions?.[0]?.BookId || "").trim();
          const match =
            transformedBookings.find((x: any) => {
              const xApp = String(x?.appReference || "").trim();
              if (prevApp && xApp !== prevApp) return false;
              const xBook = String(x?.transactions?.[0]?.bookId || x?.transactions?.[0]?.BookId || "").trim();
              return prevBook ? xBook === prevBook : true;
            }) ||
            transformedBookings.find((x: any) => String(x?.appReference || "").trim() === prevApp) ||
            null;
          return match || prev;
        });
      } else {
        const errorData = await r.text();
        console.log("Error Response:", errorData);
      }
    } catch (error) {
      console.error("Fetch Bookings Error:", error);
    }
    setLoadingBookings(false);
  };

  const fetchDetail = async (ref: string) => {
    setLoadingDetail(true);
    setBookingDetail(null);
    try {
      const r = await fetch(`/api/flight/ticket-details?appReference=${ref}`, {
        headers: HEADERS,
      });
      if (r.ok) setBookingDetail(await r.json());
    } catch {}
    setLoadingDetail(false);
  };

  const extractTicketIds = (obj: any): number[] => {
    const out = new Set<number>();
    const seen = new Set<any>();
    const walk = (v: any) => {
      if (v == null) return;
      if (typeof v !== "object") return;
      if (seen.has(v)) return;
      seen.add(v);
      if (Array.isArray(v)) {
        v.forEach(walk);
        return;
      }
      for (const [k, val] of Object.entries(v)) {
        if (/ticketid/i.test(k)) {
          if (Array.isArray(val)) {
            for (const x of val) {
              const n = Number(x);
              if (Number.isFinite(n)) out.add(n);
            }
          } else {
            const n = Number(val);
            if (Number.isFinite(n)) out.add(n);
          }
        }
        walk(val);
      }
    };
    walk(obj);
    return Array.from(out);
  };

  const submitCancelRequest = async () => {
    const bookingId = String(
      selectedBooking?.transactions?.[0]?.bookId || selectedBooking?.transactions?.[0]?.BookId || "",
    ).trim();
    if (!bookingId) {
      setCancelSubmitError("Booking ID not found for this booking.");
      setCancelSubmitResult(null);
      return;
    }

    const appRef = String(selectedBooking?.appReference || "").trim();
    const sectorsForAppRef = (() => {
      // For roundtrip, backend expects both OB and IB sectors in the same cancellation request.
      // Sometimes the API returns two separate booking rows (same appReference), and sometimes
      // it returns ONE booking row with segments that have tripIndicator 1 + 2. Handle both.
      const out = new Map<string, { Origin: string; Destination: string }>();

      const addSector = (fromRaw: any, toRaw: any) => {
        const from = String(fromRaw || "").trim();
        const to = String(toRaw || "").trim();
        if (!from || !to) return;
        out.set(`${from}__${to}`, { Origin: from, Destination: to });
      };

      // Case A: multiple booking rows for same appReference (OB row + IB row)
      const list = Array.isArray(bookings) ? bookings : [];
      const peers = appRef ? list.filter((b: any) => String(b?.appReference || "").trim() === appRef) : [];
      if (peers.length > 1) {
        peers.forEach((b: any) => addSector(b?.fromLoc, b?.toLoc));
        console.log("[cancel] sectors from peer bookings:", {
          appRef,
          peers: peers.map((b: any) => ({ fromLoc: b?.fromLoc, toLoc: b?.toLoc })),
          sectors: Array.from(out.values()),
        });
        return Array.from(out.values());
      }

      // Case B: single booking row with itinerary entries carrying tripIndicator/segmentIndicator
      const itin: any[] = Array.isArray(selectedBooking?.itinerary) ? selectedBooking.itinerary : [];
      if (itin.length) {
        const byTrip = new Map<number, any[]>();
        for (const seg of itin) {
          const ti = Number(seg?.tripIndicator);
          if (!Number.isFinite(ti)) continue;
          if (!byTrip.has(ti)) byTrip.set(ti, []);
          byTrip.get(ti)!.push(seg);
        }
        for (const [ti, segs] of byTrip.entries()) {
          const sorted = [...segs].sort((a, b) => Number(a?.segmentIndicator || 0) - Number(b?.segmentIndicator || 0));
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          addSector(first?.fromAirportCode, last?.toAirportCode);
        }
        console.log("[cancel] sectors from itinerary:", {
          appRef,
          itineraryTripIndicators: itin.map((s: any) => ({
            tripIndicator: s?.tripIndicator,
            segmentIndicator: s?.segmentIndicator,
            from: s?.fromAirportCode,
            to: s?.toAirportCode,
          })),
          sectors: Array.from(out.values()),
        });
      }

      // Final fallback: whatever is currently selected
      if (out.size === 0) {
        addSector(selectedBooking?.fromLoc, selectedBooking?.toLoc);
        console.log("[cancel] sectors fallback (selectedBooking only):", {
          appRef,
          fromLoc: selectedBooking?.fromLoc,
          toLoc: selectedBooking?.toLoc,
          sectors: Array.from(out.values()),
        });
      }
      return Array.from(out.values());
    })();

    let submittedPartialTicketIds: number[] = [];

    const payload: any = {
      BookingId: Number(bookingId),
      RequestType: cancelMode === "full" ? 1 : 2,
      CancellationType: 3,
      Remarks: cancelRemarks || "Test remarks",
      ...(selectedBooking?.appReference ? { ResultToken: selectedBooking.appReference } : {}),
      ...(cancelOtp.trim()
        ? { Otp: cancelOtp.trim(), OTP: cancelOtp.trim(), otp: cancelOtp.trim() }
        : {}),
    };

    if (cancelMode === "partial") {
      const rows = getTicketRowsForPartialCancel();
      const cancellable = new Set(rows.filter((r) => !r.alreadyCancelled).map((r) => r.ticketId));
      submittedPartialTicketIds = cancelSelectedTicketIds.filter((id) => cancellable.has(Number(id)));
      if (submittedPartialTicketIds.length === 0) {
        setCancelSubmitError(
          rows.some((r) => r.alreadyCancelled)
            ? "Select at least one ticket that is not already cancelled."
            : "Please select at least one Ticket ID for partial cancellation.",
        );
        setCancelSubmitResult(null);
        return;
      }
      payload.Sectors = sectorsForAppRef;
      payload.TicketId = submittedPartialTicketIds;
    }

    setCancelSubmitting(true);
    setCancelSubmitError("");
    setCancelSubmitResult(null);
    try {
      if (!cancelOtp.trim()) {
        setCancelSubmitError("OTP is required to cancel a ticket.");
        setCancelSubmitResult(null);
        return;
      }
      const r = await fetch("/api/flight/send-change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => null);
      const resp = d?.Response ?? d;
      if (resp?.ResponseStatus === 1) {
        setCancelSubmitResult(resp);
        setCancelSubmitError("");

        const resultToken = selectedBooking?.appReference
          ? String(selectedBooking.appReference)
          : "optional-for-logging";
        const infosRaw = resp?.TicketCRInfo ?? resp?.ticketCRInfo;
        const list = Array.isArray(infosRaw) ? infosRaw : infosRaw != null ? [infosRaw] : [];
        const successful = list.filter(
          (x: any) => String(x?.Remarks ?? x?.remarks ?? "") === "Successful",
        );

        let verifiedCanceled = false;
        for (const item of successful) {
          const crId = item?.ChangeRequestId ?? item?.changeRequestId;
          if (crId == null || String(crId).trim() === "") continue;
          const sr = await fetch("/api/flight/get-change-request-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ChangeRequestId: String(crId),
              ResultToken: resultToken,
            }),
          });
          const statusData = await sr.json().catch(() => null);
          const inner = statusData?.Response ?? statusData;
          const crs = inner?.ChangeRequestStatus ?? inner?.changeRequestStatus;
          if (Number(crs) === 1) {
            verifiedCanceled = true;
            break;
          }
        }

        const appRef = String(selectedBooking?.appReference || "").trim();
        if (verifiedCanceled && appRef) {
          if (cancelMode === "partial" && submittedPartialTicketIds.length > 0) {
            setCanceledTicketIdsByAppRef((prev) => {
              const cur = new Set<number>((prev[appRef] || []).map(Number));
              for (const id of submittedPartialTicketIds) {
                const n = Number(id);
                if (Number.isFinite(n)) cur.add(n);
              }
              return { ...prev, [appRef]: Array.from(cur) };
            });
          } else {
            setCanceledVerifiedByAppRef((prev) => ({ ...prev, [appRef]: true }));
          }
        }
        setCancelFormLockedAfterSubmit(true);
        const appRefForRefresh = String(selectedBooking?.appReference || "").trim();
        await fetchBookings();
        if (appRefForRefresh) {
          await fetchDetail(appRefForRefresh);
        }
      } else {
        const msg = resp?.Error?.ErrorMessage || d?.error || "Cancellation request failed.";
        setCancelSubmitError(String(msg));
        setCancelSubmitResult(null);
      }
    } catch (e) {
      setCancelSubmitError(e instanceof Error ? e.message : String(e));
      setCancelSubmitResult(null);
    } finally {
      setCancelSubmitting(false);
    }
  };

  const getTicketIdsFromBookings = (): number[] => {
    const pax = Array.isArray(selectedBooking?.passengers) ? selectedBooking.passengers : [];
    const out = new Set<number>();
    for (const p of pax) {
      // New structure: passengers[].passengerTicket.ticketId
      const direct = Number(
        p?.passengerTicket?.ticketId ??
          p?.passengerTicket?.TicketId ??
          p?.passengerTicket?.ticketID ??
          p?.passengerTicket?.TicketID,
      );
      if (Number.isFinite(direct)) out.add(direct);

      // Legacy fallback: some older payloads stored a JSON blob under `attributes`
      const raw = p?.attributes;
      if (raw) {
        try {
          const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
          const n = Number(obj?.TicketId ?? obj?.ticketId);
          if (Number.isFinite(n)) out.add(n);
        } catch {
          // ignore invalid attributes
        }
      }
    }

    // Final fallback: deep-scan selectedBooking / bookingDetail for any TicketId keys
    if (out.size === 0) {
      extractTicketIds(selectedBooking).forEach((n) => out.add(n));
      extractTicketIds(bookingDetail).forEach((n) => out.add(n));
    }

    return Array.from(out);
  };

  const normalizePaxTicketStatusLabel = (raw: any): string | null => {
    if (raw == null || raw === "") return null;
    const s = String(raw).trim();
    if (!s) return null;
    const lower = s.toLowerCase();
    if (/cancel|cancell/.test(lower)) return "Cancelled";
    if (/confirm|issued|active|booked|ticketed|success|ok/.test(lower)) return "Confirmed";
    if (/pending|progress|process|open/.test(lower)) return "Pending";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const getPassengerTicketIdNumber = (p: any): number | null => {
    const direct = Number(
      p?.passengerTicket?.ticketId ??
        p?.passengerTicket?.TicketId ??
        p?.passengerTicket?.ticketID ??
        p?.passengerTicket?.TicketID,
    );
    if (Number.isFinite(direct)) return direct;
    const raw = p?.attributes;
    if (raw) {
      try {
        const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
        const n = Number(obj?.TicketId ?? obj?.ticketId);
        if (Number.isFinite(n)) return n;
      } catch {
        /* ignore */
      }
    }
    return null;
  };

  const getPassengerDisplayTicketStatus = (p: any): { label: string; tone: "ok" | "bad" | "muted" | "neutral" } => {
    const appRef = String(selectedBooking?.appReference || "").trim();
    const tid = getPassengerTicketIdNumber(p);

    if (
      itineraryStatusCodeFromBooking(selectedBooking) === 4 ||
      selectedBooking?.itineraryStatusCode === 4 ||
      selectedBooking?.status === "BOOKING_CANCELLED" ||
      selectedBooking?.status === "BOOKING CANCELLED"
    ) {
      return { label: "Cancelled", tone: "bad" };
    }

    const pt = p?.passengerTicket;
    let fromApi =
      normalizePaxTicketStatusLabel(pt?.status) ??
      normalizePaxTicketStatusLabel(pt?.ticketStatus) ??
      normalizePaxTicketStatusLabel(pt?.TicketStatus) ??
      normalizePaxTicketStatusLabel(pt?.cancellationStatus) ??
      normalizePaxTicketStatusLabel(pt?.bookingStatus) ??
      normalizePaxTicketStatusLabel(p?.ticketStatus) ??
      normalizePaxTicketStatusLabel(p?.status);

    if (!fromApi && p?.attributes) {
      try {
        const obj = typeof p.attributes === "string" ? JSON.parse(p.attributes) : p.attributes;
        fromApi = normalizePaxTicketStatusLabel(
          obj?.TicketStatus ?? obj?.ticketStatus ?? obj?.status ?? obj?.bookingStatus,
        );
      } catch {
        /* ignore */
      }
    }

    if (fromApi) {
      return {
        label: fromApi,
        tone:
          fromApi === "Cancelled"
            ? "bad"
            : fromApi === "Pending"
              ? "muted"
              : "ok",
      };
    }

    if (appRef && tid != null) {
      const partial = canceledTicketIdsByAppRef[appRef] || [];
      if (partial.some((x) => Number(x) === tid)) {
        return { label: "Cancelled", tone: "bad" };
      }
    }
    if (appRef && canceledVerifiedByAppRef[appRef]) {
      return { label: "Cancelled", tone: "bad" };
    }

    return { label: "--", tone: "neutral" };
  };

  /** Partial-cancel rows; `alreadyCancelled` tickets cannot be selected again. */
  const getTicketRowsForPartialCancel = (): {
    ticketId: number;
    name: string;
    alreadyCancelled: boolean;
  }[] => {
    const pax = Array.isArray(selectedBooking?.passengers) ? selectedBooking.passengers : [];
    const rows: { ticketId: number; name: string; alreadyCancelled: boolean }[] = [];
    for (const p of pax) {
      const direct = Number(
        p?.passengerTicket?.ticketId ??
          p?.passengerTicket?.TicketId ??
          p?.passengerTicket?.ticketID ??
          p?.passengerTicket?.TicketID,
      );
      let tid: number | null = Number.isFinite(direct) ? direct : null;
      if (tid == null && p?.attributes) {
        try {
          const obj = typeof p.attributes === "string" ? JSON.parse(p.attributes) : p.attributes;
          const n = Number(obj?.TicketId ?? obj?.ticketId);
          if (Number.isFinite(n)) tid = n;
        } catch {
          /* ignore */
        }
      }
      if (tid == null) continue;
      const name =
        [p?.title, p?.firstName, p?.lastName ?? p?.LastName].filter(Boolean).join(" ").trim() ||
        `Passenger (Ticket ${tid})`;
      const alreadyCancelled = getPassengerDisplayTicketStatus(p).label === "Cancelled";
      rows.push({ ticketId: tid, name, alreadyCancelled });
    }
    if (rows.length === 0) {
      const appRef = String(selectedBooking?.appReference || "").trim();
      const partial = appRef ? canceledTicketIdsByAppRef[appRef] || [] : [];
      for (const id of getTicketIdsFromBookings()) {
        const alreadyCancelled =
          itineraryStatusCodeFromBooking(selectedBooking) === 4 ||
          selectedBooking?.itineraryStatusCode === 4 ||
          selectedBooking?.status === "BOOKING_CANCELLED" ||
          selectedBooking?.status === "BOOKING CANCELLED" ||
          (appRef && canceledVerifiedByAppRef[appRef]) ||
          partial.some((x) => Number(x) === Number(id));
        rows.push({ ticketId: id, name: "Name not available", alreadyCancelled });
      }
    }
    return rows;
  };

  useEffect(() => {
    if (!cancelModalOpen || cancelMode !== "partial") return;
    const cancelledIds = new Set(
      getTicketRowsForPartialCancel().filter((r) => r.alreadyCancelled).map((r) => r.ticketId),
    );
    setCancelSelectedTicketIds((prev) => prev.filter((id) => !cancelledIds.has(id)));
  }, [
    cancelModalOpen,
    cancelMode,
    selectedBooking,
    canceledVerifiedByAppRef,
    canceledTicketIdsByAppRef,
  ]);

  const fetchCancellationCharges = async () => {
    const bookingId =
      String(selectedBooking?.transactions?.[0]?.bookId || selectedBooking?.transactions?.[0]?.BookId || "").trim();
    if (!bookingId) {
      setCancelCharges(null);
      setCancelChargesError("Booking ID not found for this booking.");
      return;
    }

    setCancelChargesLoading(true);
    setCancelCharges(null);
    setCancelChargesError("");
    try {
      const r = await fetch("/api/flight/cancellation-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          BookingId: bookingId,
          RequestType: "1",
          BookingMode: "5",
        }),
      });
      const d = await r.json().catch(() => null);

      const resp = d?.Response;
      if (resp?.ResponseStatus === 1) {
        setCancelCharges(resp);
        setCancelChargesError("");
      } else {
        const msg =
          resp?.Error?.ErrorMessage ||
          d?.error ||
          "Unable to process cancellation charges request.";
        setCancelChargesError(String(msg));
        setCancelCharges(null);
      }
    } catch (e) {
      setCancelChargesError(e instanceof Error ? e.message : String(e));
      setCancelCharges(null);
    } finally {
      setCancelChargesLoading(false);
    }
  };

  const callReleasePnr = async () => {
    const bookingId = String(
      selectedBooking?.transactions?.[0]?.bookId || selectedBooking?.transactions?.[0]?.BookId || "",
    ).trim();
    const source = String(selectedBooking?.tboSource ?? "4").trim();
    if (!bookingId) {
      setReleasePnrError("Booking ID not found for this booking.");
      setReleasePnrMessage("");
      setReleasePnrSucceeded(false);
      return;
    }
    setReleasePnrLoading(true);
    setReleasePnrMessage("");
    setReleasePnrError("");
    setReleasePnrSucceeded(false);
    try {
      const r = await fetch("/api/flight/tbo/release-pnr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ BookingId: bookingId, Source: source }),
      });
      const d = await r.json().catch(() => null);
      const resp = d?.Response;
      if (r.ok && resp?.ResponseStatus === 1) {
        setReleasePnrMessage("PNR released successfully.");
        setReleasePnrError("");
        setReleasePnrSucceeded(true);
        await fetchBookings();
      } else {
        const msg =
          resp?.Error?.ErrorMessage ||
          d?.error ||
          d?.message ||
          `Release PNR failed${r.ok ? "" : ` (HTTP ${r.status})`}`;
        setReleasePnrError(String(msg));
        setReleasePnrMessage("");
        setReleasePnrSucceeded(false);
      }
    } catch (e) {
      setReleasePnrError(e instanceof Error ? e.message : String(e));
      setReleasePnrMessage("");
      setReleasePnrSucceeded(false);
    } finally {
      setReleasePnrLoading(false);
    }
  };

  const callGetTicketFromMyBookings = async () => {
    if (!selectedBooking) return;
    const pnr = String(selectedBooking.pnr || "").trim();
    const bookingId = Number(
      selectedBooking.transactions?.[0]?.bookId ?? selectedBooking.transactions?.[0]?.BookId,
    );
    const resultToken = String(selectedBooking.resultToken ?? "").trim();
    const returnRtRaw = String(selectedBooking.returnResultToken ?? "").trim();
    const tripType = String(selectedBooking.tripTypeForInitiatePayment ?? "oneway") as
      | "oneway"
      | "roundtrip";
    const returnResultToken =
      returnRtRaw && returnRtRaw !== resultToken ? returnRtRaw : undefined;

    setGetTicketError("");
    setGetTicketLoading(true);
    try {
      if (!resultToken) {
        throw new Error(
          "Cannot start ticketing: this booking has no fare result token. Refresh My Bookings or contact support if this continues.",
        );
      }

      const domainToken = await flightAPI.getDomainToken();
      const orderRes = (await flightAPI.initiatePayment(
        resultToken,
        domainToken,
        tripType === "roundtrip" ? returnResultToken : undefined,
        tripType,
      )) as Record<string, unknown>;

      const initStatus = orderRes?.Status ?? orderRes?.status;
      const initiatePaymentSucceeded = (() => {
        if (initStatus == null) return true;
        if (initStatus === 1 || initStatus === "1") return true;
        const s = String(initStatus).toLowerCase();
        return s === "success" || s === "true";
      })();
      if (!initiatePaymentSucceeded) {
        throw new Error(
          String(
            orderRes?.Message ??
              orderRes?.message ??
              orderRes?.error ??
              "Could not start payment session before ticketing. Please try again.",
          ),
        );
      }

      const orderId = String(
        orderRes.pgatewayOrderId ??
          (orderRes as { pgateway_order_id?: string }).pgateway_order_id ??
          orderRes.orderId ??
          "",
      ).trim();
      if (!orderId) {
        throw new Error("Failed to create payment order. Please try again.");
      }

      const tokenForPaymentApis =
        (await flightAPI.getDomainToken().catch(() => "")) || domainToken;
      const pgatewayRaw = String(orderRes.pgateway ?? "razorpay").trim();
      const gatewayLower = pgatewayRaw.toLowerCase();
      const hdfcUrl = String(orderRes.url ?? orderRes.Url ?? "").trim();

      if (gatewayLower === "hdfc") {
        if (!hdfcUrl) throw new Error("HDFC did not return a payment URL");
        try {
          sessionStorage.setItem(
            HDFC_PENDING_MY_BOOKINGS_GET_TICKET_KEY,
            JSON.stringify({
              pnr,
              bookingId,
              domainToken: tokenForPaymentApis,
            }),
          );
        } catch {
          throw new Error("Could not save payment session. Please try again.");
        }
        window.location.href = hdfcUrl;
        return;
      }

      const amountToCharge = getMyBookingPayableAmountInr(selectedBooking, orderRes);
      if (!amountToCharge || amountToCharge <= 0) {
        throw new Error(
          "Could not determine the amount to pay. Please check your booking fare or contact support.",
        );
      }

      const pax = Array.isArray(selectedBooking.passengers) ? selectedBooking.passengers : [];
      const leadPax = pax.find((p: any) => p?.isLeadPax) || pax[0] || {};
      const guestEmail = String(selectedBooking.email || user?.email || "").trim();
      const guestMobile = String(selectedBooking.phone || user?.phone || "").replace(/\s/g, "");

      const payRes: any = await paymentAPI.processRazorpayPayment(
        orderId,
        amountToCharge,
        undefined,
        {
          name: `${String(leadPax.firstName ?? leadPax.FirstName ?? "").trim()} ${String(leadPax.lastName ?? leadPax.LastName ?? "").trim()}`.trim() || undefined,
          email: guestEmail || undefined,
          contact: guestMobile || undefined,
        },
      );

      const validRes = (await flightAPI.validatePayment(
        {
          payId: payRes.razorpay_payment_id,
          orderId: payRes.razorpay_order_id,
          signature: payRes.razorpay_signature,
          pgateway: pgatewayRaw,
          resultToken,
        },
        tokenForPaymentApis,
      )) as Record<string, unknown>;

      const validationResult = String(
        validRes?.validationResult ?? validRes?.ValidationResult ?? "",
      ).toUpperCase();
      if (validationResult !== "VALID") {
        throw new Error(
          String(
            validRes?.message ??
              validRes?.Message ??
              `Payment validation failed: ${validationResult || validRes?.validationResult || "unknown"}.`,
          ),
        );
      }

      const result = await commitBookingSkipBook(pnr, bookingId);
      bookingState.saveTicket({
        ticketDetails: result.ticketDetails,
        pnr: result.pnr,
        appReference: result.appReference,
        domainToken: result.domainToken ?? "",
      });
      router.push("/flights/ticket");
    } catch (e) {
      setGetTicketError(e instanceof Error ? e.message : String(e));
    } finally {
      setGetTicketLoading(false);
    }
  };

  const sendDashboardOtp = async (
    email: string,
    phone: string,
    requestType: string,
  ): Promise<{ ok: boolean; message: string }> => {
    if (!email.trim()) {
      return { ok: false, message: "Email is required to send OTP." };
    }
    if (!phone.trim()) {
      return { ok: false, message: "Phone number is required to send OTP." };
    }
    try {
      const r = await fetch("/api/user/generate-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), phone: phone.trim(), requestType }),
      });
      const d = await r.json().catch(() => null);
      const ok = isOtpApiSuccess(d, r.ok);
      if (!ok) {
        return { ok: false, message: otpApiMessage(d, "Failed to send OTP") };
      }
      return { ok: true, message: otpApiMessage(d, "OTP has been sent to your email") };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  };

  const openBookingDetail = (b: any) => {
    setSelectedBooking(b);
    const ref = String(b?.appReference || "").trim();
    if (ref) void fetchDetail(ref);
    setCancelCharges(null);
    setCancelChargesError("");
    setCancelSubmitResult(null);
    setCancelSubmitError("");
    setReleasePnrMessage("");
    setReleasePnrError("");
    setReleasePnrSucceeded(false);
  };

  const closeViewOtpModal = () => {
    setViewOtpModalOpen(false);
    setViewOtpTarget(null);
    setViewOtp("");
    setViewOtpStatus("idle");
    setViewOtpMessage("");
    setViewOtpVerifying(false);
  };

  const myBookingRowKey = (b: any, rowIndex: number) =>
    String(b?.appReference || b?.pnr || `row-${rowIndex}`).trim();

  const handleViewBookingClick = async (b: any, rowKey: string) => {
    setViewOtpTarget(b);
    setViewOtp("");
    setViewOtpStatus("sending");
    setViewOtpMessage("");
    setViewOtpSendingKey(rowKey);
    try {
      const email = String(user?.email || b?.email || "").trim();
      const phone = String(b?.phone || user?.phone || "").trim();
      const result = await sendDashboardOtp(email, phone, MY_BOOKINGS_VIEW_OTP_REQUEST_TYPE);
      if (!result.ok) {
        setViewOtpStatus("error");
        setViewOtpMessage(result.message);
        return;
      }
      setViewOtpStatus("sent");
      setViewOtpMessage(result.message);
      setViewOtpModalOpen(true);
    } finally {
      setViewOtpSendingKey(null);
    }
  };

  const requestViewBookingOtp = async (): Promise<boolean> => {
    const b = viewOtpTarget;
    if (!b) return false;
    setViewOtp("");
    setViewOtpStatus("sending");
    setViewOtpMessage("");
    const email = String(user?.email || b?.email || "").trim();
    const phone = String(b?.phone || user?.phone || "").trim();
    const result = await sendDashboardOtp(email, phone, MY_BOOKINGS_VIEW_OTP_REQUEST_TYPE);
    if (!result.ok) {
      setViewOtpStatus("error");
      setViewOtpMessage(result.message);
      return false;
    }
    setViewOtpStatus("sent");
    setViewOtpMessage(result.message);
    return true;
  };

  const confirmViewBookingOtp = async () => {
    const otp = viewOtp.trim();
    if (!otp) {
      setViewOtpMessage("Please enter the OTP sent to your email.");
      setViewOtpStatus("error");
      return;
    }
    const b = viewOtpTarget;
    if (!b) return;

    const email = String(user?.email || b?.email || "").trim();
    const phone = String(b?.phone || user?.phone || "").trim();
    setViewOtpVerifying(true);
    setViewOtpMessage("");
    try {
      const r = await fetch("/api/user/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          requestType: MY_BOOKINGS_VIEW_OTP_REQUEST_TYPE,
          otp,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!isOtpApiSuccess(d, r.ok)) {
        setViewOtpStatus("error");
        setViewOtpMessage(otpApiMessage(d, "Invalid or expired OTP. Please try again."));
        return;
      }
      openBookingDetail(b);
      closeViewOtpModal();
    } catch (e) {
      setViewOtpStatus("error");
      setViewOtpMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setViewOtpVerifying(false);
    }
  };

  const requestCancelOtp = async (): Promise<boolean> => {
    try {
      setCancelOtp("");
      setCancelOtpStatus("sending");
      setCancelOtpMessage("");

      const email = String(user?.email || selectedBooking?.email || "").trim();
      const phone = String(selectedBooking?.phone || user?.phone || "").trim();

      const r = await fetch("/api/user/generate-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          requestType: "TICKET_CANCEL_REQ",
        }),
      });
      const d = await r.json().catch(() => null);
      const status = String(d?.status ?? d?.Status ?? "").toLowerCase();
      const ok = r.ok && (status === "success" || status === "ok" || status === "1");

      if (!ok) {
        setCancelOtpStatus("error");
        setCancelOtpMessage(String(d?.message || d?.Message || d?.error || "Failed to send OTP"));
        return false;
      }

      setCancelOtpStatus("sent");
      setCancelOtpMessage(String(d?.message || d?.Message || "OTP has been sent"));
      return true;
    } catch (e) {
      setCancelOtpStatus("error");
      setCancelOtpMessage(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const fetchFamilyMembers = async () => {
    setLoadingFamily(true);
    try {
      const response = await fetch(`/api/family-members?userId=${user.userId}`);
      if (response.ok) {
        const data = await response.json();
        setFamilyMembers(Array.isArray(data.response) ? data.response : []);
      }
    } catch (error) {
      console.error('Fetch Family Members Error:', error);
    }
    setLoadingFamily(false);
  };

  const handleAddFamilyMember = async () => {
    if (!newMember.firstName.trim() || !newMember.lastName.trim()) {
      alert('Please enter first and last name');
      return;
    }
    const dobErr = validateRequiredTravellerDateOfBirth(newMember.dateOfBirth);
    if (dobErr) {
      alert(dobErr);
      return;
    }
    try {
      const response = await fetch('/api/family-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          withPassportIssuingCountryForApi({
            ...newMember,
            userId: user.userId,
            PassportIssueCountryCode:
              newMember.PassportIssueCountryCode || "IN",
          }),
        ),
      });
      if (response.ok) {
        setMessage('Family member added successfully!');
        setShowAddFamily(false);
        setNewMember({
          firstName: "",
          lastName: "",
          dateOfBirth: null,
          passportIssueDate: null,
          email: null,
          passportUserName: null,
          passportNationality: "",
          passportExpiryDay: null,
          passportExpiryMonth: null,
          passportExpiryYear: null,
          passportNumber: null,
          PassportIssueCountryCode: "IN",
        });
        fetchFamilyMembers();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Add Family Member Error:', error);
      alert('Failed to add family member');
    }
  };

  const toDateOnlyIso = (v: any): string => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const toIsoFromDmy = (dd: any, mm: any, yy: any): string => {
    const d = String(dd ?? "").trim();
    const m = String(mm ?? "").trim();
    const y = String(yy ?? "").trim();
    if (!d || !m || !y) return "";
    return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };

  /** Value for `userTravellerDetails/update/{id}` — backend uses `origin` from getSavedPaxById. */
  const getTravellerIdFromMember = (member: any): string => {
    if (!member || typeof member !== "object") return "";
    const candidates = [
      member.origin,
      member.Origin,
      member.travellerDetails?.origin,
      member.travellerDetails?.Origin,
      member.userTravellerDetails?.origin,
      member.userTravellerDetails?.Origin,
      member.id,
      member.Id,
      member.ID,
      member.travellerId,
      member.TravellerId,
      member.travelerId,
      member.TravelerId,
      member.travellerDetailsId,
      member.TravellerDetailsId,
      member.userTravellerId,
      member.UserTravellerId,
      member.userTravellerDetailsId,
      member.UserTravellerDetailsId,
      member.userTravelerId,
      member.paxId,
      member.PaxId,
      member.passengerId,
      member.PassengerId,
      member.travellerDetails?.id,
      member.travellerDetails?.Id,
      member.userTravellerDetails?.id,
      member.userTravellerDetails?.Id,
    ];
    for (const c of candidates) {
      const s = String(c ?? "").trim();
      if (s) return s;
    }
    const uid = member.userId ?? member.UserId;
    const u = String(uid ?? "").trim();
    if (u) return u;
    return "";
  };

  const startEditFamilyMember = (member: any, rowIndex: number) => {
    const travellerId = getTravellerIdFromMember(member);
    if (!travellerId) {
      setMessage(
        "Cannot update: `origin` (or traveller id) missing from saved member. Check getSavedPaxById response.",
      );
      setTimeout(() => setMessage(""), 5000);
      return;
    }
    setEditingTravellerId(travellerId);
    setEditingFamilyRowIndex(rowIndex);
    setFamilyUpdateError("");
    setFamilyEditOriginal(member);
    setFamilyEdit({
      firstName: String(member?.firstName ?? "").trim(),
      lastName: String(member?.lastName ?? "").trim(),
      dateOfBirth: toDateOnlyIso(member?.dateOfBirth),
      email: String(member?.email ?? "").trim(),
      passportUserName: String(member?.passportUserName ?? "").trim(),
      passportNationality: String(member?.passportNationality ?? "").trim(),
      passportNumber: String(member?.passportNumber ?? "").trim(),
      PassportIssueCountryCode: readPassportIssuingCountry(member) || "IN",
      passportIssueDate: toDateOnlyIso(member?.passportIssueDate),
      passportExpiryDate: toIsoFromDmy(
        member?.passportExpiryDay,
        member?.passportExpiryMonth,
        member?.passportExpiryYear,
      ),
    });
  };

  const cancelEditFamilyMember = (e?: MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditingFamilyRowIndex(null);
    setEditingTravellerId(null);
    setFamilyUpdateError("");
    setFamilyUpdateLoading(false);
    setFamilyEditOriginal(null);
  };

  const saveEditFamilyMember = async () => {
    if (!editingTravellerId) return;
    const dobErr = validateRequiredTravellerDateOfBirth(familyEdit.dateOfBirth);
    if (dobErr) {
      setFamilyUpdateError(dobErr);
      return;
    }
    setFamilyUpdateLoading(true);
    setFamilyUpdateError("");
    try {
      const orig = familyEditOriginal || {};
      const changes: any = {};
      const setIfChanged = (key: string, next: any, prev: any) => {
        const n = next === "" ? null : next;
        const p = prev === "" ? null : prev;
        if (String(n ?? "") !== String(p ?? "")) changes[key] = n;
      };

      setIfChanged("firstName", familyEdit.firstName, orig?.firstName);
      setIfChanged("lastName", familyEdit.lastName, orig?.lastName);
      setIfChanged("email", familyEdit.email, orig?.email);
      setIfChanged("passportUserName", familyEdit.passportUserName, orig?.passportUserName);
      setIfChanged("passportNationality", familyEdit.passportNationality, orig?.passportNationality);
      setIfChanged("passportNumber", familyEdit.passportNumber, orig?.passportNumber);
      setIfChanged(
        "passportIssuingCountry",
        familyEdit.PassportIssueCountryCode || "IN",
        readPassportIssuingCountry(orig),
      );
      setIfChanged("dateOfBirth", familyEdit.dateOfBirth || null, toDateOnlyIso(orig?.dateOfBirth));
      setIfChanged(
        "passportIssueDate",
        familyEdit.passportIssueDate || null,
        toDateOnlyIso(orig?.passportIssueDate),
      );

      // Expiry is stored as day/month/year in backend
      const origExpIso = toIsoFromDmy(orig?.passportExpiryDay, orig?.passportExpiryMonth, orig?.passportExpiryYear);
      if (String(familyEdit.passportExpiryDate || "") !== String(origExpIso || "")) {
        if (!familyEdit.passportExpiryDate) {
          changes.passportExpiryDay = null;
          changes.passportExpiryMonth = null;
          changes.passportExpiryYear = null;
        } else {
          const [yy, mm, dd] = familyEdit.passportExpiryDate.split("-");
          changes.passportExpiryYear = yy || null;
          changes.passportExpiryMonth = mm || null;
          changes.passportExpiryDay = dd || null;
        }
      }

      const payload = withPassportIssuingCountryForApi({
        userId: Number(editingTravellerId),
        ...changes,
      });

      // If nothing changed, just close edit mode.
      if (Object.keys(changes).length === 0) {
        setEditingFamilyRowIndex(null);
        setEditingTravellerId(null);
        return;
      }

      const r = await fetch(`/api/family-members/${encodeURIComponent(editingTravellerId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        throw new Error(String(d?.message || d?.error || "Update failed"));
      }
      setEditingFamilyRowIndex(null);
      setEditingTravellerId(null);
      await fetchFamilyMembers();
    } catch (e) {
      setFamilyUpdateError(e instanceof Error ? e.message : String(e));
    } finally {
      setFamilyUpdateLoading(false);
    }
  };

  const badge = (s: string) =>
    ({
      "BOOKING CONFIRMED": "bg-green-100 text-green-700",
      "BOOKING CANCELLED": "bg-red-100 text-red-700",
      "BOOKING FAILED": "bg-red-100 text-red-800",
      "BOOKING PENDING": "bg-amber-100 text-amber-800",
      "BOOKING IN PROGRESS PENDING": "bg-blue-100 text-blue-800",
      BOOKING_CONFIRMED: "bg-green-100 text-green-700",
      CANCELLED: "bg-red-100 text-red-700",
      PENDING: "bg-yellow-100 text-yellow-700",
    })[s] || "bg-gray-100 text-gray-700";

  const Chk = ({ on }: { on: boolean }) => (
    <span
      style={{
        display: "inline-flex",
        width: 15,
        height: 15,
        borderRadius: 3,
        border: `2px solid ${on ? OG : "#d1d5db"}`,
        background: on ? OG : "white",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {on && (
        <span
          style={{
            color: "white",
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          ✓
        </span>
      )}
    </span>
  );

  /* ─── FILTER PANEL ─────────────────────────────────────────────── */
  const filterPanel = (
    <div
      style={{
        width: 210,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* header strip */}
      <div
        style={{
          background: OG,
          borderRadius: 10,
          padding: "8px 12px",
          color: "white",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
          FILTERS
        </div>
      </div>

      {/* Stops */}
      <div
        style={{
          background: "white",
          borderRadius: 10,
          border: `1px solid #fed7aa`,
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <b
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Stops
          </b>
          <button
            onClick={() => setFStops(new Set())}
            style={{
              fontSize: 11,
              color: OG,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Clear
          </button>
        </div>
        {[
          ["nonstop", "Non-stop", 18],
          ["1stop", "1 Stop", 42],
          ["2plus", "2+ Stops", 8],
        ].map(([k, l, c]) => (
          <div
            key={k as string}
            onClick={() => tog(fStops, k as string, setFStops)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 0",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Chk on={fStops.has(k as string)} />
              <span style={{ fontSize: 12 }}>{l}</span>
            </span>
            <span
              style={{
                fontSize: 11,
                color: "#9ca3af",
                background: "#f3f4f6",
                padding: "1px 7px",
                borderRadius: 10,
              }}
            >
              {c}
            </span>
          </div>
        ))}
      </div>

      {/* Price Range */}
      <div
        style={{
          background: "white",
          borderRadius: 10,
          border: `1px solid #fed7aa`,
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <b
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Price Range
          </b>
          <button
            style={{
              fontSize: 11,
              color: OG,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Reset
          </button>
        </div>
        <div
          style={{
            position: "relative",
            height: 4,
            background: "#e5e7eb",
            borderRadius: 2,
            margin: "14px 4px",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "10%",
              right: "25%",
              height: "100%",
              background: OG,
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "10%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: "white",
              border: `2px solid ${OG}`,
              cursor: "pointer",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: "25%",
              top: "50%",
              transform: "translate(50%,-50%)",
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: "white",
              border: `2px solid ${OG}`,
              cursor: "pointer",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "#9ca3af",
          }}
        >
          <span>₹8,500</span>
          <span>₹48,000</span>
        </div>
      </div>

      {/* Departure Time */}
      <div
        style={{
          background: "white",
          borderRadius: 10,
          border: `1px solid #fed7aa`,
          padding: 12,
        }}
      >
        <b
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            display: "block",
            marginBottom: 8,
          }}
        >
          Departure Time
        </b>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
        >
          {[
            ["earlyam", "Early AM", "00-06"],
            ["morning", "Morning", "06-12"],
            ["afternoon", "Afternoon", "12-18"],
            ["evening", "Evening", "18-00"],
          ].map(([k, l, s]) => (
            <button
              key={k as string}
              onClick={() => tog(fTimes, k as string, setFTimes)}
              style={{
                border: `2px solid ${fTimes.has(k as string) ? OG : "#e5e7eb"}`,
                borderRadius: 7,
                padding: "6px 2px",
                cursor: "pointer",
                background: fTimes.has(k as string) ? "#fff7ed" : "white",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: fTimes.has(k as string) ? 700 : 400,
                  color: fTimes.has(k as string) ? OG : "#9ca3af",
                }}
              >
                {l}
              </div>
              <div style={{ fontSize: 9, color: "#9ca3af" }}>{s}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Airlines */}
      <div
        style={{
          background: "white",
          borderRadius: 10,
          border: `1px solid #fed7aa`,
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <b
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Airlines
          </b>
          <button
            onClick={() =>
              setFAirlines(new Set(["EK", "AI", "G9", "6E", "FZ"]))
            }
            style={{
              fontSize: 11,
              color: OG,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            All
          </button>
        </div>
        {[
          ["EK", "Emirates", "₹9,200"],
          ["AI", "Air India", "₹8,900"],
          ["G9", "Air Arabia", "₹10,400"],
          ["6E", "IndiGo", "₹11,800"],
          ["FZ", "Fly Dubai", "₹12,200"],
        ].map(([code, name, price]) => (
          <div
            key={code as string}
            onClick={() => tog(fAirlines, code as string, setFAirlines)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "4px 0",
              cursor: "pointer",
            }}
          >
            <Chk on={fAirlines.has(code as string)} />
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: "#1f2937",
                color: "white",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 7,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {code}
            </span>
            <span style={{ fontSize: 12, flex: 1 }}>{name}</span>
            <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>
              {price}
            </span>
          </div>
        ))}
      </div>

      {/* Content Source */}
      <div
        style={{
          background: "white",
          borderRadius: 10,
          border: `1px solid #fed7aa`,
          padding: 12,
        }}
      >
        <b
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            display: "block",
            marginBottom: 8,
          }}
        >
          Content Source
        </b>
        {[
          ["Amadeus GDS", 28, ""],
          ["Galileo / Travelport", 22, ""],
          ["NDC Direct", 8, "BEST PRICE"],
          ["Sabre", 14, ""],
          ["TBO / LCC India", 6, ""],
        ].map(([l, c, bdg]) => (
          <div
            key={l as string}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 0",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Chk on={true} />
              <span style={{ fontSize: 12 }}>{l}</span>
              {bdg && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#c2410c",
                    background: "#fed7aa",
                    padding: "1px 5px",
                    borderRadius: 4,
                  }}
                >
                  {bdg}
                </span>
              )}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "#9ca3af",
                background: "#f3f4f6",
                padding: "1px 7px",
                borderRadius: 10,
              }}
            >
              {c}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
  /* ─────────────────────────────────────────────────────────────── */

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        fontFamily: "sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          background: "white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 60,
          }}
        >
          <button
            onClick={onBack}
            style={{
              color: OG,
              fontWeight: 700,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ← Back to Home
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: OG,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              {user?.firstName?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {user?.firstName} {user?.lastName}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                {user?.email}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page layout: sidebar | (booking + filter) */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "20px",
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        {/* ── Sidebar ── */}
        <div
          style={{
            width: 170,
            flexShrink: 0,
            background: "white",
            borderRadius: 12,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            padding: 14,
            position: "sticky",
            top: 80,
          }}
        >
          <div
            style={{
              textAlign: "center",
              paddingBottom: 14,
              marginBottom: 14,
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: OG,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 20,
                margin: "0 auto 8px",
              }}
            >
              {user?.firstName?.[0]?.toUpperCase()}
            </div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              {user?.firstName} {user?.lastName}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#9ca3af",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.email}
            </div>
          </div>
          {[
            { id: "overview", icon: "🏠", label: "Overview" },
            { id: "bookings", icon: "🎫", label: "My Bookings" },
            { id: "family", icon: "👨‍👩‍👧‍👦", label: "Family" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id as "overview" | "bookings" | "family");
                setSelectedBooking(null);
                setBookingDetail(null);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginBottom: 3,
                fontSize: 12,
                background: activeTab === t.id ? OG : "transparent",
                color: activeTab === t.id ? "white" : "#374151",
                fontWeight: activeTab === t.id ? 600 : 400,
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}

          <button
            onClick={onBack}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 3,
              fontSize: 12,
              background: "transparent",
              color: "#374151",
              fontWeight: 400,
            }}
          >
            <span>✈️</span>
            <span>Book Flight</span>
          </button>

          <div style={{ borderTop: "1px solid #f0f0f0", marginTop: 10, paddingTop: 10 }}>
            <button
              onClick={handleSignOut}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12,
                background: "transparent",
                color: "#dc2626",
                fontWeight: 600,
              }}
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* ── Content area: booking panel + filter panel side by side ── */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          {/* Booking panel */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              background: "white",
              borderRadius: 12,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              padding: 18,
            }}
          >
            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                  Welcome back, {user?.firstName}!
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  {[
                    {
                      bg: "#eff6ff",
                      bd: "#bfdbfe",
                      icon: "🎫",
                      val: bookings.length,
                      label: "Total Bookings",
                      c: "#1d4ed8",
                    },
                    {
                      bg: "#f0fdf4",
                      bd: "#bbf7d0",
                      icon: "✅",
                      val: bookings.filter((b) => itineraryStatusCodeFromBooking(b) === 5).length,
                      label: "Confirmed",
                      c: "#15803d",
                    },
                    {
                      bg: "#fff7ed",
                      bd: "#fed7aa",
                      icon: "👤",
                      val: user?.userId,
                      label: "User ID",
                      c: "#c2410c",
                    },
                  ].map(({ bg, bd, icon, val, label, c }) => (
                    <div
                      key={label}
                      style={{
                        background: bg,
                        border: `1px solid ${bd}`,
                        borderRadius: 10,
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ fontSize: 20 }}>{icon}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: c }}>
                        {val}
                      </div>
                      <div style={{ fontSize: 11, color: c, fontWeight: 500 }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <b
                      style={{
                        fontSize: 12,
                        display: "block",
                        marginBottom: 8,
                      }}
                    >
                      Profile Info
                    </b>
                    {[
                      ["Username", user?.userName],
                      ["Email", user?.email],
                      [
                        "Phone",
                        user?.phone
                          ? `+${user?.countryCode} ${user?.phone}`
                          : `+${user?.countryCode}`,
                      ],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          marginBottom: 5,
                        }}
                      >
                        <span style={{ color: "#9ca3af" }}>{k}</span>
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 110,
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <b
                      style={{
                        fontSize: 12,
                        display: "block",
                        marginBottom: 8,
                      }}
                    >
                      Quick Actions
                    </b>
                    <button
                      onClick={() => setActiveTab("bookings")}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        background: "#f9fafb",
                        marginBottom: 5,
                      }}
                    >
                      🎫 My Bookings
                    </button>
                    <button
                      onClick={onBack}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        background: "#fff7ed",
                        color: OG,
                        fontWeight: 600,
                      }}
                    >
                      ✈️ Book Flight
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MY BOOKINGS */}
            {activeTab === "bookings" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <h2 style={{ fontSize: 17, fontWeight: 700 }}>My Bookings</h2>
                  <button
                    onClick={fetchBookings}
                    style={{
                      color: OG,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    ↻ Refresh
                  </button>
                </div>

                {selectedBooking ? (
                  <div>
                    {(() => {
                      const curIdx = bookings.findIndex(
                        (b) => String(b?.appReference || "") === String(selectedBooking?.appReference || ""),
                      );
                      const hasPrev = curIdx > 0;
                      const hasNext = curIdx >= 0 && curIdx < bookings.length - 1;
                      const go = (delta: number) => {
                        const next = bookings[curIdx + delta];
                        if (!next) return;
                        setSelectedBooking(next);
                        fetchDetail(next.appReference);
                        setCancelCharges(null);
                        setCancelChargesError("");
                        setCancelSubmitResult(null);
                        setCancelSubmitError("");
                        setReleasePnrMessage("");
                        setReleasePnrError("");
                        setReleasePnrSucceeded(false);
                      };
                      return (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 10,
                          }}
                        >
                          <button
                            onClick={() => {
                              void fetchBookings();
                              setSelectedBooking(null);
                              setBookingDetail(null);
                              closeViewOtpModal();
                              setCancelCharges(null);
                              setCancelChargesError("");
                              setCancelSubmitResult(null);
                              setCancelSubmitError("");
                              setReleasePnrMessage("");
                              setReleasePnrError("");
                              setReleasePnrSucceeded(false);
                            }}
                            style={{
                              color: OG,
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            ← Back to list
                          </button>

                          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                            <button
                              onClick={() => go(-1)}
                              disabled={!hasPrev}
                              style={{
                                fontSize: 12,
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid #e5e7eb",
                                background: hasPrev ? "white" : "#f9fafb",
                                color: hasPrev ? "#374151" : "#9ca3af",
                                cursor: hasPrev ? "pointer" : "not-allowed",
                              }}
                              title={hasPrev ? "Previous booking" : "No previous booking"}
                            >
                              ← Prev
                            </button>
                            <button
                              onClick={() => go(1)}
                              disabled={!hasNext}
                              style={{
                                fontSize: 12,
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid #e5e7eb",
                                background: hasNext ? "white" : "#f9fafb",
                                color: hasNext ? "#374151" : "#9ca3af",
                                cursor: hasNext ? "pointer" : "not-allowed",
                              }}
                              title={hasNext ? "Next booking" : "No next booking"}
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    <div
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 10,
                        background: "#f9fafb",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <div>
                          <b>{selectedBooking.pnr ? `PNR: ${selectedBooking.pnr}` : "PNR: —"}</b>
                          <div style={{ fontSize: 12, color: "#4b5563" }}>
                            {selectedBooking.fromLoc}{" "}
                            {isMyBookingRoundtrip(selectedBooking) ? "↔" : "→"}{" "}
                            {selectedBooking.toLoc}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(selectedBooking.status)}`}
                          >
                            {selectedBooking.status}
                          </span>
                          {canceledVerifiedByAppRef[String(selectedBooking.appReference || "")] && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                              Canceled
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4,1fr)",
                          gap: 6,
                          fontSize: 12,
                        }}
                      >
                        {[
                          [
                            "Booking ID",
                            selectedBooking?.transactions?.[0]?.bookId ||
                              selectedBooking?.transactions?.[0]?.BookId ||
                              "—",
                          ],
                          ["Source", selectedBooking?.tboSource ?? "—"],
                          [
                            "Ticket ID",
                            (() => {
                              const ids = getTicketIdsFromBookings();
                              return ids.length ? ids.join(", ") : "—";
                            })(),
                          ],
                          ["Cabin", selectedBooking.cabinClass],
                          ["Phone", selectedBooking.phone],
                          ["Email", selectedBooking.email],
                          [
                            "Created",
                            selectedBooking.createdOn
                              ? formatUserDate(selectedBooking.createdOn)
                              : "—",
                          ],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <div style={{ color: "#9ca3af", fontSize: 11 }}>
                              {k}
                            </div>
                            <div
                              style={{
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {v}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Itinerary Details */}
                    {selectedBooking.itinerary?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <h3
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            marginBottom: 8,
                          }}
                        >
                          Flight Details
                        </h3>
                        {selectedBooking.itinerary.map(
                          (seg: any, i: number) => (
                            <div
                              key={i}
                              style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                                padding: 12,
                                marginBottom: 8,
                                background: "white",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  marginBottom: 6,
                                }}
                              >
                                <b style={{ fontSize: 13 }}>
                                  {seg.airlineName} ({seg.airlineCode}{" "}
                                  {seg.flightNumber})
                                </b>
                                <span
                                  style={{ fontSize: 11, color: "#6b7280" }}
                                >
                                  PNR: <b>{seg.airlinePnr}</b>
                                </span>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  fontSize: 13,
                                }}
                              >
                                <div style={{ textAlign: "center" }}>
                                  <b>{seg.fromAirportCode}</b>
                                  <div
                                    style={{ fontSize: 10, color: "#9ca3af" }}
                                  >
                                    {new Date(
                                      seg.departureDatetime,
                                    ).toLocaleString()}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    flex: 1,
                                    textAlign: "center",
                                    color: "#9ca3af",
                                  }}
                                >
                                  ✈️
                                </div>
                                <div style={{ textAlign: "center" }}>
                                  <b>{seg.toAirportCode}</b>
                                  <div
                                    style={{ fontSize: 10, color: "#9ca3af" }}
                                  >
                                    {new Date(
                                      seg.arrivalDatetime,
                                    ).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div
                                style={{
                                  marginTop: 6,
                                  display: "flex",
                                  gap: 10,
                                  fontSize: 11,
                                  color: "#6b7280",
                                }}
                              >
                                <span>🧳 {seg.checkinBaggage}</span>
                                <span>💼 {seg.cabinBaggage}</span>
                                <span
                                  style={{
                                    color:
                                      seg.isRefundable === "Refundable"
                                        ? "#15803d"
                                        : "#dc2626",
                                  }}
                                >
                                  {seg.isRefundable}
                                </span>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    )}

                    {/* Passenger Details */}
                    {selectedBooking.passengers?.length > 0 && (
                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 8,
                          background: "white",
                        }}
                      >
                        <b
                          style={{
                            fontSize: 12,
                            display: "block",
                            marginBottom: 6,
                          }}
                        >
                          Passengers
                        </b>
                        {selectedBooking.passengers.map((p: any, i: number) => {
                          const tidNum = getPassengerTicketIdNumber(p);
                          const ticketIdDisp = tidNum != null ? String(tidNum) : "—";
                          const st = getPassengerDisplayTicketStatus(p);
                          const statusColor =
                            st.tone === "bad"
                              ? "#b91c1c"
                              : st.tone === "muted"
                                ? "#92400e"
                                : st.tone === "neutral"
                                  ? "#9ca3af"
                                  : "#15803d";
                          const { meals: mealDisp, seats: seatDisp } = getPassengerMealAndSeatDisplay(p);
                          return (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 12,
                                padding: "4px 0",
                                borderBottom: "1px solid #f3f4f6",
                                gap: 10,
                              }}
                            >
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: "block", fontWeight: 600 }}>
                                  {p.title} {p.firstName} {p.lastName}
                                </span>
                                <span
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    gap: "4px 10px",
                                    fontSize: 11,
                                    color: "#6b7280",
                                    marginTop: 2,
                                  }}
                                >
                                  <span>
                                    <span style={{ color: "#9ca3af" }}>Ticket ID</span>{" "}
                                    <span style={{ fontWeight: 600, color: "#374151" }}>{ticketIdDisp}</span>
                                  </span>
                                  <span>
                                    <span style={{ color: "#9ca3af" }}>Status</span>{" "}
                                    <span style={{ fontWeight: 700, color: statusColor }}>{st.label}</span>
                                  </span>
                                </span>
                                <span
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2,
                                    marginTop: 6,
                                    fontSize: 11,
                                    color: "#6b7280",
                                  }}
                                >
                                  <span>
                                    <span style={{ color: "#9ca3af" }}>Meal</span>{" "}
                                    <span style={{ fontWeight: 600, color: "#374151" }}>
                                      {mealDisp || "—"}
                                    </span>
                                  </span>
                                  <span>
                                    <span style={{ color: "#9ca3af" }}>Seat</span>{" "}
                                    <span style={{ fontWeight: 600, color: "#374151" }}>
                                      {seatDisp || "—"}
                                    </span>
                                  </span>
                                </span>
                              </span>
                              <span style={{ color: "#9ca3af", flexShrink: 0 }}>
                                {p.passengerType}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Fare Details */}
                    {selectedBooking.transactions?.length > 0 &&
                      selectedBooking.transactions[0].attributes?.Fare && (
                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: 12,
                            marginBottom: 8,
                            background: "white",
                          }}
                        >
                          <b
                            style={{
                              fontSize: 12,
                              display: "block",
                              marginBottom: 6,
                            }}
                          >
                            Fare Breakdown
                          </b>
                          {(() => {
                            const fare =
                              selectedBooking.transactions[0].attributes.Fare;
                            return (
                              <div style={{ fontSize: 12 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "4px 0",
                                  }}
                                >
                                  <span style={{ color: "#6b7280" }}>
                                    Base Fare
                                  </span>
                                  <span>
                                    {fare.Currency}{" "}
                                    {fare.BaseFare?.toLocaleString()}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "4px 0",
                                  }}
                                >
                                  <span style={{ color: "#6b7280" }}>Tax</span>
                                  <span>
                                    {fare.Currency} {fare.Tax?.toLocaleString()}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "4px 0",
                                    borderTop: "1px solid #e5e7eb",
                                    marginTop: 4,
                                    paddingTop: 8,
                                    fontWeight: 700,
                                  }}
                                >
                                  <span>Total</span>
                                  <span style={{ color: OG }}>
                                    {fare.Currency}{" "}
                                    {fare.PublishedFare?.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                    {(() => {
                      const fiCode = itineraryStatusCodeFromBooking(selectedBooking);
                      const allTicketsCancelled =
                        fiCode === 4 ||
                        selectedBooking?.status === "BOOKING_CANCELLED" ||
                        selectedBooking?.status === "BOOKING CANCELLED"
                          ? true
                          : Array.isArray(selectedBooking?.passengers) &&
                              selectedBooking.passengers.length > 0
                            ? selectedBooking.passengers.every(
                                (p: any) => getPassengerDisplayTicketStatus(p).label === "Cancelled",
                              )
                            : (() => {
                                const rows = getTicketRowsForPartialCancel();
                                return rows.length > 0 && rows.every((r) => r.alreadyCancelled);
                              })();
                      const showConfirmedActions =
                        fiCode === 5 && !allTicketsCancelled;
                      const showPendingPnrActions = fiCode === 1 && !allTicketsCancelled;
                      const bookingActionsLocked = getTicketLoading || releasePnrLoading;

                      return (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a
                        href={`/api/flight/ticket-pdf?app_reference=${encodeURIComponent(
                          String(
                            selectedBooking?.appReference ||
                              selectedBooking?.transactions?.[0]?.bookId ||
                              selectedBooking?.transactions?.[0]?.BookId ||
                              "",
                          ).trim(),
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-disabled={bookingActionsLocked}
                        onClick={(e) => {
                          if (bookingActionsLocked) e.preventDefault();
                        }}
                        style={{
                          flex: "1 1 160px",
                          textAlign: "center",
                          background: OG,
                          color: "white",
                          padding: "10px 0",
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: 14,
                          textDecoration: "none",
                          display: "block",
                          pointerEvents: bookingActionsLocked ? "none" : "auto",
                          opacity: bookingActionsLocked ? 0.55 : 1,
                          cursor: bookingActionsLocked ? "not-allowed" : "pointer",
                        }}
                      >
                        📄 Download / Print Ticket
                      </a>

                      {showConfirmedActions && (
                        <>
                      <button
                        onClick={fetchCancellationCharges}
                        disabled={cancelChargesLoading || allTicketsCancelled}
                        style={{
                          flex: "1 1 160px",
                          textAlign: "center",
                          background: "white",
                          color: allTicketsCancelled ? "#9ca3af" : OG,
                          padding: "10px 0",
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: 14,
                          border: `1.5px solid ${allTicketsCancelled ? "#e5e7eb" : OG}`,
                          cursor:
                            cancelChargesLoading || allTicketsCancelled
                              ? "not-allowed"
                              : "pointer",
                          opacity: allTicketsCancelled ? 0.55 : 1,
                        }}
                      >
                        {cancelChargesLoading ? "Checking cancellation charges..." : "Get Cancellation Charges"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          cancelModalOpening ||
                          cancelModalOpen ||
                          allTicketsCancelled
                        }
                        onClick={() => {
                          (async () => {
                            setCancelModalOpening(true);
                            try {
                              setCancelFormLockedAfterSubmit(false);
                              setCancelMode("full");
                              setCancelRemarks("Test remarks");
                              setCancelSelectedTicketIds(getTicketIdsFromBookings());
                              setCancelSubmitResult(null);
                              setCancelSubmitError("");
                              setCancelOtpStatus("idle");
                              setCancelOtpMessage("");
                              const ok = await requestCancelOtp();
                              if (ok) setCancelModalOpen(true);
                            } finally {
                              setCancelModalOpening(false);
                            }
                          })();
                        }}
                        style={{
                          flex: "1 1 160px",
                          textAlign: "center",
                          background: allTicketsCancelled ? "#f9fafb" : "#fff7ed",
                          color: allTicketsCancelled ? "#9ca3af" : "#b45309",
                          padding: "10px 0",
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 14,
                          border: allTicketsCancelled
                            ? "1px solid #e5e7eb"
                            : "1px solid #fdba74",
                          cursor:
                            cancelModalOpening ||
                            cancelModalOpen ||
                            allTicketsCancelled
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            allTicketsCancelled ||
                            cancelModalOpening ||
                            cancelModalOpen
                              ? 0.65
                              : 1,
                        }}
                      >
                        {cancelModalOpening ? "Sending OTP…" : "Cancel Ticket"}
                      </button>
                        </>
                      )}

                      {showPendingPnrActions && (
                        <>
                          <button
                            type="button"
                            disabled={bookingActionsLocked || releasePnrSucceeded}
                            onClick={() => void callReleasePnr()}
                            style={{
                              flex: "1 1 160px",
                              textAlign: "center",
                              background:
                                bookingActionsLocked || releasePnrSucceeded ? "#f3f4f6" : "#eff6ff",
                              color: releasePnrSucceeded ? "#9ca3af" : "#1d4ed8",
                              padding: "10px 0",
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 14,
                              border: `1px solid ${releasePnrSucceeded ? "#e5e7eb" : "#93c5fd"}`,
                              cursor:
                                bookingActionsLocked || releasePnrSucceeded
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                bookingActionsLocked || releasePnrSucceeded ? 0.55 : 1,
                            }}
                          >
                            {releasePnrLoading ? "Releasing…" : "Release PNR"}
                          </button>
                          <button
                            type="button"
                            disabled={bookingActionsLocked || releasePnrSucceeded}
                            onClick={() => void callGetTicketFromMyBookings()}
                            style={{
                              flex: "1 1 160px",
                              textAlign: "center",
                              background:
                                bookingActionsLocked || releasePnrSucceeded ? "#f9fafb" : "#f0fdf4",
                              color: releasePnrSucceeded ? "#9ca3af" : "#15803d",
                              padding: "10px 0",
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 14,
                              border: `1px solid ${releasePnrSucceeded ? "#e5e7eb" : "#86efac"}`,
                              cursor:
                                bookingActionsLocked || releasePnrSucceeded
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                bookingActionsLocked || releasePnrSucceeded ? 0.55 : 1,
                            }}
                            title="Complete ticketing for this booking"
                          >
                            {getTicketLoading ? "Generating e-ticket…" : "Generate E-Ticket"}
                          </button>
                        </>
                      )}
                    </div>
                      );
                    })()}

                    {(releasePnrMessage || releasePnrError || getTicketError) && (
                      <div
                        style={{
                          marginTop: 8,
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: 12,
                          background:
                            releasePnrMessage && !releasePnrError && !getTicketError
                              ? "#f0fdf4"
                              : "#fef2f2",
                          fontSize: 12,
                        }}
                      >
                        {releasePnrMessage && (
                          <div style={{ color: "#166534", fontWeight: 600 }}>{releasePnrMessage}</div>
                        )}
                        {releasePnrError && <div style={{ color: "#b91c1c" }}>{releasePnrError}</div>}
                        {getTicketError && (
                          <div style={{ color: "#b91c1c", whiteSpace: "pre-line" }}>{getTicketError}</div>
                        )}
                      </div>
                    )}

                    {(cancelCharges || cancelChargesError) && (
                      <div
                        style={{
                          marginTop: 8,
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: 12,
                          background: cancelCharges ? "#f0fdf4" : "#fef2f2",
                          fontSize: 12,
                        }}
                      >
                        <b style={{ display: "block", marginBottom: 6 }}>
                          Cancellation Charges
                        </b>
                        {cancelCharges ? (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                              <span style={{ color: "#6b7280" }}>Refund Amount</span>
                              <span style={{ fontWeight: 600 }}>
                                {cancelCharges.Currency || "INR"} {Number(cancelCharges.RefundAmount || 0).toLocaleString()}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                              <span style={{ color: "#6b7280" }}>Cancellation Charge</span>
                              <span style={{ fontWeight: 600 }}>
                                {cancelCharges.Currency || "INR"} {Number(cancelCharges.CancellationCharge || 0).toLocaleString()}
                              </span>
                            </div>
                            {cancelCharges.Remarks && (
                              <div style={{ marginTop: 6, color: "#166534" }}>
                                {String(cancelCharges.Remarks)}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ color: "#b91c1c" }}>{cancelChargesError}</div>
                        )}
                      </div>
                    )}

                    {cancelModalOpen && (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                        role="dialog"
                        aria-modal="true"
                      >
                        <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200">
                          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                            <div style={{ fontWeight: 800, color: "#111827" }}>Cancel Ticket</div>
                            <button
                              type="button"
                              disabled={cancelFormLockedAfterSubmit}
                              onClick={() => {
                                setCancelModalOpen(false);
                                setCancelFormLockedAfterSubmit(false);
                                setCancelOtp("");
                                setCancelOtpStatus("idle");
                                setCancelOtpMessage("");
                              }}
                              style={{
                                border: "none",
                                background: "none",
                                cursor: cancelFormLockedAfterSubmit ? "not-allowed" : "pointer",
                                fontSize: 16,
                                color: "#6b7280",
                                opacity: cancelFormLockedAfterSubmit ? 0.45 : 1,
                              }}
                              aria-label="Close"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="p-4" style={{ fontSize: 12 }}>
                            <div style={{ marginBottom: 10 }}>
                              {cancelOtpMessage && (
                                <div
                                  style={{
                                    marginBottom: 8,
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    background: cancelOtpStatus === "error" ? "#fef2f2" : "#f0fdf4",
                                    border: `1px solid ${cancelOtpStatus === "error" ? "#fecaca" : "#bbf7d0"}`,
                                    color: cancelOtpStatus === "error" ? "#b91c1c" : "#166534",
                                  }}
                                >
                                  {cancelOtpMessage}
                                </div>
                              )}

                              <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Enter OTP</div>
                                  <input
                                    value={cancelOtp}
                                    onChange={(e) => setCancelOtp(e.target.value)}
                                    placeholder="Enter OTP"
                                    inputMode="numeric"
                                    disabled={cancelFormLockedAfterSubmit}
                                    style={{
                                      width: "100%",
                                      padding: "10px 12px",
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 10,
                                      outline: "none",
                                      opacity: cancelFormLockedAfterSubmit ? 0.65 : 1,
                                    }}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={requestCancelOtp}
                                  disabled={cancelOtpStatus === "sending" || cancelFormLockedAfterSubmit}
                                  style={{
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "1px solid #e5e7eb",
                                    background: "white",
                                    cursor:
                                      cancelOtpStatus === "sending" || cancelFormLockedAfterSubmit
                                        ? "not-allowed"
                                        : "pointer",
                                    fontWeight: 700,
                                    opacity: cancelFormLockedAfterSubmit ? 0.65 : 1,
                                  }}
                                >
                                  {cancelOtpStatus === "sending" ? "Sending..." : "Resend OTP"}
                                </button>
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  opacity: cancelFormLockedAfterSubmit ? 0.65 : 1,
                                }}
                              >
                                <input
                                  type="radio"
                                  name="cancelMode"
                                  checked={cancelMode === "full"}
                                  disabled={cancelFormLockedAfterSubmit}
                                  onChange={() => setCancelMode("full")}
                                />
                                Full Cancellation
                              </label>
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  opacity: cancelFormLockedAfterSubmit ? 0.65 : 1,
                                }}
                              >
                                <input
                                  type="radio"
                                  name="cancelMode"
                                  checked={cancelMode === "partial"}
                                  disabled={cancelFormLockedAfterSubmit}
                                  onChange={() => setCancelMode("partial")}
                                />
                                Partial Cancellation
                              </label>
                            </div>

                            {cancelMode === "partial" && (
                              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                                <div style={{ fontWeight: 700, marginBottom: 6 }}>Select Ticket ID(s)</div>
                                {(() => {
                                  const rows = getTicketRowsForPartialCancel();
                                  if (rows.length === 0) {
                                    return <div style={{ color: "#b91c1c" }}>Ticket IDs not found for this booking.</div>;
                                  }
                                  return (
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                                      {rows.map((row, ri) => (
                                        <label
                                          key={`${row.ticketId}-${ri}`}
                                          style={{
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: 8,
                                            cursor:
                                              cancelFormLockedAfterSubmit || row.alreadyCancelled
                                                ? "default"
                                                : "pointer",
                                            opacity: cancelFormLockedAfterSubmit || row.alreadyCancelled ? 0.65 : 1,
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            style={{ marginTop: 3 }}
                                            disabled={cancelFormLockedAfterSubmit || row.alreadyCancelled}
                                            checked={
                                              !row.alreadyCancelled && cancelSelectedTicketIds.includes(row.ticketId)
                                            }
                                            onChange={(e) => {
                                              if (row.alreadyCancelled) return;
                                              const id = row.ticketId;
                                              setCancelSelectedTicketIds((prev) =>
                                                e.target.checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id),
                                              );
                                            }}
                                          />
                                          <span style={{ fontSize: 12, lineHeight: 1.35 }}>
                                            <span style={{ fontWeight: 700, color: "#111827" }}>{row.name}</span>
                                            <span style={{ display: "block", fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                                              Ticket ID: {row.ticketId}
                                              {row.alreadyCancelled && (
                                                <span
                                                  style={{
                                                    display: "inline-block",
                                                    marginLeft: 8,
                                                    fontWeight: 700,
                                                    color: "#b91c1c",
                                                  }}
                                                >
                                                  (already cancelled)
                                                </span>
                                              )}
                                            </span>
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontWeight: 700, marginBottom: 6 }}>Remarks</div>
                              <input
                                value={cancelRemarks}
                                onChange={(e) => setCancelRemarks(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                                placeholder="Remarks"
                                disabled={cancelFormLockedAfterSubmit}
                                style={{ opacity: cancelFormLockedAfterSubmit ? 0.65 : 1 }}
                              />
                            </div>

                            {(cancelSubmitResult || cancelSubmitError) && (
                              <div
                                style={{
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 8,
                                  padding: 10,
                                  background: cancelSubmitResult ? "#f0fdf4" : "#fef2f2",
                                  marginBottom: 10,
                                }}
                              >
                                {cancelSubmitResult ? (
                                  <div style={{ color: "#166534" }}>
                                    <div>
                                      Request submitted successfully. TraceId:{" "}
                                      {cancelSubmitResult.TraceId || "—"}
                                    </div>
                                    {canceledVerifiedByAppRef[String(selectedBooking?.appReference || "")] && (
                                      <div style={{ marginTop: 6, fontWeight: 700 }}>
                                        Ticket status: Canceled
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ color: "#b91c1c" }}>{cancelSubmitError}</div>
                                )}
                              </div>
                            )}

                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelModalOpen(false);
                                  setCancelFormLockedAfterSubmit(false);
                                  setCancelOtp("");
                                  setCancelOtpStatus("idle");
                                  setCancelOtpMessage("");
                                }}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  border: "1px solid #e5e7eb",
                                  background: "white",
                                  cursor: "pointer",
                                }}
                              >
                                Close
                              </button>
                              <button
                                type="button"
                                onClick={submitCancelRequest}
                                disabled={cancelSubmitting || cancelFormLockedAfterSubmit}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  border: "none",
                                  background: OG,
                                  color: "white",
                                  fontWeight: 700,
                                  cursor: cancelSubmitting || cancelFormLockedAfterSubmit ? "not-allowed" : "pointer",
                                  opacity: cancelSubmitting || cancelFormLockedAfterSubmit ? 0.65 : 1,
                                }}
                              >
                                {cancelFormLockedAfterSubmit
                                  ? "Submitted"
                                  : cancelSubmitting
                                    ? "Submitting..."
                                    : "Submit Cancellation"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : loadingBookings ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 40,
                      color: "#9ca3af",
                    }}
                  >
                    Loading bookings...
                  </div>
                ) : bookings.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🎫</div>
                    <p
                      style={{
                        color: "#9ca3af",
                        fontSize: 13,
                        marginBottom: 12,
                      }}
                    >
                      No bookings found.
                    </p>
                    <button
                      onClick={onBack}
                      style={{
                        background: OG,
                        color: "white",
                        padding: "8px 20px",
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Book a Flight
                    </button>
                  </div>
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {bookings.map((b: any, i: number) => {
                      const rowKey = myBookingRowKey(b, i);
                      const isSendingViewOtp = viewOtpSendingKey === rowKey;
                      return (
                      <div
                        key={rowKey}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: "10px 12px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                              marginBottom: 2,
                            }}
                          >
                            <b style={{ fontSize: 13 }}>
                              {b.pnr ? `PNR: ${b.pnr}` : "PNR: —"}
                            </b>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(b.status)}`}
                            >
                              {b.status}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: "#374151",
                            }}
                          >
                            {b.fromLoc}{" "}
                            {isMyBookingRoundtrip(b) ? "↔" : "→"}{" "}
                            {b.toLoc}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#6b7280",
                              marginTop: 4,
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "4px 14px",
                              lineHeight: 1.4,
                            }}
                          >
                            <span>
                              <span style={{ color: "#9ca3af" }}>Passengers</span>{" "}
                              <span style={{ fontWeight: 600, color: "#374151" }}>
                                {b.passengerCount ?? b.passengers?.length ?? 0}
                              </span>
                            </span>
                            <span>
                              <span style={{ color: "#9ca3af" }}>Cabin</span>{" "}
                              <span style={{ fontWeight: 600, color: "#374151" }}>{b.cabinClass}</span>
                            </span>
                            <span>
                              <span style={{ color: "#9ca3af" }}>Travel date</span>{" "}
                              <span style={{ fontWeight: 600, color: "#374151" }}>
                                {b.journeyStart
                                  ? formatUserDate(b.journeyStart)
                                  : "—"}
                              </span>
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isSendingViewOtp || viewOtpModalOpen}
                          onClick={() => void handleViewBookingClick(b, rowKey)}
                          style={{
                            color: OG,
                            background: "none",
                            border: "none",
                            cursor:
                              isSendingViewOtp || viewOtpModalOpen ? "not-allowed" : "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            marginLeft: 10,
                            opacity: isSendingViewOtp || viewOtpModalOpen ? 0.65 : 1,
                          }}
                        >
                          {isSendingViewOtp ? "Sending OTP…" : "View →"}
                        </button>
                      </div>
                    );
                    })}
                  </div>
                )}

                {viewOtpModalOpen && viewOtpTarget && (
                  <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    style={{ background: "rgba(0,0,0,0.45)" }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="view-booking-otp-title"
                  >
                    <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div id="view-booking-otp-title" style={{ fontWeight: 800, color: "#111827" }}>
                          Verify to view booking
                        </div>
                        <button
                          type="button"
                          disabled={viewOtpVerifying}
                          onClick={closeViewOtpModal}
                          style={{
                            border: "none",
                            background: "none",
                            cursor: viewOtpVerifying ? "not-allowed" : "pointer",
                            fontSize: 16,
                            color: "#6b7280",
                            opacity: viewOtpVerifying ? 0.45 : 1,
                          }}
                          aria-label="Close"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="p-4" style={{ fontSize: 12 }}>
                        <p style={{ color: "#4b5563", marginBottom: 10, lineHeight: 1.5 }}>
                          We sent a one-time password to{" "}
                          <span style={{ fontWeight: 600 }}>{String(user?.email || "").trim()}</span>.
                          Enter it below to open this booking.
                        </p>
                        {viewOtpTarget?.pnr && (
                          <p style={{ color: "#6b7280", marginBottom: 10, fontSize: 11 }}>
                            PNR: <span style={{ fontWeight: 600 }}>{viewOtpTarget.pnr}</span>
                          </p>
                        )}
                        {viewOtpMessage && (
                          <div
                            style={{
                              marginBottom: 10,
                              padding: "8px 10px",
                              borderRadius: 8,
                              background: viewOtpStatus === "error" ? "#fef2f2" : "#f0fdf4",
                              border: `1px solid ${viewOtpStatus === "error" ? "#fecaca" : "#bbf7d0"}`,
                              color: viewOtpStatus === "error" ? "#b91c1c" : "#166534",
                            }}
                          >
                            {viewOtpMessage}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, alignItems: "end", marginBottom: 14 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>Enter OTP</div>
                            <input
                              value={viewOtp}
                              onChange={(e) => setViewOtp(e.target.value)}
                              placeholder="Enter OTP from email"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              disabled={viewOtpVerifying}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void confirmViewBookingOtp();
                              }}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                border: "1px solid #e5e7eb",
                                borderRadius: 10,
                                outline: "none",
                                opacity: viewOtpVerifying ? 0.65 : 1,
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void requestViewBookingOtp()}
                            disabled={viewOtpStatus === "sending" || viewOtpVerifying}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 10,
                              border: "1px solid #e5e7eb",
                              background: "white",
                              cursor:
                                viewOtpStatus === "sending" || viewOtpVerifying
                                  ? "not-allowed"
                                  : "pointer",
                              fontWeight: 700,
                              opacity: viewOtpVerifying ? 0.65 : 1,
                            }}
                          >
                            {viewOtpStatus === "sending" ? "Sending…" : "Resend OTP"}
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={closeViewOtpModal}
                            disabled={viewOtpVerifying}
                            style={{
                              padding: "10px 16px",
                              borderRadius: 10,
                              border: "1px solid #e5e7eb",
                              background: "white",
                              fontWeight: 600,
                              cursor: viewOtpVerifying ? "not-allowed" : "pointer",
                              opacity: viewOtpVerifying ? 0.65 : 1,
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void confirmViewBookingOtp()}
                            disabled={viewOtpVerifying || !viewOtp.trim()}
                            style={{
                              padding: "10px 16px",
                              borderRadius: 10,
                              border: "none",
                              background: OG,
                              color: "white",
                              fontWeight: 700,
                              cursor:
                                viewOtpVerifying || !viewOtp.trim() ? "not-allowed" : "pointer",
                              opacity: viewOtpVerifying || !viewOtp.trim() ? 0.65 : 1,
                            }}
                          >
                            {viewOtpVerifying ? "Verifying…" : "Continue"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* FAMILY MEMBERS */}
            {activeTab === "family" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <h2 style={{ fontSize: 17, fontWeight: 700 }}>Family Members</h2>
                  <button
                    onClick={() => setShowAddFamily(!showAddFamily)}
                    style={{
                      background: OG,
                      color: "white",
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {showAddFamily ? "Cancel" : "+ Add Member"}
                  </button>
                </div>

                {message && (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: "8px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      background: message.includes("success")
                        ? "#dcfce7"
                        : "#fee2e2",
                      color: message.includes("success")
                        ? "#15803d"
                        : "#dc2626",
                    }}
                  >
                    {message}
                  </div>
                )}

                {showAddFamily && (
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 16,
                      background: "#f9fafb",
                    }}
                  >
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                      Add New Family Member
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>
                          First Name *
                        </label>
                        <input
                          type="text"
                          value={newMember.firstName}
                          onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })}
                          style={{
                            width: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            padding: "8px 10px",
                            fontSize: 13,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>
                          Last Name *
                        </label>
                        <input
                          type="text"
                          value={newMember.lastName}
                          onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })}
                          style={{
                            width: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            padding: "8px 10px",
                            fontSize: 13,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>
                          Date of Birth *
                        </label>
                        <input
                          type="date"
                          lang={inputLang}
                          required
                          value={newMember.dateOfBirth || ""}
                          onChange={(e) => setNewMember({ ...newMember, dateOfBirth: e.target.value || null })}
                          style={{
                            width: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            padding: "8px 10px",
                            fontSize: 13,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>
                          Passport Number
                        </label>
                        <input
                          type="text"
                          value={newMember.passportNumber || ""}
                          onChange={(e) => setNewMember({ ...newMember, passportNumber: e.target.value || null })}
                          style={{
                            width: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            padding: "8px 10px",
                            fontSize: 13,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>
                          Passport Nationality
                        </label>
                        <input
                          type="text"
                          value={newMember.passportNationality || ""}
                          onChange={(e) => setNewMember({ ...newMember, passportNationality: e.target.value })}
                          placeholder="e.g., Indian, American"
                          style={{
                            width: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            padding: "8px 10px",
                            fontSize: 13,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>
                          Passport Issuing Country
                        </label>
                        <select
                          value={newMember.PassportIssueCountryCode || "IN"}
                          onChange={(e) =>
                            setNewMember({
                              ...newMember,
                              PassportIssueCountryCode: e.target.value || "IN",
                            })
                          }
                          style={{
                            width: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            padding: "8px 10px",
                            fontSize: 13,
                            background: "white",
                          }}
                        >
                          {countryList.length === 0 && <option value="IN">India (IN)</option>}
                          {countryList.map((c) => (
                            <option key={c.isoCountryCode} value={c.isoCountryCode}>
                              {c.countryName} ({c.isoCountryCode})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>
                            Passport Issue Date
                          </label>
                          <input
                            type="date"
                          lang={inputLang}
                            value={newMember.passportIssueDate || ""}
                            onChange={(e) =>
                              setNewMember({
                                ...newMember,
                                passportIssueDate: e.target.value || null,
                              })
                            }
                            style={{
                              width: "100%",
                              border: "1px solid #d1d5db",
                              borderRadius: 6,
                              padding: "8px 10px",
                              fontSize: 13,
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>
                            Passport Expiry Date
                          </label>
                          <input
                            type="date"
                          lang={inputLang}
                            value={
                              newMember.passportExpiryYear &&
                              newMember.passportExpiryMonth &&
                              newMember.passportExpiryDay
                                ? `${String(newMember.passportExpiryYear).padStart(4, "0")}-${String(
                                    newMember.passportExpiryMonth,
                                  ).padStart(2, "0")}-${String(newMember.passportExpiryDay).padStart(2, "0")}`
                                : ""
                            }
                            onChange={(e) => {
                              const v = e.target.value || "";
                              if (!v) {
                                setNewMember({
                                  ...newMember,
                                  passportExpiryDay: null,
                                  passportExpiryMonth: null,
                                  passportExpiryYear: null,
                                });
                                return;
                              }
                              const [yy, mm, dd] = v.split("-");
                              setNewMember({
                                ...newMember,
                                passportExpiryYear: yy || null,
                                passportExpiryMonth: mm || null,
                                passportExpiryDay: dd || null,
                              });
                            }}
                            style={{
                              width: "100%",
                              border: "1px solid #d1d5db",
                              borderRadius: 6,
                              padding: "8px 10px",
                              fontSize: 13,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleAddFamilyMember}
                      style={{
                        background: OG,
                        color: "white",
                        padding: "8px 16px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Save Member
                    </button>
                  </div>
                )}

                {loadingFamily ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 40,
                      color: "#9ca3af",
                    }}
                  >
                    Loading family members...
                  </div>
                ) : familyMembers.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>👨‍👩‍👧‍👦</div>
                    <p
                      style={{
                        color: "#9ca3af",
                        fontSize: 13,
                        marginBottom: 12,
                      }}
                    >
                      No family members saved yet.
                    </p>
                    <button
                      onClick={() => setShowAddFamily(true)}
                      style={{
                        background: OG,
                        color: "white",
                        padding: "8px 20px",
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Add First Member
                    </button>
                  </div>
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {familyMembers.map((member: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: "12px 14px",
                          background: "white",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {member.firstName} {member.lastName}
                          </div>
                          <button
                            type="button"
                            onClick={() => startEditFamilyMember(member, i)}
                            style={{
                              fontSize: 12,
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: `1px solid ${OG}`,
                              background: "white",
                              color: OG,
                              cursor: "pointer",
                              fontWeight: 700,
                            }}
                          >
                            Update
                          </button>
                        </div>

                        {editingFamilyRowIndex === i ? (
                          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#f9fafb" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                                  First Name
                                </label>
                                <input
                                  value={familyEdit.firstName}
                                  onChange={(e) => setFamilyEdit((p) => ({ ...p, firstName: e.target.value }))}
                                  style={{
                                    width: "100%",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 13,
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                                  Last Name
                                </label>
                                <input
                                  value={familyEdit.lastName}
                                  onChange={(e) => setFamilyEdit((p) => ({ ...p, lastName: e.target.value }))}
                                  style={{
                                    width: "100%",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 13,
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                                  Date of Birth *
                                </label>
                                <input
                                  type="date"
                                  lang={inputLang}
                                  required
                                  value={familyEdit.dateOfBirth}
                                  onChange={(e) => setFamilyEdit((p) => ({ ...p, dateOfBirth: e.target.value }))}
                                  style={{
                                    width: "100%",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 13,
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                                  Email
                                </label>
                                <input
                                  value={familyEdit.email}
                                  onChange={(e) => setFamilyEdit((p) => ({ ...p, email: e.target.value }))}
                                  style={{
                                    width: "100%",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 13,
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                                  Passport Number
                                </label>
                                <input
                                  value={familyEdit.passportNumber}
                                  onChange={(e) => setFamilyEdit((p) => ({ ...p, passportNumber: e.target.value }))}
                                  style={{
                                    width: "100%",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 13,
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                                  Passport Nationality
                                </label>
                                <input
                                  value={familyEdit.passportNationality}
                                  onChange={(e) => setFamilyEdit((p) => ({ ...p, passportNationality: e.target.value }))}
                                  style={{
                                    width: "100%",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 13,
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                                  Passport Issuing Country
                                </label>
                                <select
                                  value={familyEdit.PassportIssueCountryCode || "IN"}
                                  onChange={(e) =>
                                    setFamilyEdit((p) => ({
                                      ...p,
                                      PassportIssueCountryCode: e.target.value || "IN",
                                    }))
                                  }
                                  style={{
                                    width: "100%",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 13,
                                    background: "white",
                                  }}
                                >
                                  {countryList.length === 0 && <option value="IN">India (IN)</option>}
                                  {countryList.map((c) => (
                                    <option key={c.isoCountryCode} value={c.isoCountryCode}>
                                      {c.countryName} ({c.isoCountryCode})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                                  Passport User Name
                                </label>
                                <input
                                  value={familyEdit.passportUserName}
                                  onChange={(e) => setFamilyEdit((p) => ({ ...p, passportUserName: e.target.value }))}
                                  style={{
                                    width: "100%",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 13,
                                  }}
                                />
                              </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                                  Passport Issue Date
                                </label>
                                <input
                                  type="date"
                          lang={inputLang}
                                  value={familyEdit.passportIssueDate}
                                  onChange={(e) => setFamilyEdit((p) => ({ ...p, passportIssueDate: e.target.value }))}
                                  style={{
                                    width: "100%",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 13,
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                                  Passport Expiry Date
                                </label>
                                <input
                                  type="date"
                          lang={inputLang}
                                  value={familyEdit.passportExpiryDate}
                                  onChange={(e) => setFamilyEdit((p) => ({ ...p, passportExpiryDate: e.target.value }))}
                                  style={{
                                    width: "100%",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 13,
                                  }}
                                />
                              </div>
                            </div>

                            {familyUpdateError && (
                              <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>{familyUpdateError}</div>
                            )}

                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                              <button
                                type="button"
                                onClick={cancelEditFamilyMember}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  border: "1px solid #e5e7eb",
                                  background: "white",
                                  cursor: "pointer",
                                  fontWeight: 700,
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={saveEditFamilyMember}
                                disabled={familyUpdateLoading}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  border: "none",
                                  background: OG,
                                  color: "white",
                                  cursor: familyUpdateLoading ? "not-allowed" : "pointer",
                                  fontWeight: 800,
                                  opacity: familyUpdateLoading ? 0.7 : 1,
                                }}
                              >
                                {familyUpdateLoading ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, color: "#6b7280" }}>
                            {member.dateOfBirth && (
                              <div>
                                <span style={{ fontWeight: 600 }}>DOB:</span>{" "}
                                {(() => {
                                  const iso = toDateOnlyIso(member.dateOfBirth);
                                  const [yy, mm, dd] = iso ? iso.split("-") : ["", "", ""];
                                  return iso ? `${mm}/${dd}/${yy}` : "";
                                })()}
                              </div>
                            )}
                            {member.passportNumber && (
                              <div>
                                <span style={{ fontWeight: 600 }}>Passport:</span> {member.passportNumber}
                              </div>
                            )}
                            {member.passportNationality && (
                              <div>
                                <span style={{ fontWeight: 600 }}>Nationality:</span> {member.passportNationality}
                              </div>
                            )}
                            {readPassportIssuingCountry(member) && (
                              <div>
                                <span style={{ fontWeight: 600 }}>Issuing Country:</span>{" "}
                                {readPassportIssuingCountry(member)}
                              </div>
                            )}
                            {(member.passportExpiryDay || member.passportExpiryMonth || member.passportExpiryYear) && (
                              <div>
                                <span style={{ fontWeight: 600 }}>Passport Expiry:</span>{" "}
                                {member.passportExpiryDay}/{member.passportExpiryMonth}/{member.passportExpiryYear}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* end booking panel */}

          {/* ── FILTER PANEL rendered right here ── */}
          {/* {filterPanel} */}
        </div>
        {/* end content area */}
      </div>
    </div>
  );
}
