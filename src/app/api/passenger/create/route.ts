import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_USER, API_KEY } from '@/lib/config';
import { validatePassengerPayload } from '@/utils/validation';
import { getServerDomainTokenCached, refreshServerDomainTokenCached } from '@/lib/serverTokenCache';

function bearerPreview(authHeader: string) {
  const raw = String(authHeader || '').trim();
  if (!raw) return '(missing)';
  const token = raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : raw;
  if (!token) return '(missing)';
  if (token.length <= 24) return `[len=${token.length}] ${token}`;
  return `[len=${token.length}] ${token.slice(0, 10)}…${token.slice(-6)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const errors = validatePassengerPayload(body);
    if (errors.length > 0)
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
    
    const endpoint = `${API_BASE_URL_USER}/userTravellerDetails/create`;
    const token = await getServerDomainTokenCached();
    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY,
      Authorization: `Bearer ${token}`,
    };

    console.log('\n========== USER TRAVELLER CREATE (passenger/create) ==========');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Endpoint:', endpoint);
    console.log('Method: POST');
    console.log('Params:', {}); // none
    console.log('Headers (safe):', {
      'content-type': requestHeaders['Content-Type'],
      'x-api-key': API_KEY ? `${String(API_KEY).slice(0, 6)}…` : '(missing)',
      authorization: bearerPreview(requestHeaders.Authorization),
    });
    console.log('Request Body:', JSON.stringify(body, null, 2).slice(0, 2000));

    const doCall = async (headers: Record<string, string>) => {
      const start = Date.now();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const durationMs = Date.now() - start;
      const responseText = await response.text().catch(() => '');
      return { response, durationMs, responseText };
    };

    let { response, durationMs, responseText } = await doCall(requestHeaders);

    const expired =
      response.status === 401 ||
      /token\s*expired/i.test(responseText) ||
      /jwt\s*expired/i.test(responseText);

    if (expired) {
      console.warn('[passenger/create] Token expired — refreshing via /vivapi-auth/app/auth/refresh and retrying');
      const fresh = await refreshServerDomainTokenCached();
      const retryHeaders = { ...requestHeaders, Authorization: `Bearer ${fresh}` };
      console.log('[passenger/create] Retry bearer:', bearerPreview(retryHeaders.Authorization));
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
    console.log('============================================================\n');

    const result = responseText ? JSON.parse(responseText) : null;
    return NextResponse.json(result);
  } catch (error) {
    console.error('Passenger creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create passenger' },
      { status: 500 }
    );
  }
}