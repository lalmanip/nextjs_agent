import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_USER, API_KEY } from '@/lib/config';
import { getServerDomainTokenCached, refreshServerDomainTokenCached } from '@/lib/serverTokenCache';

function bearerPreview(authHeader: string) {
  const raw = String(authHeader || '').trim();
  if (!raw) return '(missing)';
  const token = raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : raw;
  if (!token) return '(missing)';
  if (token.length <= 24) return `[len=${token.length}] ${token}`;
  return `[len=${token.length}] ${token.slice(0, 10)}…${token.slice(-6)}`;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    const endpoint = `${API_BASE_URL_USER}/userTravellerDetails/getSavedPaxById/${userId}`;
    const token = await getServerDomainTokenCached();
    const headers = {
      'X-API-KEY': API_KEY,
      Authorization: `Bearer ${token}`,
    };
    console.log('\n========== GET SAVED PAX (passenger/get) ==========');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Endpoint:', endpoint);
    console.log('Method: GET');
    console.log('Params:', { userId });
    console.log('Headers (safe):', {
      'x-api-key': API_KEY ? `${String(API_KEY).slice(0, 6)}…` : '(missing)',
      authorization: bearerPreview(headers.Authorization),
    });

    const doCall = async (h: Record<string, string>) => {
      const start = Date.now();
      const response = await fetch(endpoint, { method: 'GET', headers: h });
      const durationMs = Date.now() - start;
      const responseText = await response.text().catch(() => '');
      return { response, durationMs, responseText };
    };

    let { response, durationMs, responseText } = await doCall(headers);

    let tokenExpiredInBody = false;
    try {
      const j = JSON.parse(responseText);
      const msg = String(j?.message ?? j?.Message ?? j?.error ?? j?.Error ?? '').toLowerCase();
      tokenExpiredInBody =
        (msg.includes('token') && msg.includes('expir')) ||
        msg.includes('jwt expired') ||
        msg.includes('unauthorized');
    } catch {
      /* not JSON */
    }

    const expired =
      response.status === 401 ||
      response.status === 403 ||
      tokenExpiredInBody ||
      /token\s*expired/i.test(responseText) ||
      /jwt\s*expired/i.test(responseText);

    if (expired) {
      console.warn(
        '[passenger/get] Token expired — refreshing via /vivapi-auth/app/auth/refresh and retrying',
      );
      const fresh = await refreshServerDomainTokenCached();
      const retryHeaders = { ...headers, Authorization: `Bearer ${fresh}` };
      console.log('[passenger/get] Retry bearer:', bearerPreview(retryHeaders.Authorization));
      ({ response, durationMs, responseText } = await doCall(retryHeaders));
    }
    console.log('--- RESPONSE FROM BACKEND ---');
    console.log('Status Code:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Response Time:', `${durationMs}ms`);
    console.log('Response Headers:', {
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length'),
    });
    console.log('Response Body (Raw preview):', responseText.slice(0, 2000));
    console.log('==================================================\n');

    const result = responseText ? JSON.parse(responseText) : null;
    return NextResponse.json(result);
  } catch (error) {
    console.error('Fetch passengers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch passengers' },
      { status: 500 }
    );
  }
}