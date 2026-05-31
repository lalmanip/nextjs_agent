import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_MT, API_KEY } from '@/lib/config';

export const dynamic = 'force-dynamic';

async function callValidatePayment(
  backendEndpoint: string,
  body: object,
  authorization: string,
) {
  const startTime = Date.now();
  const response = await fetch(backendEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY,
      Authorization: authorization,
    },
    body: JSON.stringify(body),
  });
  const duration = Date.now() - startTime;
  return { response, duration };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('authorization');

    const vivapiBody = { ...(body as Record<string, unknown>) };
    // Forward the OB ResultToken to the backend (PascalCase, matching the other vivapi-mt
    // flight endpoints). The client sends it as `resultToken`; normalize the casing here.
    const resultTokenValue = vivapiBody.ResultToken ?? vivapiBody.resultToken;
    delete vivapiBody.resultToken;
    if (resultTokenValue != null && resultTokenValue !== '') {
      vivapiBody.ResultToken = resultTokenValue;
    } else {
      delete vivapiBody.ResultToken;
    }

    console.log('\n========== PAYMENT VALIDATION API ==========');
    console.log('Timestamp:', new Date().toISOString());
    console.log('\n--- REQUEST DETAILS ---');
    console.log('Client Endpoint:', '/api/payment/validate');
    console.log('Method:', 'POST');
    console.log('Request Body:', JSON.stringify(body, null, 2));
    console.log('Request Headers:', {
      Authorization: authHeader?.substring(0, 15) + '...' + authHeader?.slice(-5),
    });

    if (!authHeader) {
      console.error('\n❌ Missing authorization header');
      console.log('==========================================\n');
      return NextResponse.json({ error: 'Missing authorization' }, { status: 400 });
    }

    const backendEndpoint = `${API_BASE_URL_MT}/flight/service/validatePayment`;

    console.log('\n--- BACKEND ENDPOINT ---');
    console.log('Full URL:', backendEndpoint);
    console.log('Base URL:', API_BASE_URL_MT);
    console.log('Path:', '/vivapi-mt/flight/service/validatePayment');

    console.log('\n--- BACKEND REQUEST HEADERS ---');
    console.log('Content-Type:', 'application/json');
    console.log('X-API-KEY:', API_KEY);
    console.log('Authorization:', authHeader?.substring(0, 15) + '...' + authHeader?.slice(-5));

    console.log('\n--- BACKEND REQUEST BODY ---');
    console.log(JSON.stringify(vivapiBody, null, 2));

    console.log('\n--- SENDING REQUEST TO BACKEND ---');
    const { response, duration } = await callValidatePayment(backendEndpoint, vivapiBody, authHeader);

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
      console.error('Error Response:', responseText);
      console.log('==========================================\n');
      try {
        const parsed = JSON.parse(responseText);
        return NextResponse.json(parsed, { status: response.status });
      } catch {
        return NextResponse.json(
          { error: 'validatePayment failed', detail: responseText.slice(0, 2000) },
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
      throw new Error('Empty response from validation API');
    }

    let result;
    try {
      result = JSON.parse(responseText);
      console.log('\n--- PARSED JSON RESPONSE ---');
      console.log('Parsed Successfully: ✓');
      console.log('Response Object:', JSON.stringify(result, null, 2).substring(0, 1000));
    } catch (parseError) {
      console.error('\n❌ JSON PARSE ERROR');
      console.error('Error:', parseError);
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
    console.error('Error Type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error Message:', error instanceof Error ? error.message : String(error));
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
    console.log('==========================================\n');
    return NextResponse.json({ error: 'Failed to validate payment' }, { status: 500 });
  }
}
