import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_MT, API_KEY } from '@/lib/config';
import { isFlightHoldFeatureEnabled } from '@/lib/flightHoldConfig';
import { bearerPreview } from '@/lib/mtPaymentAuth';

export const dynamic = 'force-dynamic';

async function callInitiatePayment(
  backendEndpoint: string,
  bearerJwt: string,
  callLabel: string,
) {
  const jwt = String(bearerJwt || '').trim();
  console.log(`\n--- BACKEND initiatePayment (${callLabel}) ---`);
  console.log('Authorization bearer:', bearerPreview(jwt));
  console.log(`Bearer suffix (last 12): …${jwt.slice(-12)}`);
  const startTime = Date.now();
  const response = await fetch(backendEndpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY,
      'Authorization': `Bearer ${jwt}`,
    },
  });
  const duration = Date.now() - startTime;
  return { response, duration };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resultToken = searchParams.get('resultToken');
    const returnResultToken = searchParams.get('returnResultToken');
    const tripType = searchParams.get('tripType') || 'oneway';
    const obFare = searchParams.get('obFare');
    const ibFare = searchParams.get('ibFare');
    const holdBooking = searchParams.get('holdBooking');
    const authHeader = request.headers.get('authorization');

    console.log('\n========== INITIATE PAYMENT API ==========');
    console.log('Timestamp:', new Date().toISOString());
    console.log('\n--- REQUEST DETAILS ---');
    console.log('Client Endpoint:', '/api/payment/order');
    console.log('Method:', 'GET');
    console.log('Query Params:', { resultToken: resultToken?.substring(0, 40) + '...', returnResultToken: returnResultToken?.substring(0, 40), tripType, obFare, ibFare, holdBooking });
    console.log('Request Headers:', { 'Authorization': authHeader?.substring(0, 15) + '...' + authHeader?.slice(-5) });

    if (!resultToken || !authHeader) {
      console.error('\n❌ Missing parameters: resultToken or authorization');
      console.log('==========================================\n');
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    const q = new URLSearchParams({ resultToken, tripType: tripType || 'oneway' });
    if (returnResultToken) q.set('returnResultToken', returnResultToken);
    if (obFare) q.set('obFare', obFare);
    if (ibFare) q.set('ibFare', ibFare);
    if (
      isFlightHoldFeatureEnabled() &&
      (holdBooking === '1' || holdBooking === 'true')
    ) {
      q.set('holdBooking', '1');
    }
    const backendEndpoint = `${API_BASE_URL_MT}/flight/service/initiatePayment?${q.toString()}`;

    console.log('\n--- BACKEND ENDPOINT ---');
    console.log('Full URL:', backendEndpoint);

    console.log('\n--- SENDING REQUEST TO BACKEND ---');
    const { response, duration } = await callInitiatePayment(
      backendEndpoint,
      bearerToken,
      'client Bearer JWT (MT flight session)',
    );

    console.log('\n--- BACKEND RESPONSE ---');
    console.log('Status Code:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Response Time:', `${duration}ms`);
    console.log('Response Headers:', {
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length'),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('\n❌ BACKEND ERROR');
      console.error('Status:', response.status);
      console.error('Error Response:', responseText.substring(0, 1000));
      console.log('==========================================\n');
      try {
        const parsed = JSON.parse(responseText);
        return NextResponse.json(parsed, { status: response.status });
      } catch {
        return NextResponse.json(
          { error: 'initiatePayment failed', detail: responseText.slice(0, 2000) },
          { status: response.status },
        );
      }
    }

    console.log('\n--- RAW RESPONSE BODY ---');
    console.log('Length:', responseText.length, 'characters');
    console.log('Content:', responseText.substring(0, 1000) + (responseText.length > 1000 ? '...' : ''));

    if (!responseText.trim()) {
      console.error('\n❌ EMPTY RESPONSE');
      console.log('==========================================\n');
      throw new Error('Empty response from initiatePayment API');
    }

    let result;
    try {
      result = JSON.parse(responseText);
      console.log('\n--- PARSED JSON RESPONSE ---');
      console.log('Parsed Successfully: ✓');
      console.log('Response Object:', JSON.stringify(result, null, 2).substring(0, 1000));
    } catch (parseError) {
      console.error('\n❌ JSON PARSE ERROR:', parseError);
      console.log('==========================================\n');
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    console.log('\n--- FINAL RESPONSE TO CLIENT ---');
    console.log('Status: 200 OK');
    console.log('Body:', JSON.stringify(result, null, 2).substring(0, 1000));
    console.log('==========================================\n');

    return NextResponse.json(result);
  } catch (error) {
    console.error('\n❌ EXCEPTION CAUGHT');
    console.error('Error Message:', error instanceof Error ? error.message : String(error));
    console.log('==========================================\n');
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 });
  }
}
