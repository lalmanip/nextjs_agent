import { API_BASE_URL_AUTH, API_KEY } from "@/lib/config";
import { DOMAIN_CREDENTIALS } from "@/config";
import { vivAuthHttpJson, warnIfGlobalFetchProxyEnvOnce } from "@/lib/vivAuthHttpClient";

/** Auth API returns `Token` (access) + `refreshToken`; hotel routes send `Authorization: Bearer <Token>`. */
type TokenCache = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAtMs: number;
  inFlight: Promise<string> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __vivanceHotelAuthCacheV3: TokenCache | undefined;
}

function cache(): TokenCache {
  if (!globalThis.__vivanceHotelAuthCacheV3) {
    globalThis.__vivanceHotelAuthCacheV3 = {
      accessToken: null,
      refreshToken: null,
      expiresAtMs: 0,
      inFlight: null,
    };
  }
  return globalThis.__vivanceHotelAuthCacheV3;
}

function isAccessValid(c: TokenCache) {
  return !!c.accessToken && Date.now() < c.expiresAtMs - 30_000;
}

function readLoginPayload(data: Record<string, unknown>): Record<string, unknown> {
  const inner = data?.data;
  if (inner && typeof inner === "object") return inner as Record<string, unknown>;
  return data;
}

/** API field is `Token` (capital T); also accept `token` / nested `data`. */
function readAccessToken(data: Record<string, unknown>): string {
  const p = readLoginPayload(data);
  return String(p.Token ?? p.token ?? "").trim();
}

function readRefreshToken(data: Record<string, unknown>): string {
  const p = readLoginPayload(data);
  return String(p.refreshToken ?? "").trim();
}

function readExpiresInSec(data: Record<string, unknown>): number {
  const p = readLoginPayload(data);
  return Math.max(60, Number(p.expiresIn ?? p.expires_in ?? 3600));
}

function clearTokens(c: TokenCache) {
  c.accessToken = null;
  c.refreshToken = null;
  c.expiresAtMs = 0;
}

/** Force-refresh access token using cached refreshToken. Falls back to login if refresh fails/missing. */
export async function forceRefreshHotelAuthToken(): Promise<string> {
  const c = cache();
  if (c.inFlight) return c.inFlight;

  c.inFlight = (async () => {
    // Try refresh first if possible
    if (c.refreshToken) {
      const ok = await refreshHotelAccess(c);
      if (ok && isAccessValid(c)) return c.accessToken as string;
      // Refresh failed or returned unusable token → clear and re-login
      clearTokens(c);
    }

    await loginHotel(c);
    return c.accessToken as string;
  })()
    .catch((e) => {
      clearTokens(c);
      throw e;
    })
    .finally(() => {
      c.inFlight = null;
    });

  return c.inFlight;
}

/** Clears cached tokens so the next call triggers login/refresh. */
export function invalidateHotelAuthCache(): void {
  clearTokens(cache());
}

async function loginHotel(c: TokenCache): Promise<void> {
  const authUrl = `${API_BASE_URL_AUTH}/vivapi-auth/app/auth/login`;
  warnIfGlobalFetchProxyEnvOnce("hotelAuth vivapi-auth/login");
  const out = await vivAuthHttpJson({
    url: authUrl,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": API_KEY,
    },
    body: JSON.stringify({
      domain_key: DOMAIN_CREDENTIALS.DOMAIN_KEY,
      username: DOMAIN_CREDENTIALS.USERNAME,
      password: DOMAIN_CREDENTIALS.PASSWORD,
      system: DOMAIN_CREDENTIALS.SYSTEM,
    }),
  });

  if (out.statusCode < 200 || out.statusCode >= 300) {
    const txt = out.rawBody || "";
    throw new Error(`Auth login failed: ${out.statusCode}${txt ? ` - ${txt}` : ""}`);
  }

  const data = (out.rawBody ? JSON.parse(out.rawBody) : {}) as Record<string, unknown>;
  const access = readAccessToken(data);
  const refresh = readRefreshToken(data);
  if (!access) throw new Error("Auth login failed: Token missing in response");
  if (!refresh) throw new Error("Auth login failed: refreshToken missing in response");

  c.accessToken = access;
  c.refreshToken = refresh;
  c.expiresAtMs = Date.now() + readExpiresInSec(data) * 1000;
}

/** POST /vivapi-auth/app/auth/refresh with { refreshToken } → new `Token`. */
async function refreshHotelAccess(c: TokenCache): Promise<boolean> {
  if (!c.refreshToken) return false;

  const refreshUrl = `${API_BASE_URL_AUTH}/vivapi-auth/app/auth/refresh`;
  warnIfGlobalFetchProxyEnvOnce("hotelAuth vivapi-auth/refresh");
  const out = await vivAuthHttpJson({
    url: refreshUrl,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": API_KEY,
    },
    body: JSON.stringify({ refreshToken: c.refreshToken }),
  });

  if (out.statusCode < 200 || out.statusCode >= 300) {
    return false;
  }

  const data = (out.rawBody ? JSON.parse(out.rawBody) : {}) as Record<string, unknown>;
  const access = readAccessToken(data);
  if (!access) return false;

  c.accessToken = access;
  const newRefresh = readRefreshToken(data);
  if (newRefresh) c.refreshToken = newRefresh;
  c.expiresAtMs = Date.now() + readExpiresInSec(data) * 1000;
  return true;
}

export async function getHotelAuthTokenCached(): Promise<string> {
  const c = cache();
  if (isAccessValid(c)) return c.accessToken as string;
  if (c.inFlight) return c.inFlight;

  c.inFlight = (async () => {
    if (c.refreshToken) {
      const ok = await refreshHotelAccess(c);
      if (ok && isAccessValid(c)) return c.accessToken as string;
      clearTokens(c);
    }

    await loginHotel(c);
    return c.accessToken as string;
  })()
    .catch((e) => {
      clearTokens(c);
      throw e;
    })
    .finally(() => {
      c.inFlight = null;
    });

  return c.inFlight;
}
