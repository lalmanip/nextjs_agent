import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/config';
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

    const apiUrl = `${API_BASE_URL}/flight/service/pre-adv-search`;

    console.log('\n========== PRE-ADV-SEARCH API REQUEST ==========');
    console.log('URL:', apiUrl);
    console.log('Body:', JSON.stringify(searchData, null, 2));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_CONFIG.API_KEY,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(searchData),
    });

    console.log('Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pre-Adv-Search Error:', errorText);
      return NextResponse.json(
        { error: 'Advance flight search failed', details: errorText, status: response.status },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Full Response:', JSON.stringify(result, null, 2).substring(0, 1000));
    console.log('=================================================\n');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Pre-Adv-Search Exception:', error);
    return NextResponse.json(
      { error: 'Advance flight search failed', message: getErrorMessage(error) },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
