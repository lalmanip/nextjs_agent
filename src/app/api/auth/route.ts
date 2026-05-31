import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_USER, API_KEY } from '@/lib/config';
import { validateSignUpPayload, validateSignInPayload } from '@/utils/validation';
import { getServerDomainTokenCached, invalidateServerDomainToken } from '@/lib/serverTokenCache';

function toBearer(tokenLike: string) {
  const t = String(tokenLike || '').trim();
  if (!t) return '';
  return t.toLowerCase().startsWith('bearer ') ? t : `Bearer ${t}`;
}

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
    const { action, ...data } = await request.json();

    let url = '';
    const needsBearer = action === 'signup' || action === 'signin';
    switch (action) {
      case 'signup': {
        const errors = validateSignUpPayload(data);
        if (errors.length > 0)
          return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
        url = `${API_BASE_URL_USER}/user/create`;
        break;
      }
      case 'signin': {
        const errors = validateSignInPayload(data);
        if (errors.length > 0)
          return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
        url = `${API_BASE_URL_USER}/user/authenticate`;
        break;
      }
      case 'reset':
        url = `${API_BASE_URL_USER}/user/reset`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Forward token as Authorization Bearer when calling authenticate/create
    const incomingAuth = request.headers.get('authorization') || '';
    const bodyToken =
      (data as any)?.token ||
      (data as any)?.accessToken ||
      (data as any)?.jwt ||
      (data as any)?.bearer ||
      '';
    const clientBearer = needsBearer ? toBearer(incomingAuth || bodyToken) : '';
    let bearer = needsBearer ? clientBearer : '';
    const usedServerDomainBearer = Boolean(needsBearer && !bearer);

    if (needsBearer && !bearer) {
      const domainToken = await getServerDomainTokenCached();
      bearer = toBearer(domainToken);
    }

    const isCreate = action === 'signup' && url.includes('/user/create');
    if (isCreate) {
      console.log('\n========== USER CREATE (vivapi-user/user/create) ==========');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Endpoint:', url);
      console.log('Method: POST');
      console.log('Params:', {}); // none
      console.log('Headers (safe):', {
        'content-type': 'application/json',
        'x-api-key': API_KEY ? `${String(API_KEY).slice(0, 6)}…` : '(missing)',
        authorization: bearerPreview(bearer),
      });
      console.log('Request Body:', JSON.stringify(data, null, 2).slice(0, 2000));
    } else {
      console.log('USER API URL:', url);
    }

    /** Body sent to vivapi-user (action stripped; signin sends only credentials). */
    const buildUpstreamBody = (): string => {
      if (action === 'signin') {
        return JSON.stringify({
          userName: String(data.userName ?? '').trim(),
          password: String(data.password ?? ''),
        });
      }
      const { action: _a, token: _t, accessToken: _at, jwt: _j, bearer: _b, ...rest } =
        data as Record<string, unknown>;
      return JSON.stringify(rest);
    };
    const upstreamBody = buildUpstreamBody();

    const postUser = () =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
          ...(bearer ? { Authorization: bearer } : {}),
        },
        body: upstreamBody,
      });

    const start = Date.now();
    let response = await postUser();

    if (response.status === 401 && usedServerDomainBearer) {
      console.warn('[auth] 401 Unauthorized — refreshing domain token and retrying once');
      invalidateServerDomainToken();
      bearer = toBearer(await getServerDomainTokenCached());
      response = await postUser();
    }

    const responseText = await response.text().catch(() => '');
    const durationMs = Date.now() - start;

    if (isCreate) {
      console.log('--- RESPONSE FROM BACKEND ---');
      console.log('Status Code:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Response Time:', `${durationMs}ms`);
      console.log('Response Headers:', {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length'),
      });
      console.log('Response Body (Raw preview):', responseText.slice(0, 2000));
      console.log('==========================================================\n');
    } else {
      console.log('USER API Req (object):', data);
      console.log('USER API Req (JSON on wire):', upstreamBody);
      console.log('USER API Res status:', response.status, response.statusText);
      console.log('USER API Res body:', responseText.slice(0, 2000));
    }

    let result: unknown = null;
    try {
      result = responseText ? JSON.parse(responseText) : null;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON from user service', raw: responseText.slice(0, 500) },
        { status: 502 },
      );
    }

    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'API call failed' }, { status: 500 });
  }
}