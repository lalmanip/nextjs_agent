import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_MT, API_KEY } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resultToken, token } = body;
    
    console.log('=== FARE QUOTE API CALL DETAILS ===');
    console.log('URL:', `${API_BASE_URL_MT}/flight/service/update-fare-quote`);
    console.log('Method:', 'POST');
    console.log('Headers:', JSON.stringify({
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY,
      'Authorization': `Bearer ${token}`
    }, null, 2));
    console.log('Body:', JSON.stringify({ ResultToken: resultToken }, null, 2));
    console.log('===================================');
    
    if (!resultToken || !token) {
      console.error('Missing parameters - resultToken:', !!resultToken, 'token:', !!token);
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
console.log('update-fare-quote API URL:', `${API_BASE_URL_MT}/flight/service/update-fare-quote`);
    const response = await fetch(`${API_BASE_URL_MT}/flight/service/update-fare-quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ ResultToken: resultToken }),
    });

    console.log('Fare Quote API Response Status:', response.status);
    console.log('Fare Quote API Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fare Quote API Error Response:', errorText);
      return NextResponse.json(
        { error: `HTTP ${response.status}`, detail: errorText },
        { status: response.status }
      );
    }

    const responseText = await response.text();
    console.log('Fare Quote API Raw Response:', responseText.substring(0, 1000));
    
    if (!responseText.trim()) {
      throw new Error('Empty response from fare quote API');
    }
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Fare Quote API Error:', error);
    return NextResponse.json({ error: 'Failed to update fare quote' }, { status: 500 });
  }
}