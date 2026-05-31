type TokenCache = {
  token: string | null;
  refreshToken: string | null;
  inFlight: Promise<string> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __vivanceFlightDomainTokenCache: TokenCache | undefined;
}

function cache(): TokenCache {
  if (!globalThis.__vivanceFlightDomainTokenCache) {
    globalThis.__vivanceFlightDomainTokenCache = { token: null, refreshToken: null, inFlight: null };
  }
  return globalThis.__vivanceFlightDomainTokenCache;
}

// No time-based expiry — backend signals expiry via 401, triggering refresh or re-login.
export function invalidateFlightDomainToken(): void {
  const c = cache();
  c.token = null;
  c.inFlight = null;
}

/**
 * Aligns the in-memory flight access token with the Bearer used for MT calls (e.g.
 * `selectedFlight.domainToken` on payment). Ensures a 401 → `forceRefreshFlightDomainToken`
 * refresh uses the same auth session as booking/search when possible.
 */
export function rememberFlightAccessToken(access: string): void {
  const t = String(access || "").trim();
  if (!t) return;
  cache().token = t;
}

function logClientTokenExchange(expired: string, newToken: string, via: string) {
  console.log(`[flightAuth] ── Token comparison (${via}) — full strings ──`);
  console.log("[flightAuth] Expired / previous Token:", expired || "(empty)");
  console.log("[flightAuth] New Token:", newToken);
  console.log("[flightAuth] Same string as previous?", expired === newToken);
}

/**
 * Called on 401: tries refresh first, falls back to full re-login.
 * Returns the new access token.
 */
export async function forceRefreshFlightDomainToken(): Promise<string> {
  const c = cache();
  if (c.inFlight) return c.inFlight;

  const expiredAccessToken = c.token?.trim() ?? "(no cached access token)";
  c.token = null; // invalidate stale access token

  c.inFlight = (async () => {
    if (c.refreshToken) {
      try {
        const endpoint = '/api/flight/refresh-token';
        const reqBody = { refreshToken: c.refreshToken };
        console.log('\n=== [flightAuth] Calling refresh-token API ===');
        console.log('[flightAuth] Endpoint:', endpoint);
        console.log('[flightAuth] Headers:', { 'Content-Type': 'application/json' });
        console.log('[flightAuth] Body (safe):', {
          refreshToken: c.refreshToken ? `[len=${c.refreshToken.length}] …${c.refreshToken.slice(-8)}` : '(missing)',
        });
        const start = Date.now();
        const res = await fetch('/api/flight/refresh-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
        });
        const ms = Date.now() - start;
        if (res.ok) {
          const raw = await res.text().catch(() => '');
          console.log('[flightAuth] refresh-token response:', {
            status: res.status,
            ok: res.ok,
            durationMs: ms,
            contentType: res.headers.get('content-type'),
            bodyPreview: raw.slice(0, 1000),
          });
          const data = raw ? JSON.parse(raw) : {};
          const newToken = String(data?.Token ?? data?.token ?? '').trim();
          const newRefresh = String(data?.refreshToken ?? '').trim();
          if (newToken) {
            c.token = newToken;
            if (newRefresh) c.refreshToken = newRefresh;
            console.log('[flightAuth] Token refreshed via refreshToken');
            logClientTokenExchange(expiredAccessToken, newToken, "refreshToken endpoint");
            return newToken;
          }
        } else {
          const raw = await res.text().catch(() => '');
          console.warn('[flightAuth] refresh-token failed response:', {
            status: res.status,
            ok: res.ok,
            durationMs: ms,
            contentType: res.headers.get('content-type'),
            bodyPreview: raw.slice(0, 1000),
          });
        }
      } catch {
        // fall through to full re-login
      }
      // Refresh failed — clear so we don't loop
      c.refreshToken = null;
      console.warn('[flightAuth] Refresh failed, falling back to full re-login');
    }

    // Full re-login
    const res = await fetch('/api/flight/token', { method: 'POST' });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${txt ? ` - ${txt}` : ''}`);
    }
    const data = await res.json();
    const token = String(data?.Token ?? data?.token ?? '').trim();
    const refreshToken = String(data?.refreshToken ?? '').trim();
    if (!token) throw new Error('Token missing in auth response');
    c.token = token;
    if (refreshToken) c.refreshToken = refreshToken;
    console.log('[flightAuth] Token obtained via full re-login');
    logClientTokenExchange(expiredAccessToken, token, "/api/flight/token");
    return token;
  })()
    .catch((e) => {
      c.token = null;
      throw e;
    })
    .finally(() => {
      c.inFlight = null;
    });

  return c.inFlight;
}

export async function getFlightDomainTokenCached(): Promise<string> {
  const c = cache();
  if (c.token) return c.token;
  if (c.inFlight) return c.inFlight;

  c.inFlight = (async () => {
    const res = await fetch('/api/flight/token', { method: 'POST' });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${txt ? ` - ${txt}` : ''}`);
    }
    const data = await res.json();
    const token = String(data?.Token ?? data?.token ?? '').trim();
    const refreshToken = String(data?.refreshToken ?? '').trim();
    if (!token) throw new Error('Token missing in auth response');
    c.token = token;
    if (refreshToken) c.refreshToken = refreshToken;
    return token;
  })()
    .catch((e) => {
      c.token = null;
      throw e;
    })
    .finally(() => {
      c.inFlight = null;
    });

  return c.inFlight;
}
