import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG, API_ENDPOINTS } from '@/config';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/constants';
import { getErrorMessage } from '@/utils';
import { API_BASE_URL } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, ...searchData } = body;

    if (!token) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.TOKEN_REQUIRED },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    console.log('\n========== FLIGHT SEARCH API REQUEST ==========');
    console.log('Timestamp:', new Date().toISOString());
    console.log('\n--- REQUEST DETAILS ---');
    console.log('Endpoint: /api/flight/search');
    console.log('Method: POST');
    console.log('Authorization Token:', token.substring(0, 15) + '...' + token.slice(-5));
    console.log('\n--- REQUEST BODY ---');
    console.log(JSON.stringify(searchData, null, 2));

    const apiUrl = `${API_BASE_URL}${API_ENDPOINTS.FLIGHT.SEARCH}`;
    console.log('\n--- BACKEND ENDPOINT ---');
    console.log('URL:', apiUrl);
    console.log('Method: POST');
    console.log('Headers:', JSON.stringify({
      'Content-Type': 'application/json',
      'X-API-KEY': API_CONFIG.API_KEY,
      'Authorization': `Bearer ${token.substring(0, 15)}...${token.slice(-5)}`
    }, null, 2));
    console.log('Body:', JSON.stringify(searchData, null, 2));
    
    console.log('\n--- SENDING REQUEST TO BACKEND ---');
    const startTime = Date.now();
    
    const response = await fetch(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_CONFIG.API_KEY,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(searchData)
      }
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('\n--- BACKEND RESPONSE ---');
    console.log('Status Code:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Response Time:', `${duration}ms`);
    console.log('Response Headers:', {
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length'),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ BACKEND ERROR');
      console.error('Status:', response.status);
      console.error('Error Response:', errorText);
      console.log('==============================================\n');
      
      return NextResponse.json(
        { 
          error: 'Flight search failed',
          details: errorText,
          status: response.status 
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('\n--- PARSED RESPONSE ---');
    console.log('Response Status:', result.status);
    console.log('Flights Found:', result.search?.flightDataList?.journeyList?.[0]?.length || 0);
    console.log('Full Response:', JSON.stringify(result, null, 2).substring(0, 1000));
    console.log('==============================================\n');
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('\n❌ EXCEPTION CAUGHT');
    console.error('Error Type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error Message:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    console.log('==============================================\n');
    
    return NextResponse.json(
      { 
        error: 'Flight search failed',
        message: getErrorMessage(error)
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}