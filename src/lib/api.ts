import { USER_TYPES, USER_STATUS } from '@/constants';
import {
  getFlightDomainTokenCached,
  forceRefreshFlightDomainToken,
  rememberFlightAccessToken,
} from "@/lib/flightAuth";
import { isFlightHoldFeatureEnabled } from "@/lib/flightHoldConfig";

/**
 * vivapi-mt often returns HTTP 200 with JSON like Status 4 / "Invalid Token" instead of HTTP 401.
 */
function isVivapiMtInvalidOrExpiredTokenBody(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  const topStatus = Number(o.Status ?? o.status);
  const topErrorCode = String(o.ErrorCode ?? o.errorCode ?? "").toUpperCase();
  const topErrorDesc = String(o.ErrorDesc ?? o.errorDesc ?? "").toLowerCase();
  const topMsg = String(o.Message ?? o.message ?? "").toLowerCase();
  if (topErrorCode === "TOKEN_EXPIRED") return true;
  if ((topMsg.includes("token") || topErrorDesc.includes("token")) && (topMsg.includes("expired") || topErrorDesc.includes("expired"))) {
    return true;
  }
  if (topStatus === 4 && topMsg.includes("token")) return true;

  const resp = o.Response ?? o.response;
  if (!resp || typeof resp !== "object") return false;
  const r = resp as Record<string, unknown>;
  const innerStatus = Number(r.ResponseStatus ?? r.responseStatus);
  const err = r.Error ?? r.error;
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  const errCode = Number(e.ErrorCode ?? e.errorCode);
  const errMsg = String(e.ErrorMessage ?? e.errorMessage ?? "").toLowerCase();
  if (errCode === 6) return true;
  if (Number.isFinite(innerStatus) && innerStatus === 4 && errMsg.includes("token")) return true;
  return false;
}

/**
 * Retries after `forceRefreshFlightDomainToken()` when:
 * - HTTP 401 from the Next route / upstream, or
 * - HTTP 200 JSON body indicates vivapi-mt invalid/expired token (e.g. Status 4, ErrorCode 6).
 */
async function withFlightTokenRetry(
  doFetch: (token: string) => Promise<Response>,
  token: string,
  label: string,
): Promise<Response> {
  const maxAttempts = 3;
  let attempt = 0;
  let currentToken = token;

  while (attempt < maxAttempts) {
    attempt++;
    const response = await doFetch(currentToken);

    if (response.status === 401) {
      console.warn(`[${label}] HTTP 401 — refreshing flight domain token and retrying`);
      if (attempt >= maxAttempts) return response;
      currentToken = await forceRefreshFlightDomainToken();
      continue;
    }

    if (response.ok) {
      try {
        const data: unknown = await response.clone().json();
        if (isVivapiMtInvalidOrExpiredTokenBody(data)) {
          console.warn(
            `[${label}] vivapi-mt invalid/expired token in JSON body — calling refresh-token then retrying`,
          );
          if (attempt >= maxAttempts) return response;
          currentToken = await forceRefreshFlightDomainToken();
          continue;
        }
      } catch {
        // not JSON — return as-is
      }
    }

    return response;
  }

  throw new Error(`[${label}] withFlightTokenRetry: exhausted attempts`);
}

export interface SignUpData {
  email: string;
  userName: string;
  password: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  phone?: string;
  /** Optional profile / address fields (forwarded to user create API when present). */
  title?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface SignInData {
  userName: string;
  password: string;
}

export interface ResetPasswordData {
  userName: string;
  password: string;
}

export interface PassengerData {
  userId: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  email: string | null;
  passportUserName: string | null;
  passportNationality: number;
  passportExpiryDay: string | null;
  passportExpiryMonth: string | null;
  passportExpiryYear: string | null;
  passportNumber: string | null;
  PassportIssueCountryCode: string | null;
}

export interface Airport {
  airportCode: string;
  airportName: string;
  cityName: string;
  countryName: string;
}

export interface FlightSearchRequest {
  AdultCount: string;
  ChildCount: string;
  InfantCount: string;
  JourneyType: string;
  PreferredAirlines: string[];
  CabinClass: string;
  ResultFareType: string;
  Sources?: string[];
  Segments: {
    Origin: string;
    Destination: string;
    DepartureDate: string;
  }[];
}

export interface CalendarFareRequest {
  JourneyType: number;
  PreferredAirlines: null;
  Sources: string[] | null;
  Segments: {
    Origin: string;
    Destination: string;
    FlightCabinClass: number;
    PreferredDepartureTime: string;
  }[];
}

export const flightAPI = {
  getAirports: async (token?: string): Promise<Airport[]> => {
    try {
      const effectiveToken = token || await flightAPI.getDomainToken();
      const response = await fetch('/api/airports', {
        headers: {
          'Authorization': `Bearer ${effectiveToken}`
        }
      });
      const result = await response.json();
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Airport API Error:', error);
      return [];
    }
  },

  searchAirports: async (query: string, limit = 10, token?: string): Promise<Airport[]> => {
    try {
      const q = (query || "").trim();
      if (q.length < 2) return [];
      const effectiveToken = token || await flightAPI.getDomainToken();
      const response = await fetch(`/api/airports?query=${encodeURIComponent(q)}&limit=${encodeURIComponent(String(limit))}`, {
        headers: {
          'Authorization': `Bearer ${effectiveToken}`
        }
      });
      const result = await response.json();
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Airport Search API Error:', error);
      return [];
    }
  },

  getDomainToken: async () => {
    try {
      return await getFlightDomainTokenCached();
    } catch (error) {
      console.error('Domain Token Error:', error);
      throw error;
    }
  },

  searchFlights: async (searchData: FlightSearchRequest, token: string) => {
    try {
      const doFetch = (t: string) =>
        fetch('/api/flight/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: t, ...searchData }),
        });

      let response = await withFlightTokenRetry(doFetch, token, 'searchFlights');

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Flight Search Error:', error);
      throw error;
    }
  },

  priceAdvancedFlight: async (resultToken: string, fareClass: string, token: string, adults = 1, children = 0, infants = 0) => {
    console.log('[priceAdvancedFlight] called with:', {
      resultToken: resultToken?.substring?.(0, 80),
      fareClass,
      tokenPresent: !!token,
      adults,
      children,
      infants,
    });
    try {
      const doFetch = (t: string) =>
        fetch('/api/flight/adv-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: t, ResultToken: resultToken, FareClass: fareClass, AdultCount: adults, ChildCount: children, InfantCount: infants }),
        });
      const response = await withFlightTokenRetry(doFetch, token, 'priceAdvancedFlight');
      console.log('[priceAdvancedFlight] HTTP status:', response.status);
      if (!response.ok) {
        const errText = await response.text();
        console.error('[priceAdvancedFlight] Error body:', errText);
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }
      const data = await response.json();
      console.log('[priceAdvancedFlight] Response:', JSON.stringify(data, null, 2).substring(0, 1000));
      return data;
    } catch (error) {
      console.error('[priceAdvancedFlight] Exception:', error);
      throw error;
    }
  },

  searchAdvancedFlights: async (searchData: FlightSearchRequest, token: string) => {
    try {
      const doFetch = (t: string) =>
        fetch('/api/flight/pre-adv-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: t, ...searchData })
        });

      const response = await withFlightTokenRetry(doFetch, token, 'searchAdvancedFlights');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Advanced Flight Search Error:', error);
      throw error;
    }
  },

  getCalendarFare: async (searchData: CalendarFareRequest, token: string) => {
    try {
      const doFetch = (t: string) =>
        fetch('/api/flight/calendar-fare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: t, ...searchData }),
        });
      const response = await withFlightTokenRetry(doFetch, token, 'getCalendarFare');
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Calendar Fare Search Error:', error);
      throw error;
    }
  },

  getCalendarFareOfDay: async (searchData: CalendarFareRequest, token: string) => {
    try {
      const doFetch = (t: string) =>
        fetch('/api/flight/calendar-fare-day', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: t, ...searchData }),
        });
      const response = await withFlightTokenRetry(doFetch, token, 'getCalendarFareOfDay');
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Calendar Fare Of Day Error:', error);
      throw error;
    }
  },

  initiatePayment: async (
    resultToken: string,
    token: string,
    returnResultToken?: string,
    tripType?: string,
    obFare?: number,
    ibFare?: number,
    holdBooking?: boolean,
  ) => {
    try {
      let url = `/api/payment/order?resultToken=${encodeURIComponent(resultToken)}`;
      if (returnResultToken) {
        url += `&returnResultToken=${encodeURIComponent(returnResultToken)}`;
      }
      if (tripType) {
        url += `&tripType=${encodeURIComponent(tripType)}`;
      }
      if (obFare !== undefined) {
        url += `&obFare=${encodeURIComponent(String(obFare))}`;
      }
      if (ibFare !== undefined) {
        url += `&ibFare=${encodeURIComponent(String(ibFare))}`;
      }
      if (holdBooking && isFlightHoldFeatureEnabled()) {
        url += `&holdBooking=1`;
      }

      console.log('\n========== INITIATE PAYMENT (CLIENT) ==========');
      console.log('Timestamp:', new Date().toISOString());
      console.log('URL:', url);
      console.log('Params:', { resultToken: resultToken?.substring(0, 40) + '...', returnResultToken, tripType, obFare, ibFare, holdBooking });
      console.log('Headers:', { Authorization: `Bearer ${token?.substring(0, 15)}...${token?.slice(-5)}` });

      rememberFlightAccessToken(token);
      const doFetch = (t: string) =>
        fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${t}`,
          },
        });

      const response = await withFlightTokenRetry(doFetch, token, 'initiatePayment');

      console.log('Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errText = await response.text();
        let detail = errText;
        try {
          const j = JSON.parse(errText) as Record<string, unknown>;
          detail =
            String(j.Message ?? j.message ?? j.ErrorDesc ?? j.errorDesc ?? errText) || errText;
        } catch {
          /* keep raw */
        }
        throw new Error(`HTTP ${response.status}: ${detail}`);
      }

      const result = await response.json();
      console.log('Response Body:', JSON.stringify(result, null, 2).substring(0, 1000));
      console.log('================================================\n');
      return result;
    } catch (error) {
      console.error('Initiate Payment Error:', error);
      throw error;
    }
  },

  validatePayment: async (
    paymentData: {
      orderId: string;
      pgateway: string;
      payId?: string;
      signature?: string;
      resultToken?: string;
    },
    token: string,
  ) => {
    try {
      console.log('\n========== VALIDATE PAYMENT (CLIENT) ==========');
      console.log('Timestamp:', new Date().toISOString());
      console.log('URL:', '/api/payment/validate');
      console.log('Method:', 'POST');
      console.log('Headers:', { Authorization: `Bearer ${token?.substring(0, 15)}...${token?.slice(-5)}`, 'Content-Type': 'application/json' });
      console.log('Body:', JSON.stringify(paymentData, null, 2));

      rememberFlightAccessToken(token);
      const doFetch = (t: string) =>
        fetch('/api/payment/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${t}`,
          },
          body: JSON.stringify(paymentData),
        });

      const response = await withFlightTokenRetry(doFetch, token, 'validatePayment');

      console.log('Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errText = await response.text();
        let detail = errText;
        try {
          const j = JSON.parse(errText) as Record<string, unknown>;
          detail =
            String(j.Message ?? j.message ?? j.ErrorDesc ?? j.errorDesc ?? errText) || errText;
        } catch {
          /* keep raw */
        }
        throw new Error(`HTTP ${response.status}: ${detail}`);
      }

      const result = await response.json();
      console.log('Response Body:', JSON.stringify(result, null, 2).substring(0, 1000));
      console.log('================================================\n');
      return result;
    } catch (error) {
      console.error('Payment Validation Error:', error);
      throw error;
    }
  },

  saveExtraServices: async (
    resultToken: string,
    token: string,
    fees: { ExtraBaggageFee: number; ExtraMealFee: number; ExtraSeatFee: number; BasicFare?: number; Tax?: number }
  ) => {
    try {
      rememberFlightAccessToken(token);
      const doFetch = (t: string) =>
        fetch('/api/flight/extra-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ResultToken: resultToken, token: t, ...fees }),
        });

      const response = await withFlightTokenRetry(doFetch, token, 'saveExtraServices');

      if (!response.ok) {
        const errText = await response.text();
        let detail = errText;
        try {
          const j = JSON.parse(errText) as Record<string, unknown>;
          detail =
            String(
              j.Message ??
                j.message ??
                j.ErrorDesc ??
                j.errorDesc ??
                j.ErrorCode ??
                j.errorCode ??
                errText,
            ) || errText;
        } catch {
          /* keep raw */
        }
        throw new Error(`HTTP ${response.status}: ${detail}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Extra Services Error:', error);
      throw error;
    }
  },

  getHoldFee: async (resultToken: string, token: string) => {
    const rt = String(resultToken || "").trim();
    if (!rt) throw new Error("Missing ResultToken");
    rememberFlightAccessToken(token);
    const doFetch = (t: string) =>
      fetch("/api/flight/hold-fee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ ResultToken: rt }),
      });
    const response = await withFlightTokenRetry(doFetch, token, "getHoldFee");
    if (!response.ok) {
      const errText = await response.text();
      let detail = errText;
      try {
        const j = JSON.parse(errText) as Record<string, unknown>;
        detail =
          String(
            j.Message ??
              j.message ??
              j.ErrorDesc ??
              j.errorDesc ??
              j.error ??
              errText,
          ) || errText;
      } catch {
        /* keep raw */
      }
      throw new Error(`HTTP ${response.status}: ${detail}`);
    }
    return response.json();
  },

  updateFareQuote: async (resultToken: string, token: string) => {
    try {
      const doFetch = (t: string) =>
        fetch('/api/flight/fare-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resultToken, token: t }),
        });

      let response = await withFlightTokenRetry(doFetch, token, 'updateFareQuote');

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Fare Quote Update Error:', error);
      throw error;
    }
  },
};

export const hdfcAPI = {
  initiateSession: async (params: {
    order_id: string;
    amount: number;
    customer_email: string;
    customer_phone: string;
    first_name: string;
    last_name: string;
    currency?: string;
    description?: string;
  }): Promise<{ launcher_url: string }> => {
    const response = await fetch('/api/payment/hdfc-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HDFC session failed: HTTP ${response.status}`);
    }
    return response.json();
  },

  verifyOrder: async (orderId: string): Promise<any> => {
    const response = await fetch(`/api/payment/hdfc-verify?orderId=${encodeURIComponent(orderId)}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HDFC verify failed: HTTP ${response.status}`);
    }
    return response.json();
  },
};

export const paymentAPI = {
  processRazorpayPayment: async (
    orderId: string,
    amount: number,
    currency: string = 'INR',
    prefillData?: { name?: string; email?: string; contact?: string },
  ) => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window object not available'));
        return;
      }

      if (!(window as any).Razorpay) {
        reject(new Error('Razorpay SDK not loaded. Please refresh the page and try again.'));
        return;
      }

      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      
      const amountInPaise = Math.round(amount * 100);

      if (!razorpayKey) {
        reject(new Error('Razorpay key not configured'));
        return;
      }

      const options = {
        key: razorpayKey,
        amount: amountInPaise,
        currency,
        name: 'Vivance Travels',
        description: 'Flight Booking Payment',
        order_id: orderId,
        handler: (response: any) => {
          resolve({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        prefill: {
          name: prefillData?.name || 'Guest User',
          email: prefillData?.email || 'guest@vivancetravels.com',
          contact: prefillData?.contact || '9999999999',
        },
        theme: { 
          color: '#FC6603' 
        },
        modal: {
          ondismiss: () => {
            reject(new Error('Payment cancelled by user'));
          }
        }
      };


      try {
        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', (response: any) => {
          console.error('Payment failed:', response.error);
          reject(new Error(`Payment failed: ${response.error.description || 'Unknown error'}`));
        });
        rzp.open();
      } catch (error) {
        console.error('Error creating Razorpay instance:', error);
        reject(new Error('Failed to initialize payment gateway'));
      }
    });
  },
};

export const authAPI = {
  signUp: async (data: SignUpData) => {
    try {
      const payload = {
        ...data,
        userType: USER_TYPES.GUEST,
        status: USER_STATUS.INACTIVE,
        emailActivation: false,
      };
      
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signup', ...payload }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Sign Up Error:', error);
      throw error;
    }
  },

  signIn: async (data: SignInData) => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signin', ...data }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Sign In Error:', error);
      throw error;
    }
  },

  resetPassword: async (data: ResetPasswordData) => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', ...data }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Reset Password Error:', error);
      throw error;
    }
  },
};

export const passengerAPI = {
  createPassenger: async (data: PassengerData) => {
    try {
      const response = await fetch('/api/passenger/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Create Passenger Error:', error);
      throw error;
    }
  },

  getPassengersByUserId: async (userId: number) => {
    try {
      const response = await fetch(`/api/passenger/get?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Fetch Passengers Error:', error);
      throw error;
    }
  },
};
