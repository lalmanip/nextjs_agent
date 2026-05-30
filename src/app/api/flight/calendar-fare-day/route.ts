import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_MT, API_KEY } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, ...searchData } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const apiUrl = `${API_BASE_URL_MT}/flight/service/get-calendar-fare-of-day`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(searchData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: 'Calendar fare of day failed', details: errorText }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Calendar fare of day failed', message }, { status: 500 });
  }
}
