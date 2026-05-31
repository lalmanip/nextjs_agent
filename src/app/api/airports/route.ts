import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_MT, API_KEY } from '@/lib/config';
import { getServerDomainTokenCached, invalidateServerDomainToken } from '@/lib/serverTokenCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("query") || "").trim();
    const limit = Math.max(1, Math.min(20, Number(searchParams.get("limit") || 10)));

    // Minimum 2 chars (frontend will also enforce)
    if (query.length < 2) return NextResponse.json([]);

    const airportsUrl = `${API_BASE_URL_MT}/airport/locations?query=${encodeURIComponent(query)}&limit=${encodeURIComponent(
      String(limit)
    )}`;
    console.log('Airports API URL:', airportsUrl);
    const authHeader = request.headers.get('authorization')?.trim();
    const bearerFromClient =
      authHeader && /^Bearer\s+/i.test(authHeader) ? authHeader : null;

    const doFetch = (authorizationValue: string) =>
      fetch(airportsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
          Authorization: authorizationValue,
        },
        cache: 'no-store',
      });

    let authorizationHeader =
      bearerFromClient || `Bearer ${await getServerDomainTokenCached()}`;
    let response = await doFetch(authorizationHeader);

    if (response.status === 401) {
      console.warn('[airports] Token rejected (401) — refreshing domain token and retrying once');
      invalidateServerDomainToken();
      const fresh = await getServerDomainTokenCached();
      authorizationHeader = `Bearer ${fresh}`;
      response = await doFetch(authorizationHeader);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    // Backend may return a raw array or a wrapper object
    const raw: any[] = Array.isArray(result)
      ? result
      : Array.isArray(result?.response)
      ? result.response
      : Array.isArray(result?.data)
      ? result.data
      : [];

    // Normalize field names: backend uses `airportCity` and `country`
    // while the frontend Airport interface expects `cityName` and `countryName`
    const normalized = raw
      .map((a: any) => ({
        airportCode:  a.airportCode  || a.AirportCode  || a.iataCode       || '',
        airportName:  a.airportName  || a.AirportName  || a.name           || '',
        cityName:     a.cityName     || a.CityName     || a.airportCity    || a.city || '',
        countryName:  a.countryName  || a.CountryName  || a.country        || '',
      }))
      .filter((a: any) => a.airportCode);

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Airports API Error:', error);
    return NextResponse.json([]);
  }
}