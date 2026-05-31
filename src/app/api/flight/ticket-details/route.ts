import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_USER, API_KEY } from '@/lib/config';
import { getServerDomainTokenCached, invalidateServerDomainToken } from '@/lib/serverTokenCache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appReference = searchParams.get('appReference');

    if (!appReference) {
      return NextResponse.json({ error: 'AppReference is required' }, { status: 400 });
    }

    const url = `${API_BASE_URL_USER}/flight-booking/show/${appReference}`;

    const doFetch = (token: string) =>
      fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

    let token = await getServerDomainTokenCached();
    let response = await doFetch(token);

    if (response.status === 401) {
      console.warn('[ticket-details] Token expired (401) — refreshing and retrying');
      invalidateServerDomainToken();
      token = await getServerDomainTokenCached();
      response = await doFetch(token);
    }

    console.log('[ticket-details] API URL:', url);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${errorText}` },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Ticket details failed: ${message}` }, { status: 500 });
  }
}
