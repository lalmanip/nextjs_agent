import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_AUTH, API_KEY } from '@/lib/config';
import { vivAuthHttpJson, warnIfGlobalFetchProxyEnvOnce } from '@/lib/vivAuthHttpClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const refreshToken = String((body as any)?.refreshToken ?? '').trim();
    if (!refreshToken) {
      return NextResponse.json({ error: 'refreshToken required' }, { status: 400 });
    }

    const refreshUrl = `${API_BASE_URL_AUTH}/vivapi-auth/app/auth/refresh`;
    const start = Date.now();
    console.log('=== [refresh-token] BEGIN ===');
    console.log('[refresh-token] Endpoint:', refreshUrl);
    console.log('[refresh-token] Incoming headers:', {
      'content-type': request.headers.get('content-type'),
      'user-agent': request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      origin: request.headers.get('origin'),
    });
    console.log('[refresh-token] Incoming params:', Object.fromEntries(new URL(request.url).searchParams));
    console.log('[refresh-token] Incoming body (safe):', {
      refreshToken: refreshToken ? `[len=${refreshToken.length}] …${refreshToken.slice(-8)}` : '(missing)',
    });

    warnIfGlobalFetchProxyEnvOnce('refresh-token route');

    const out = await vivAuthHttpJson({
      url: refreshUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY,
      },
      body: JSON.stringify({ refreshToken }),
    });

    const ms = Date.now() - start;
    const text = out.rawBody;

    if (out.statusCode < 200 || out.statusCode >= 300) {
      console.error('[refresh-token] Upstream response:', {
        status: out.statusCode,
        ok: false,
        durationMs: ms,
        contentType: out.contentType,
        bodyPreview: text.slice(0, 1000),
        transport: 'node:http (direct)',
      });
      console.log('=== [refresh-token] END (failed) ===');
      return NextResponse.json({ error: 'Refresh failed', detail: text }, { status: out.statusCode || 502 });
    }

    const data = (text ? JSON.parse(text) : {}) as any;
    console.log('[refresh-token] Upstream response:', {
      status: out.statusCode,
      ok: true,
      durationMs: ms,
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
    console.log('[refresh-token] Success — new token issued');
    console.log('=== [refresh-token] END (ok) ===');
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[refresh-token] Exception:', msg);
    console.log('=== [refresh-token] END (exception) ===');
    return NextResponse.json({ error: 'Refresh failed', message: msg }, { status: 500 });
  }
}
