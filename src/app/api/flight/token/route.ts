import { NextResponse } from 'next/server';
import { API_BASE_URL_AUTH, API_KEY } from '@/lib/config';
import { DOMAIN_CREDENTIALS } from '@/config';
import { vivAuthHttpJson, warnIfGlobalFetchProxyEnvOnce } from '@/lib/vivAuthHttpClient';

async function issueFlightDomainToken() {
  try {
    const loginUrl = `${API_BASE_URL_AUTH}/vivapi-auth/app/auth/login`;
    console.log('=== [flight-token] BEGIN ===');
    console.log('[flight-token] Endpoint:', loginUrl);
    console.log('[flight-token] Request body (safe):', {
      domain_key: DOMAIN_CREDENTIALS.DOMAIN_KEY ? `${String(DOMAIN_CREDENTIALS.DOMAIN_KEY).slice(0, 6)}…` : '(missing)',
      username: DOMAIN_CREDENTIALS.USERNAME ? `${DOMAIN_CREDENTIALS.USERNAME.slice(0, 3)}…` : '(missing)',
      password: DOMAIN_CREDENTIALS.PASSWORD ? '(set)' : '(missing)',
      system: DOMAIN_CREDENTIALS.SYSTEM || '(missing)',
    });

    warnIfGlobalFetchProxyEnvOnce('flight-token route');

    const out = await vivAuthHttpJson({
      url: loginUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY,
      },
      body: JSON.stringify({
        domain_key: DOMAIN_CREDENTIALS.DOMAIN_KEY,
        username: DOMAIN_CREDENTIALS.USERNAME,
        password: DOMAIN_CREDENTIALS.PASSWORD,
        system: DOMAIN_CREDENTIALS.SYSTEM,
      }),
    });

    const text = out.rawBody;

    if (out.statusCode < 200 || out.statusCode >= 300) {
      console.error('[flight-token] Upstream response:', {
        status: out.statusCode,
        ok: false,
        contentType: out.contentType,
        bodyPreview: text.slice(0, 1000),
        transport: 'node:http (direct)',
      });
      console.log('=== [flight-token] END (failed) ===');
      return NextResponse.json({ error: 'Login failed', detail: text }, { status: out.statusCode || 502 });
    }

    const data = (text ? JSON.parse(text) : {}) as any;
    console.log('[flight-token] Upstream response:', {
      status: out.statusCode,
      ok: true,
      contentType: out.contentType,
      bodyPreview: text.slice(0, 1000),
      tokenPreview: data?.Token
        ? `[len=${String(data.Token).length}] ${String(data.Token).slice(0, 14)}…${String(data.Token).slice(-8)}`
        : '(none)',
      refreshTokenPreview: data?.refreshToken
        ? `[len=${String(data.refreshToken).length}] …${String(data.refreshToken).slice(-8)}`
        : '(none)',
      transport: 'node:http (direct)',
    });
    console.log('[flight-token] Success — token issued');
    console.log('=== [flight-token] END (ok) ===');
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[flight-token] Exception:', msg);
    console.log('=== [flight-token] END (exception) ===');
    return NextResponse.json({ error: 'Login failed', message: msg }, { status: 500 });
  }
}

/** Browser flightAuth uses POST; GET kept for direct/cached probes. */
export async function POST() {
  return issueFlightDomainToken();
}

export async function GET() {
  return issueFlightDomainToken();
}
