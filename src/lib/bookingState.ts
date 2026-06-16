// Typed sessionStorage helpers for passing booking state between route pages.

import type { FlightSearchRequest } from "./api";

export const SEARCH_STATE_KEY = "v_search_state";
export const SELECTED_FLIGHT_KEY = "v_selected_flight";
export const PAYMENT_DATA_KEY = "v_payment_data";
export const TICKET_DATA_KEY = "v_ticket_data";
export const HOTEL_SEARCH_KEY = "v_hotel_search";
export const PENDING_BOOKING_KEY = "vivance_pending_booking";
/** sessionStorage: My Bookings → Get Ticket, HDFC redirect return (consumed on `/flights/payment?hdfc_return=1`). */
export const HDFC_PENDING_MY_BOOKINGS_GET_TICKET_KEY = "hdfc_pending_my_bookings_get_ticket";
/** sessionStorage: user dismissed “resume pending booking” strip on home this tab session */
export const PENDING_BOOKING_HOME_BANNER_DISMISSED_KEY = "vivance_pending_home_banner_dismissed";

export interface FlightSearchMeta {
  request: FlightSearchRequest;
  searchApi: "search" | "advance";
}

export interface SearchState {
  results: any;
  passengers: {
    adults: number;
    children: number;
    infants: number;
    cabinClass?: string;
    departureDate?: string;
    returnDate?: string;
    origin?: string;
    destination?: string;
    multiCityLegs?: Array<{ origin: string; destination: string; date: string }>;
  };
  domainToken: string;
  tripType: string;
  /** Present for standard + advance flight search — used for ±1 day re-search on results page. */
  lastSearchMeta?: FlightSearchMeta;
}

export interface SelectedFlightState {
  flight: any;
  bookingTimeRemaining: number;
  holdBooking?: boolean;
  /** Amount to collect for hold flow (from hold-fee API), mirrored on `flight` for payment UI. */
  holdFeeInr?: number | null;
}

import type { LeadPassengerAddress } from "@/lib/leadPassengerAddress";

export interface PaymentDataState {
  passengerDetails: any[];
  guestEmail: string;
  guestMobile: string;
  /** Mobile dial code, e.g. "+91" for India. */
  cellCountryCode: string;
  discount: number;
  promoCode: string;
  /** Server-issued token from POST /api/coupons/validate — required for redeem at payment. */
  appliedToken?: string;
  /** Agent markup applied to base fare (from POST /api/markup/quote). */
  markupAmount?: number;
  markupRuleId?: number | null;
  /** Base fare before markup — for audit/display on payment. */
  fareBeforeMarkup?: number;
  /** LCC — configured default address, sent on lead passenger in commit-booking. */
  leadPassengerAddress?: LeadPassengerAddress;
}

export interface TicketDataState {
  ticketDetails: any;
  pnr: string;
  appReference: string;
  domainToken: string;
}

export interface HotelSearchState {
  results: any[];
  params: any;
}

function safeGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const bookingState = {
  saveSearch: (state: SearchState) => safeSet(SEARCH_STATE_KEY, state),
  getSearch: (): SearchState | null => safeGet<SearchState>(SEARCH_STATE_KEY),

  saveFlight: (state: SelectedFlightState) => safeSet(SELECTED_FLIGHT_KEY, state),
  getFlight: (): SelectedFlightState | null => safeGet<SelectedFlightState>(SELECTED_FLIGHT_KEY),

  savePayment: (state: PaymentDataState) => safeSet(PAYMENT_DATA_KEY, state),
  getPayment: (): PaymentDataState | null => safeGet<PaymentDataState>(PAYMENT_DATA_KEY),

  saveTicket: (state: TicketDataState) => safeSet(TICKET_DATA_KEY, state),
  getTicket: (): TicketDataState | null => safeGet<TicketDataState>(TICKET_DATA_KEY),

  saveHotelSearch: (state: HotelSearchState) => safeSet(HOTEL_SEARCH_KEY, state),
  getHotelSearch: (): HotelSearchState | null => safeGet<HotelSearchState>(HOTEL_SEARCH_KEY),
};
