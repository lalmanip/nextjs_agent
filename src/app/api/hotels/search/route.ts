import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_HOTEL } from '@/lib/config';
import { API_CONFIG } from '@/config';
import { forceRefreshHotelAuthToken, getHotelAuthTokenCached } from '@/lib/hotelAuth';
import { isPublicHotelApiHotelsLoop } from '@/lib/hotelUpstreamGuard';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function headersObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function redactHeadersForLog(h: Record<string, string>): Record<string, string> {
  const copy = { ...h };
  const auth = copy.authorization ?? copy.Authorization;
  if (auth) {
    const v = String(auth);
    if (v.toLowerCase().startsWith('bearer ') && v.length > 14) {
      const t = v.slice(7);
      copy.authorization = `Bearer ${t.slice(0, 4)}…${t.slice(-4)} (${t.length} chars)`;
      delete copy.Authorization;
    }
  }
  const key = copy['x-api-key'] ?? copy['X-API-KEY'];
  if (key) {
    const s = String(key);
    copy['x-api-key'] = s.length > 8 ? `${s.slice(0, 4)}…${s.slice(-4)}` : '****';
    delete copy['X-API-KEY'];
  }
  return copy;
}

function maskBearerToken(token: string): string {
  if (token.length <= 12) return `**** (${token.length} chars)`;
  return `${token.slice(0, 4)}…${token.slice(-4)} (${token.length} chars)`;
}

function maskApiKey(key: string): string {
  if (key.length <= 10) return `**** (${key.length} chars)`;
  return `${key.slice(0, 4)}…${key.slice(-4)} (${key.length} chars)`;
}

export async function POST(request: NextRequest) {
  try {
    const incomingUrl = request.url;
    const incomingParams = Object.fromEntries(new URL(incomingUrl).searchParams.entries());
    const incomingHeaders = headersObject(request.headers);
    const body = await request.json();

    console.log('[hotels/search] --- INCOMING (browser → Next) ---');
    console.log('[hotels/search] URL:', incomingUrl);
    console.log('[hotels/search] Query params:', JSON.stringify(incomingParams));
    console.log('[hotels/search] Headers:', JSON.stringify(redactHeadersForLog(incomingHeaders), null, 2));
    console.log('[hotels/search] Body:', JSON.stringify(body, null, 2));

    let accessToken: string;
    try {
      accessToken = await getHotelAuthTokenCached();
    } catch (e: any) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[hotels/search] Auth error:', message);
      return NextResponse.json({ error: 'Hotel search failed', message }, { status: 502 });
    }

    // Align with book / prebook / getbookingdetails (all use /api/v1/hotels/... on the hotel service).
    const apiUrl = `${API_BASE_URL_HOTEL}/api/v1/hotels/search`;
    if (isPublicHotelApiHotelsLoop(apiUrl)) {
      console.error('[hotels/search] Misconfigured HOTEL_API_BASE_URL (would self-fetch). Base:', API_BASE_URL_HOTEL);
      return NextResponse.json(
        {
          error: 'Hotel proxy misconfiguration',
          message:
            'Set HOTEL_API_BASE_URL to http://vivance-hotel-api-service:8090 (in-cluster). Do not use the public ingress URL for /api/hotels/*.',
        },
        { status: 500 }
      );
    }

    const upstreamBody = JSON.stringify(body);

    const buildUpstreamHeaders = (token: string): Record<string, string> => ({
      'Content-Type': 'application/json',
      'X-API-KEY': API_CONFIG.API_KEY,
      Authorization: `Bearer ${token}`,
    });

    console.log('[hotels/search] --- OUTGOING (Next → hotel service) ---');
    console.log('[hotels/search] URL:', apiUrl);
    console.log(
      '[hotels/search] Headers:',
      JSON.stringify(
        {
          'Content-Type': 'application/json',
          'X-API-KEY': maskApiKey(API_CONFIG.API_KEY),
          Authorization: `Bearer ${maskBearerToken(accessToken)}`,
        },
        null,
        2
      )
    );
    console.log('[hotels/search] Body:', upstreamBody);

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: buildUpstreamHeaders(accessToken),
        body: upstreamBody,
      });
    } catch (e: any) {
      const code = e?.cause?.code || e?.code;
      const message = `Hotel service unreachable at ${API_BASE_URL_HOTEL}${code ? ` (${code})` : ""}`;
      console.error('[hotels/search] Upstream fetch error:', message);
      return NextResponse.json({ error: 'Hotel search failed', message }, { status: 502 });
    }

    let responseText = await response.text();
    console.log('[hotels/search] --- UPSTREAM RESPONSE ---');
    console.log('[hotels/search] Status:', response.status, response.statusText);
    console.log(
      '[hotels/search] Response headers:',
      JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)
    );
    console.log('[hotels/search] Response body:', responseText.substring(0, 1000));

    // If token is expired/invalid, refresh and retry once automatically.
    // Backend returns 403 (not 401) for expired JWT, so we handle both.
    if (response.status === 401 || response.status === 403) {
      let parsed: any = null;
      try {
        parsed = responseText ? JSON.parse(responseText) : null;
      } catch {
        parsed = null;
      }
      const code = parsed?.error?.code;
      const msg = parsed?.error?.message;
      if (code === 'AUTHENTICATION_FAILED' || String(msg || '').toLowerCase().includes('expired')) {
        console.warn(`[hotels/search] ${response.status} AUTHENTICATION_FAILED — refreshing token and retrying once.`);
        try {
          accessToken = await forceRefreshHotelAuthToken();
        } catch (e: any) {
          const m = e instanceof Error ? e.message : String(e);
          console.error('[hotels/search] Token refresh failed:', m);
          return NextResponse.json(
            { error: 'Hotel search failed', message: 'Token refresh failed', details: responseText, status: 401 },
            { status: 401 }
          );
        }

        // Retry
        let retryRes: Response;
        try {
          retryRes = await fetch(apiUrl, {
            method: 'POST',
            headers: buildUpstreamHeaders(accessToken),
            body: upstreamBody,
          });
        } catch (e: any) {
          const code2 = e?.cause?.code || e?.code;
          const message = `Hotel service unreachable at ${API_BASE_URL_HOTEL}${code2 ? ` (${code2})` : ""}`;
          console.error('[hotels/search] Upstream fetch error (retry):', message);
          return NextResponse.json({ error: 'Hotel search failed', message }, { status: 502 });
        }

        response = retryRes;
        responseText = await response.text();
        console.log('[hotels/search] --- UPSTREAM RESPONSE (retry) ---');
        console.log('[hotels/search] Status (retry):', response.status, response.statusText);
        console.log(
          '[hotels/search] Response headers (retry):',
          JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)
        );
        console.log('[hotels/search] Response body (retry):', responseText.substring(0, 1000));
      }
    }

    if (!response.ok) {
      console.error('[hotels/search] Backend error:', response.status, responseText);
      return NextResponse.json(
        { error: 'Hotel search failed', details: responseText, status: response.status },
        { status: response.status }
      );
    }

    let data: unknown;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      return NextResponse.json(
        { error: 'Hotel search failed', message: 'Upstream returned non-JSON body', details: responseText },
        { status: 502 }
      );
    }
    const d = data as Record<string, unknown>;
    const normalized =
      d?.hotels && d?.pagination ? d : (d?.data as Record<string, unknown>)?.hotels ? d.data : d;
    return NextResponse.json(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[hotels/search] Exception:', message);
    return NextResponse.json(
      { error: 'Hotel search failed', message },
      { status: 500 }
    );
  }
}
