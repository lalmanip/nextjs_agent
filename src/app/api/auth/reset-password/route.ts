import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_USER, API_KEY } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pwdToken, password } = body;

    console.log('\n========== RESET PASSWORD API REQUEST ==========');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Endpoint: /api/auth/reset-password');
    console.log('Method: POST');
    console.log('Request Body:', JSON.stringify({ pwdToken: pwdToken?.substring(0, 20) + '...', password: '***' }, null, 2));

    if (!pwdToken || !password) {
      console.error('❌ Missing parameters');
      console.error('  - pwdToken:', !!pwdToken);
      console.error('  - password:', !!password);
      console.log('================================================\n');
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const backendEndpoint = `${API_BASE_URL_USER}/user/reset`;

    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY,
    };

    const requestBody = {
      pwdToken,
      password,
    };

    console.log('\n--- BACKEND REQUEST ---');
    console.log('URL:', backendEndpoint);
    console.log('Method: POST');
    console.log('Headers:', JSON.stringify(requestHeaders, null, 2));
    console.log('Body:', JSON.stringify({ pwdToken: pwdToken.substring(0, 20) + '...', password: '***' }, null, 2));

    console.log('\n--- SENDING REQUEST ---');
    const startTime = Date.now();

    const response = await fetch(backendEndpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    const responseText = await response.text();

    console.log('\n--- RESPONSE FROM BACKEND ---');
    console.log('Status Code:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Response Time:', `${duration}ms`);
    console.log('Response Headers:', {
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length'),
    });
    console.log('Response Body (Raw):', responseText.substring(0, 1000));

    if (!response.ok) {
      console.error('\n❌ BACKEND ERROR');
      console.error('Status:', response.status);
      console.error('Error Response:', responseText);
      console.log('================================================\n');
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    if (!responseText.trim()) {
      console.error('\n❌ EMPTY RESPONSE');
      console.log('================================================\n');
      throw new Error('Empty response from reset password API');
    }

    let result;
    try {
      result = JSON.parse(responseText);
      console.log('\n--- PARSED RESPONSE ---');
      console.log(JSON.stringify(result, null, 2).substring(0, 1000));
    } catch (parseError) {
      console.error('\n❌ JSON PARSE ERROR');
      console.error('Error:', parseError);
      console.log('================================================\n');
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    console.log('\n--- RETURNING TO CLIENT ---');
    console.log('Status: 200 OK');
    console.log('Body:', JSON.stringify(result, null, 2).substring(0, 1000));
    console.log('================================================\n');

    return NextResponse.json(result);
  } catch (error) {
    console.error('\n❌ EXCEPTION CAUGHT');
    console.error('Error Type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error Message:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    console.log('================================================\n');
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
