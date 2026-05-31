import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_MT, API_KEY } from '@/lib/config';

export const dynamic = 'force-dynamic';

const COMMIT_BOOKING_LOG_BODY_MAX = 24_000;

function maskSecret(value: string, head = 6, tail = 4): string {
  const s = String(value ?? '');
  if (!s) return '(empty)';
  if (s.length <= head + tail + 1) return '***';
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function maskBearerHeader(raw: string | null): string {
  if (!raw?.trim()) return '(missing)';
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m ? `Bearer ${maskSecret(m[1])}` : maskSecret(raw);
}

function logIncomingFromClient(request: NextRequest, parsedBody: Record<string, unknown>) {
  const url = request.url;
  const queryParams = Object.fromEntries(new URL(url).searchParams.entries());
  const headerPick = [
    'authorization',
    'Authorization',
    'x-api-key',
    'X-API-KEY',
    'content-type',
    'Content-Type',
    'user-agent',
    'User-Agent',
  ];
  const headers: Record<string, string> = {};
  for (const name of headerPick) {
    const v = request.headers.get(name);
    if (v == null || v === '') continue;
    const lower = name.toLowerCase();
    if (lower === 'authorization') headers[name] = maskBearerHeader(v);
    else if (lower === 'x-api-key') headers[name] = maskSecret(v);
    else headers[name] = v.length > 500 ? `${v.slice(0, 500)}…` : v;
  }

  const bodyForLog = { ...parsedBody };
  if (Array.isArray(bodyForLog.Passengers)) {
    bodyForLog.Passengers = `[${(bodyForLog.Passengers as unknown[]).length} passengers — omitted from log]` as unknown;
  }
  if ('token' in bodyForLog) {
    const t = bodyForLog.token;
    bodyForLog.token =
      typeof t === 'string' && t ? (`(omitted — use Authorization header) ${maskSecret(t)}` as unknown) : t;
  }

  console.log('\n========== COMMIT-BOOKING: INCOMING (client → Next) ==========');
  console.log('URL:', url);
  console.log('Query params:', queryParams);
  console.log('Headers:', headers);
  console.log('Body (params, Passengers omitted):', stringifyForLog(bodyForLog));
  if (Array.isArray(parsedBody.Passengers)) {
    console.log(
      'Passengers JSON (full — verify PAN / field names):',
      stringifyForLog(parsedBody.Passengers),
    );
  }
  console.log('Full request JSON (client → Next):', stringifyForLog(parsedBody));
  console.log('================================================================\n');
}

function bodyForUpstreamLog(data: Record<string, unknown>): Record<string, unknown> {
  const b = { ...data };
  if (Array.isArray(b.Passengers)) {
    b.Passengers = `[${(b.Passengers as unknown[]).length} passengers — omitted from log]` as unknown;
  }
  return b;
}

function stringifyForLog(value: unknown, maxLen = COMMIT_BOOKING_LOG_BODY_MAX): string {
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}\n… (truncated after ${maxLen} chars)`;
  } catch {
    return String(value).slice(0, maxLen);
  }
}

function logOutgoingToMt(
  apiUrl: string,
  headers: { 'Content-Type': string; 'X-API-KEY': string; Authorization: string },
  bookingData: Record<string, unknown>,
) {
  console.log('\n========== COMMIT-BOOKING: OUTGOING (Next → vivapi-mt) ==========');
  console.log('URL:', apiUrl);
  console.log('Method: POST');
  console.log('Headers:', {
    'Content-Type': headers['Content-Type'],
    'X-API-KEY': maskSecret(headers['X-API-KEY']),
    Authorization: maskBearerHeader(headers.Authorization),
  });
  console.log('Body (params, Passengers omitted):', stringifyForLog(bodyForUpstreamLog(bookingData)));
  if (Array.isArray(bookingData.Passengers)) {
    console.log(
      'Passengers JSON (full — sent to vivapi-mt, verify PAN):',
      stringifyForLog(bookingData.Passengers),
    );
  }
  console.log('Full upstream JSON (Next → vivapi-mt):', stringifyForLog(bookingData));
  console.log('==================================================================\n');
}

function logIncomingFromMt(apiUrl: string, response: Response, result: unknown, responseTimeMs: number) {
  console.log('\n========== COMMIT-BOOKING: INCOMING (vivapi-mt → Next) ==========');
  console.log('URL:', apiUrl);
  console.log('Status:', response.status, response.statusText);
  console.log('Response time (ms):', responseTimeMs);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));
  console.log('Body (parsed JSON or raw):', stringifyForLog(result));
  console.log('==================================================================\n');
}

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    const raw = await request.json();
    const body =
      raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const auth =
      request.headers.get('authorization')?.trim() ||
      request.headers.get('Authorization')?.trim() ||
      '';
    const bearerMatch = /^Bearer\s+(.+)$/i.exec(auth);
    const token = bearerMatch?.[1]?.trim() ?? '';
    if (!token) {
      return NextResponse.json(
        { error: 'Missing Authorization Bearer token' },
        { status: 401 },
      );
    }

    logIncomingFromClient(request, body);

    const { token: _omitToken, ...bookingData } = body;

    const apiUrl = `${API_BASE_URL_MT}/flight/service/commit-booking`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY,
      'Authorization': `Bearer ${token}`,
    };

    logOutgoingToMt(apiUrl, headers, bookingData as Record<string, unknown>);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bookingData),
    });

    const responseTime = Date.now() - startTime;
    const bodyText = await response.text();
    let result: any = {};
    if (bodyText.trim()) {
      try {
        result = JSON.parse(bodyText);
      } catch {
        result = { raw: bodyText.slice(0, 500) };
      }
    }

    logIncomingFromMt(apiUrl, response, result, responseTime);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `HTTP ${response.status}`,
          message: result?.message ?? result?.Message,
          request_id: result?.request_id ?? result?.requestId,
          gatewayTimeout: response.status === 504,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('\n========== COMMIT-BOOKING: ERROR (Next handler) ==========');
    console.error('Error:', message);
    console.error('=========================================================\n');
    return NextResponse.json(
      { error: `Commit booking failed: ${message}` },
      { status: 500 },
    );
  }
}
