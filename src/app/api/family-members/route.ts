import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_USER, API_KEY } from '@/lib/config';
import { getServerDomainTokenCached, refreshServerDomainTokenCached } from '@/lib/serverTokenCache';
import { normalizeTravellerMember, withPassportIssuingCountryForApi } from '@/lib/travellerFields';
import { validateRequiredTravellerDateOfBirth } from '@/utils/validation';

function bearerPreview(authHeader: string) {
  const raw = String(authHeader || '').trim();
  if (!raw) return '(missing)';
  const token = raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : raw;
  if (!token) return '(missing)';
  if (token.length <= 24) return `[len=${token.length}] ${token}`;
  return `[len=${token.length}] ${token.slice(0, 10)}…${token.slice(-6)}`;
}

const API_HEADERS = {
  'Content-Type': 'application/json',
  'X-API-KEY': API_KEY
};

export async function POST(request: NextRequest) {
  try {
    const data = withPassportIssuingCountryForApi(await request.json());

    const dobErr = validateRequiredTravellerDateOfBirth(
      (data as { dateOfBirth?: string | null }).dateOfBirth,
    );
    if (dobErr) {
      return NextResponse.json({ error: dobErr }, { status: 400 });
    }

    const endpoint = `${API_BASE_URL_USER}/userTravellerDetails/create`;
    const token = await getServerDomainTokenCached();
    const headers = { ...API_HEADERS, Authorization: `Bearer ${token}` };
    console.log('\n========== USER TRAVELLER CREATE (family-members) ==========');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Endpoint:', endpoint);
    console.log('Method: POST');
    console.log('Params:', {}); // none
    console.log('Headers (safe):', {
      'content-type': API_HEADERS['Content-Type'],
      'x-api-key': API_KEY ? `${String(API_KEY).slice(0, 6)}…` : '(missing)',
      authorization: bearerPreview(headers.Authorization),
    });
    console.log('Request Body:', JSON.stringify(data, null, 2).slice(0, 2000));

    const doCall = async (h: Record<string, string>) => {
      const start = Date.now();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: h,
        body: JSON.stringify(data)
      });
      const durationMs = Date.now() - start;
      const responseText = await response.text().catch(() => '');
      return { response, durationMs, responseText };
    };

    let { response, durationMs, responseText } = await doCall(headers);

    const expired =
      response.status === 401 ||
      /token\s*expired/i.test(responseText) ||
      /jwt\s*expired/i.test(responseText);

    if (expired) {
      console.warn('[family-members] Token expired — refreshing via /vivapi-auth/app/auth/refresh and retrying');
      const fresh = await refreshServerDomainTokenCached();
      const retryHeaders = { ...headers, Authorization: `Bearer ${fresh}` };
      console.log('[family-members] Retry bearer:', bearerPreview(retryHeaders.Authorization));
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
    console.log('===========================================================\n');

    const result = responseText ? JSON.parse(responseText) : null;
    return NextResponse.json(result);
  } catch (error) {
    console.error('Create Family Member Error:', error);
    return NextResponse.json({ error: 'Failed to create family member' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const endpoint = `${API_BASE_URL_USER}/userTravellerDetails/getSavedPaxById/${userId}`;
    const token = await getServerDomainTokenCached();
    const headers = { ...API_HEADERS, Authorization: `Bearer ${token}` };
    console.log('\n========== GET SAVED PAX (family-members) ==========');
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
        '[family-members GET] Token expired — refreshing via /vivapi-auth/app/auth/refresh and retrying',
      );
      const fresh = await refreshServerDomainTokenCached();
      const retryHeaders = { ...headers, Authorization: `Bearer ${fresh}` };
      console.log('[family-members GET] Retry bearer:', bearerPreview(retryHeaders.Authorization));
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
    console.log('====================================================\n');

    const result = responseText ? JSON.parse(responseText) : null;
    if (result?.response && Array.isArray(result.response)) {
      result.response = result.response.map((row: Record<string, unknown>) =>
        normalizeTravellerMember(row),
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Fetch Family Members Error:', error);
    return NextResponse.json({ error: 'Failed to fetch family members' }, { status: 500 });
  }
}
