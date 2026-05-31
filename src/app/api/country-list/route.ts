import { NextResponse } from 'next/server';
import { API_BASE_URL_USER, API_KEY } from '@/lib/config';
import {
  forceFreshServerDomainToken,
  getServerDomainTokenCached,
  refreshServerDomainTokenCached,
} from '@/lib/serverTokenCache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = `${API_BASE_URL_USER}/api-country-list/all`;

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
      console.warn('[country-list] 401 — refresh domain access token then retry');
      token = await refreshServerDomainTokenCached();
      response = await doFetch(token);
    }
    if (response.status === 401) {
      console.warn('[country-list] 401 after refresh — force new login then retry');
      token = await forceFreshServerDomainToken();
      response = await doFetch(token);
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    const raw: any[] = Array.isArray(result)
      ? result
      : Array.isArray(result?.response)
      ? result.response
      : [];

    const normalized = raw
      .map((c: any) => ({
        isoCountryCode: c.isoCountryCode || c.IsoCountryCode || '',
        countryName: c.countryName || c.CountryName || c.name || '',
        countryCode: c.countryCode || c.CountryCode || '',
      }))
      .filter((c: any) => c.isoCountryCode);

    return NextResponse.json(normalized);
  } catch {
    return NextResponse.json([{ isoCountryCode: 'IN', countryName: 'India', countryCode: '+91' }]);
  }
}
