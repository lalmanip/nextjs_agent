const API_MODE = process.env.API_MODE || process.env.NEXT_PUBLIC_API_MODE || 'remote';

const API_URLS = {
  vivapi_mt: {
    local: 'http://127.0.0.1:8080/vivapi-mt',
    // Server-side calls from Next API routes (e.g. flight commit-booking) should hit the
    // cluster service directly. Going through the public host adds a second Kong hop whose
    // default read-timeout (60s) kills long TBO calls (commit-booking) before they finish.
    // Override via MT_API_BASE_URL (e.g. http://vivance-api-service:8080/vivapi-mt); falls
    // back to the public host if unset.
    remote: process.env.MT_API_BASE_URL || 'https://next.vivancetravels.com/vivapi-mt'
  },
  vivapi_user: {
    local: 'http://127.0.0.1:8082/vivapi-user',
    // Same reasoning as vivapi_mt: prefer the in-cluster service to avoid a second Kong hop.
    remote: process.env.USER_API_BASE_URL || 'https://next.vivancetravels.com/vivapi-user'
  },
  vivapi_hotel: {
    local: 'http://127.0.0.1:8090',
    // IMPORTANT (K8s): do NOT default this to the public ingress hostname.
    // Next.js API routes call this server-side; pointing at the same host can recurse through Ingress
    // (e.g. /api/hotels/* -> next -> https://host/api/hotels/* -> next -> timeout).
    //
    // Prefer in-cluster DNS. Override via HOTEL_API_BASE_URL if your service name differs.
    remote: process.env.HOTEL_API_BASE_URL || 'http://vivance-hotel-api-service:8090'
  },
  vivapi_auth: {
    local: 'http://127.0.0.1:8084',
    // Same reasoning as hotel: server-side calls should hit the cluster service directly.
    remote: process.env.AUTH_API_BASE_URL || 'http://vivance-auth-api-service:8084'
  },
  vivapi_holiday: {
    local: 'http://127.0.0.1:8095',
    remote: process.env.HOLIDAY_API_BASE_URL || 'http://vivance-holiday-api-service:8095'
  }
};

// For vivapi-mt endpoints (flight operations, payment)
export const API_BASE_URL_MT = API_URLS.vivapi_mt[API_MODE as keyof typeof API_URLS.vivapi_mt] || API_URLS.vivapi_mt.remote;

// For vivapi-user endpoints (auth, bookings, passengers)
export const API_BASE_URL_USER = API_URLS.vivapi_user[API_MODE as keyof typeof API_URLS.vivapi_user] || API_URLS.vivapi_user.remote;

// For vivapi-hotel endpoints (hotel search, booking)
export const API_BASE_URL_HOTEL = API_URLS.vivapi_hotel[API_MODE as keyof typeof API_URLS.vivapi_hotel] || API_URLS.vivapi_hotel.local;

// For vivapi-auth endpoints (login, token)
export const API_BASE_URL_AUTH = API_URLS.vivapi_auth[API_MODE as keyof typeof API_URLS.vivapi_auth] || API_URLS.vivapi_auth.local;

// For holidays API (tour packages, hero, destinations)
export const API_BASE_URL_HOLIDAY =
  process.env.HOLIDAY_API_BASE_URL ||
  API_URLS.vivapi_holiday[API_MODE as keyof typeof API_URLS.vivapi_holiday] ||
  API_URLS.vivapi_holiday.local;

// Legacy export for backward compatibility
export const API_BASE_URL = API_BASE_URL_MT;

export const API_KEY = 'viv-8806f318-1ecf-11ee-b64f-36e9be0141c6';

if (process.env.NODE_ENV !== 'production') {
  console.log('🔧 API Configuration:');
  console.log('  Mode:', API_MODE);
  console.log('  MT Base URL:', API_BASE_URL_MT);
  console.log('  User Base URL:', API_BASE_URL_USER);
  console.log('  Hotel Base URL:', API_BASE_URL_HOTEL);
  console.log('  Auth Base URL:', API_BASE_URL_AUTH);
  console.log('  Holiday Base URL:', API_BASE_URL_HOLIDAY);
}