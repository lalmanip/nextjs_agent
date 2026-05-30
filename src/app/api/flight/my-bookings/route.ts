import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_USER, API_KEY } from '@/lib/config';
import { getServerDomainTokenCached, invalidateServerDomainToken } from '@/lib/serverTokenCache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const url = `${API_BASE_URL_USER}/flight-booking/getMyAllBookings/${encodeURIComponent(email)}`;

  try {
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
      console.warn('[my-bookings] Token expired (401) — refreshing and retrying');
      invalidateServerDomainToken();
      token = await getServerDomainTokenCached();
      response = await doFetch(token);
    }

    console.log('[my-bookings] Status:', response.status, '| Email:', email);

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[my-bookings] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}
