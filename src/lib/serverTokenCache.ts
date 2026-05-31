// Server-side domain token cache.
// Stores the service-account access Token in Next.js server process memory so
// vivapi-auth/app/auth/login is called once per server instance rather than
// once per request. On 401, callers invalidate the cache and retry — no restart needed.
//
// Authorization must use `Token` (access), not `refreshToken`.

import { API_BASE_URL_AUTH, API_KEY } from '@/lib/config';
import { DOMAIN_CREDENTIALS } from '@/config';
import net from 'node:net';
import { vivAuthHttpJson, warnIfGlobalFetchProxyEnvOnce } from '@/lib/vivAuthHttpClient';

type ServerTokenCache = {
  accessToken: string | null;
  refreshToken: string | null;
  inFlight: Promise<string> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __vivanceServerDomainToken: ServerTokenCache | undefined;
}

function cache(): ServerTokenCache {
  if (!globalThis.__vivanceServerDomainToken) {
    globalThis.__vivanceServerDomainToken = { accessToken: null, refreshToken: null, inFlight: null };
  }
  return globalThis.__vivanceServerDomainToken;
}

function readLoginPayload(data: Record<string, unknown>): Record<string, unknown> {
  const inner = data?.data;
  if (inner && typeof inner === 'object') return inner as Record<string, unknown>;
  return data;
}

/** Auth login returns `Token` (access). Never use `refreshToken` as Bearer. */
export function readAccessTokenFromAuthResponse(data: Record<string, unknown>): string {
  const p = readLoginPayload(data);
  return String(p.Token ?? p.token ?? '').trim();
}

export function readRefreshTokenFromAuthResponse(data: Record<string, unknown>): string {
  const p = readLoginPayload(data);
  return String((p as any).refreshToken ?? (p as any).RefreshToken ?? '').trim();
}

function tokenPreview(token: string): string {
  const t = String(token || '').trim();
  if (!t) return '(empty)';
  if (t.length <= 32) return `[len=${t.length}] ${t}`;
  return `[len=${t.length}] ${t.slice(0, 14)}…${t.slice(-8)}`;
}

/** Decode JWT payload only (no verify). Used for diagnostics. */
function decodeJwtPayloadLoose(jwt: string): { sub?: unknown; iat?: number; exp?: number } | null {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const rem = b64.length % 4;
    if (rem) b64 += '='.repeat(4 - rem);
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const o = JSON.parse(json) as Record<string, unknown>;
    return {
      sub: o.sub,
      iat: typeof o.iat === 'number' ? o.iat : undefined,
      exp: typeof o.exp === 'number' ? o.exp : undefined,
    };
  } catch {
    return null;
  }
}

function logAccessJwtDiagnostics(label: string, accessJwt: string): void {
  const payload = decodeJwtPayloadLoose(accessJwt);
  if (!payload) {
    console.log(`[${label}] access Token: not a decodable JWT (opaque token?)`);
    return;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const { iat, exp, sub } = payload;
  const expSec = typeof exp === 'number' ? exp : NaN;
  const expiredVsThisServer = Number.isFinite(expSec) && expSec < nowSec;
  console.log(`[${label}] access-JWT payload (no verify):`, {
    sub,
    iat,
    exp,
    iatIso: typeof iat === 'number' ? new Date(iat * 1000).toISOString() : undefined,
    expIso: typeof exp === 'number' ? new Date(exp * 1000).toISOString() : undefined,
    serverNowIso: new Date().toISOString(),
    serverNowUnixSec: nowSec,
    expiresInSecFromServerNow: Number.isFinite(expSec) ? expSec - nowSec : undefined,
    expiredVsThisServerClock: expiredVsThisServer,
  });
  if (expiredVsThisServer) {
    console.warn(
      `[${label}] JWT exp is before this Node process clock — vivapi-user may reject with TOKEN_EXPIRED even on a "fresh" login; align clocks or fix vivapi-auth token issuance.`,
    );
  }
}

let lastVivAuthAccessJwtForDiagnostics: string | null = null;

async function probeTcp(host: string, port: number, timeoutMs = 600): Promise<{ ok: boolean; error?: string; ms: number }> {
  const start = Date.now();
  return await new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    const done = (ok: boolean, error?: string) => {
      try { sock.destroy(); } catch {}
      resolve({ ok, error, ms: Date.now() - start });
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false, 'timeout'));
    sock.once('error', (e) => done(false, e instanceof Error ? e.message : String(e)));
  });
}

async function probeLocalhostDualStack(port: number): Promise<void> {
  const v6 = await probeTcp('::1', port).catch((e) => ({ ok: false, ms: 0, error: e instanceof Error ? e.message : String(e) }));
  const v4 = await probeTcp('127.0.0.1', port).catch((e) => ({ ok: false, ms: 0, error: e instanceof Error ? e.message : String(e) }));
  console.log('[vivapi-auth/login] TCP probe (dual-stack):', {
    port,
    ipv6: { ok: v6.ok, ms: v6.ms, error: v6.error ?? null },
    ipv4: { ok: v4.ok, ms: v4.ms, error: v4.error ?? null },
  });
}

/** Performs exactly one vivapi-auth login (no cache reads). Caller handles caching. */
export async function loginVivAuthFetchOnce(): Promise<string> {
  const url = `${API_BASE_URL_AUTH}/vivapi-auth/app/auth/login`;
  const start = Date.now();
  const loginBody = {
    domain_key: DOMAIN_CREDENTIALS.DOMAIN_KEY,
    username: DOMAIN_CREDENTIALS.USERNAME,
    password: DOMAIN_CREDENTIALS.PASSWORD,
    system: DOMAIN_CREDENTIALS.SYSTEM,
  };
  const loginHeaders = { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY };

  console.log(
    '[vivapi-auth/login] FULL REQUEST:',
    JSON.stringify(
      {
        url,
        method: 'POST',
        headers: loginHeaders,
        body: { ...loginBody, password: '***REDACTED (password not logged)***' },
      },
      null,
      2,
    ),
  );

  try {
    const u = new URL(url);
    const host = u.hostname;
    const port = Number(u.port || 80);
    const probe = await probeTcp(host, port);
    console.log('[vivapi-auth/login] TCP probe:', { host, port, ok: probe.ok, ms: probe.ms, error: probe.error ?? null });
    if (host === 'localhost' && Number.isFinite(port)) {
      await probeLocalhostDualStack(port);
    }
  } catch (e) {
    console.warn('[vivapi-auth/login] TCP probe skipped:', e instanceof Error ? e.message : String(e));
  }

  warnIfGlobalFetchProxyEnvOnce('vivapi-auth');

  let statusCode: number;
  let rawText: string;
  let contentType: string | null;
  try {
    const out = await vivAuthHttpJson({
      url,
      method: 'POST',
      headers: loginHeaders,
      body: JSON.stringify(loginBody),
    });
    statusCode = out.statusCode;
    rawText = out.rawBody;
    contentType = out.contentType;
  } catch (e) {
    const ms = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[vivapi-auth/login] HTTP request failed:', {
      durationMs: ms,
      url,
      message: msg,
      http_proxy: process.env.http_proxy || process.env.HTTP_PROXY || '(unset)',
      https_proxy: process.env.https_proxy || process.env.HTTPS_PROXY || '(unset)',
      no_proxy: process.env.no_proxy || process.env.NO_PROXY || '(unset)',
    });
    throw e;
  }
  const ms = Date.now() - start;
  console.log('[vivapi-auth/login] FULL RESPONSE (raw body):', rawText);
  console.log('[vivapi-auth/login] response meta:', {
    status: statusCode,
    ok: statusCode >= 200 && statusCode < 300,
    durationMs: ms,
    contentType,
    requestUrl: url,
    transport: 'node:http (direct; not global fetch)',
  });
  if (statusCode < 200 || statusCode >= 300) throw new Error(`Auth login failed: HTTP ${statusCode}`);

  const data = (rawText ? JSON.parse(rawText) : {}) as Record<string, unknown>;
  const token = readAccessTokenFromAuthResponse(data);
  const refresh = readRefreshTokenFromAuthResponse(data);
  logAccessJwtDiagnostics('vivapi-auth/login', token);
  if (lastVivAuthAccessJwtForDiagnostics !== null && lastVivAuthAccessJwtForDiagnostics === token) {
    console.warn(
      '[vivapi-auth/login] Identical access JWT as previous vivapi-auth login/refresh — auth service is reusing the same access token (server-side), not Next.js HTTP cache on POST.',
    );
  }
  lastVivAuthAccessJwtForDiagnostics = token;
  console.log('[vivapi-auth/login] Parsed Token:', tokenPreview(token));
  console.log('[vivapi-auth/login] Parsed refreshToken:', refresh ? `[len=${refresh.length}] …${refresh.slice(-8)}` : '(missing)');
  if (!token) throw new Error('Token missing in auth login response');
  // Cache refreshToken if present, to allow /auth/refresh on expiry.
  if (refresh) cache().refreshToken = refresh;
  return token;
}

/** POST /vivapi-auth/app/auth/refresh — request body must be exactly `{ "refreshToken": "<value>" }` (camelCase). */
async function refreshVivAuthFetchOnce(refreshTokenRaw: string): Promise<{ token: string; refreshToken: string }> {
  const refreshToken = String(refreshTokenRaw ?? "").trim();
  if (!refreshToken) {
    throw new Error("refreshToken missing or empty — cannot call vivapi-auth/app/auth/refresh");
  }

  const refreshUrl = `${API_BASE_URL_AUTH}/vivapi-auth/app/auth/refresh`;
  const start = Date.now();
  const refreshHeaders = { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY };
  /** Required JSON shape for vivapi-auth refresh. */
  const requestBody = { refreshToken };

  console.log(
    '[vivapi-auth/refresh] FULL REQUEST:',
    JSON.stringify(
      {
        url: refreshUrl,
        method: 'POST',
        headers: refreshHeaders,
        body: requestBody,
      },
      null,
      2,
    ),
  );

  warnIfGlobalFetchProxyEnvOnce('vivapi-auth');

  let statusCode: number;
  let rawText: string;
  let contentType: string | null;
  try {
    const out = await vivAuthHttpJson({
      url: refreshUrl,
      method: 'POST',
      headers: refreshHeaders,
      body: JSON.stringify(requestBody),
    });
    statusCode = out.statusCode;
    rawText = out.rawBody;
    contentType = out.contentType;
  } catch (e) {
    const ms = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[vivapi-auth/refresh] HTTP request failed:', {
      durationMs: ms,
      url: refreshUrl,
      message: msg,
      http_proxy: process.env.http_proxy || process.env.HTTP_PROXY || '(unset)',
      https_proxy: process.env.https_proxy || process.env.HTTPS_PROXY || '(unset)',
      no_proxy: process.env.no_proxy || process.env.NO_PROXY || '(unset)',
    });
    throw e;
  }

  const ms = Date.now() - start;
  console.log('[vivapi-auth/refresh] FULL RESPONSE (raw body):', rawText);
  console.log('[vivapi-auth/refresh] response meta:', {
    status: statusCode,
    ok: statusCode >= 200 && statusCode < 300,
    durationMs: ms,
    contentType,
    requestUrl: refreshUrl,
    transport: 'node:http (direct; not global fetch)',
  });
  if (statusCode < 200 || statusCode >= 300) throw new Error(`Auth refresh failed: HTTP ${statusCode}`);

  const data = (rawText ? JSON.parse(rawText) : {}) as Record<string, unknown>;
  const token = readAccessTokenFromAuthResponse(data);
  const refresh = readRefreshTokenFromAuthResponse(data);
  logAccessJwtDiagnostics('vivapi-auth/refresh', token);
  if (lastVivAuthAccessJwtForDiagnostics !== null && lastVivAuthAccessJwtForDiagnostics === token) {
    console.warn(
      '[vivapi-auth/refresh] Identical access JWT as previous vivapi-auth login/refresh — refresh may not be issuing a new access token.',
    );
  }
  lastVivAuthAccessJwtForDiagnostics = token;
  console.log('[vivapi-auth/refresh] Parsed Token:', tokenPreview(token));
  console.log('[vivapi-auth/refresh] Parsed refreshToken:', refresh ? `[len=${refresh.length}] …${refresh.slice(-8)}` : '(missing)');
  if (!token) throw new Error('Token missing in auth refresh response');
  return { token, refreshToken: refresh };
}

export function invalidateServerDomainToken(): void {
  const c = cache();
  c.accessToken = null;
  c.refreshToken = null;
  c.inFlight = null;
}

/**
 * Invalidate cache and synchronously POST to vivapi-auth login (never reuses stale memory).
 * Use after MT 401 instead of invalidate + getServerDomainTokenCached alone (avoids in-flight /
 * overwritten-cache races returning the same/expired JWT).
 */
export async function forceFreshServerDomainToken(): Promise<string> {
  invalidateServerDomainToken();
  const token = await loginVivAuthFetchOnce();
  cache().accessToken = token;
  return token;
}

/**
 * Refresh access token using the `refreshToken` from the last `vivapi-auth/app/auth/login` (cached).
 * POST `vivapi-auth/app/auth/refresh` with body `{ "refreshToken": "<token>" }`.
 * Falls back to login if refresh is missing or the refresh call fails.
 */
export async function refreshServerDomainTokenCached(): Promise<string> {
  const c = cache();
  if (c.refreshToken) {
    try {
      const out = await refreshVivAuthFetchOnce(c.refreshToken);
      c.accessToken = out.token;
      if (out.refreshToken) c.refreshToken = out.refreshToken;
      return out.token;
    } catch (e) {
      console.warn('[serverTokenCache] refresh failed; falling back to login:', e instanceof Error ? e.message : String(e));
      c.accessToken = null;
      c.refreshToken = null;
    }
  }

  const token = await loginVivAuthFetchOnce();
  c.accessToken = token;
  return token;
}

export async function getServerDomainTokenCached(): Promise<string> {
  const c = cache();
  if (c.accessToken) {
    if (process.env.DEBUG_VIVANCE_DOMAIN_TOKEN === '1') {
      console.log(
        '[serverTokenCache] getServerDomainTokenCached: using in-memory cached access token (no HTTP call to vivapi-auth/login)',
      );
    }
    return c.accessToken;
  }
  if (c.inFlight) return c.inFlight;

  c.inFlight = (async () => {
    const token = await loginVivAuthFetchOnce();
    c.accessToken = token;
    return token;
  })()
    .catch((e) => {
      c.accessToken = null;
      throw e;
    })
    .finally(() => {
      c.inFlight = null;
    });

  return c.inFlight;
}
