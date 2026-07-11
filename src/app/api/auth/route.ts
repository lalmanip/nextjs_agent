import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_USER, API_BASE_URL_AUTH, API_KEY } from '@/lib/config';
import { validateSignUpPayload, validateSignInPayload } from '@/utils/validation';
import { getServerDomainTokenCached, invalidateServerDomainToken } from '@/lib/serverTokenCache';
import { loginViaAuthGatewayAndFetchProfile } from '@/lib/userAuthLogin';
import { registerViaAuthGateway } from '@/lib/userAuthGateway';

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
    const needsBearer = action === 'signup' || action === 'agent-add';
    switch (action) {
      case 'signup': {
        const errors = validateSignUpPayload(data);
        if (errors.length > 0) {
          console.error(
            '[auth] signup Validation failed on fields:',
            errors.map((e) => `${e.field} -> ${e.message}`),
          );
          return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
        }

        const loginId = String(data.userName ?? data.email ?? '').trim();
        const password = String(data.password ?? '');
        const firstName = String(data.firstName ?? '').trim();
        const lastName = String(data.lastName ?? '').trim();
        const countryCodeRaw = data.countryCode;
        const countryCode =
          countryCodeRaw != null && String(countryCodeRaw).trim() !== ''
            ? parseInt(String(countryCodeRaw), 10)
            : undefined;
        const userTypeRaw = data.userType;
        const userType =
          userTypeRaw != null && String(userTypeRaw).trim() !== ''
            ? parseInt(String(userTypeRaw), 10)
            : undefined;
        const statusRaw = data.status;
        const status =
          statusRaw != null && String(statusRaw).trim() !== ''
            ? parseInt(String(statusRaw), 10)
            : undefined;

        console.log('\n========== AGENT SIGNUP (vivapi-auth register + vivapi-user/create) ==========');
        console.log('Login id:', loginId);

        const authRegister = await registerViaAuthGateway(
          API_BASE_URL_AUTH,
          API_KEY,
          {
            userName: loginId,
            email: loginId.includes('@') ? loginId : undefined,
            password,
            firstName,
            lastName,
            countryCode: Number.isFinite(countryCode) ? countryCode : undefined,
            userType: Number.isFinite(userType) ? userType : 3,
            status: Number.isFinite(status) ? status : 0,
          },
        );

        if (!authRegister.ok) {
          console.warn('[auth] vivapi-auth register failed:', authRegister.message);
          const httpStatus =
            authRegister.status === 409 ? 409 : authRegister.status >= 400 ? authRegister.status : 400;
          return NextResponse.json(
            { status: 'failed', message: authRegister.message, response: null },
            { status: httpStatus },
          );
        }

        console.log('[auth] vivapi-auth register OK, authUserId:', authRegister.userId);

        url = `${API_BASE_URL_USER}/user/create`;
        (data as Record<string, unknown>).uuid = authRegister.userId;
        delete (data as Record<string, unknown>).password;
        break;
      }
      case 'signin': {
        const errors = validateSignInPayload(data);
        if (errors.length > 0)
          return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });

        console.log('\n========== AUTH API CALL [action=signin via vivapi-auth] ==========');
        const signInResult = await loginViaAuthGatewayAndFetchProfile({
          userName: String(data.userName ?? ''),
          password: String(data.password ?? ''),
          authBaseUrl: API_BASE_URL_AUTH,
          userBaseUrl: API_BASE_URL_USER,
          apiKey: API_KEY,
          requiredUserType: 3,
          rejectInactiveB2b: true,
        });
        const signInStatus = signInResult.status === 'success' ? 200 : 401;
        return NextResponse.json(signInResult, { status: signInStatus });
      }
      case 'agent-add': {
        url = `${API_BASE_URL_USER}/user/agent/add`;
        break;
      }
      case 'reset':
        return NextResponse.json(
          {
            status: 'failed',
            message:
              'Password reset moved to auth. Use POST /api/auth/reset-password (forgot token) or POST /api/auth/change-password (logged in).',
          },
          { status: 410 },
        );
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

    /** Body sent to vivapi-user (action stripped). */
    const buildUpstreamBody = (): string => {
      const { action: _a, token: _t, accessToken: _at, jwt: _j, bearer: _b, ...rest } =
        data as Record<string, unknown>;
      return JSON.stringify(rest);
    };
    const upstreamBody = buildUpstreamBody();

    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY,
      ...(bearer ? { Authorization: bearer } : {}),
    };

    console.log(`\n========== AUTH API CALL [action=${action}] ==========`);
    console.log('Timestamp     :', new Date().toISOString());
    console.log('Endpoint (URL):', url);
    console.log('Method        :', 'POST');
    console.log('Query Params  :', Object.fromEntries(new URL(request.url).searchParams));
    console.log('Headers       :', {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY ? `${String(API_KEY).slice(0, 6)}…(len=${String(API_KEY).length})` : '(missing)',
      Authorization: bearerPreview(bearer),
    });
    console.log('Request Body  :', upstreamBody.slice(0, 2000));

    const postUser = () =>
      fetch(url, {
        method: 'POST',
        headers: requestHeaders,
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

    console.log('--- RESPONSE FROM BACKEND ---');
    console.log('Status        :', response.status, response.statusText);
    console.log('Response Time :', `${durationMs}ms`);
    console.log('Resp Headers  :', {
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length'),
    });
    console.log('Response Body :', responseText.slice(0, 2000));
    console.log('======================================================\n');

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