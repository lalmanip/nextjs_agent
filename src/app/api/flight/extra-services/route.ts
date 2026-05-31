import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_MT, API_KEY } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ResultToken, ExtraBaggageFee, ExtraMealFee, ExtraSeatFee, BasicFare, Tax, token } = body;

    if (!ResultToken || !token) {
      return NextResponse.json({ error: 'Missing ResultToken or token' }, { status: 400 });
    }

    const payload: any = {
      ResultToken,
      ExtraBaggageFee: ExtraBaggageFee ?? 0,
      ExtraMealFee: ExtraMealFee ?? 0,
      ExtraSeatFee: ExtraSeatFee ?? 0,
    };
    if (BasicFare !== undefined) payload.BasicFare = BasicFare;
    if (Tax !== undefined) payload.Tax = Tax;

    console.log('=== EXTRA SERVICES API ===');
    console.log('URL:', `${API_BASE_URL_MT}/flight/service/extra-services`);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${API_BASE_URL_MT}/flight/service/extra-services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('Extra Services API Response Status:', response.status);

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Extra Services API Error:', responseText);
      try {
        const parsed = JSON.parse(responseText);
        return NextResponse.json(parsed, { status: response.status });
      } catch {
        return NextResponse.json(
          { error: `HTTP ${response.status}`, detail: responseText.slice(0, 2000) },
          { status: response.status },
        );
      }
    }

    if (!responseText.trim()) {
      return NextResponse.json({ success: true });
    }

    const result = JSON.parse(responseText);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Extra Services API Error:', error);
    return NextResponse.json({ error: 'Failed to save extra services' }, { status: 500 });
  }
}
