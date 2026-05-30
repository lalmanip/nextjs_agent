import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/config';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/constants';
import { getErrorMessage } from '@/utils';
import { API_BASE_URL } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, ResultToken, FareClass, AdultCount, ChildCount, InfantCount } = body;

    console.log('\n========== ADV-SEARCH (PRICE) API REQUEST ==========');
    console.log('token present:', !!token, '| token prefix:', token?.substring(0, 30));
    console.log('ResultToken:', ResultToken?.substring?.(0, 80) || ResultToken);
    console.log('FareClass:', FareClass);
    console.log('Pax:', { AdultCount, ChildCount, InfantCount });

    if (!token || !ResultToken || !FareClass) {
      console.error('VALIDATION FAILED — missing:', { token: !!token, ResultToken: !!ResultToken, FareClass: !!FareClass });
      return NextResponse.json(
        { error: 'Missing required fields: token, ResultToken, FareClass' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const apiUrl = `${API_BASE_URL}/flight/service/adv-search`;
    console.log('URL:', apiUrl);
    console.log('Payload:', JSON.stringify({ ResultToken, FareClass, AdultCount, ChildCount, InfantCount }, null, 2));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_CONFIG.API_KEY,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ ResultToken, FareClass, AdultCount, ChildCount, InfantCount }),
    });

    console.log('Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Adv-Search Error:', errorText);
      return NextResponse.json(
        { error: 'Advanced flight pricing failed', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Full Response:', JSON.stringify(result, null, 2).substring(0, 1000));
    console.log('=====================================================\n');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Adv-Search Exception:', error);
    return NextResponse.json(
      { error: 'Advanced flight pricing failed', message: getErrorMessage(error) },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
