import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_AUTH, API_KEY } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Proxy to POST /vivapi-auth/user/auth/change-password (BCrypt).
 * Requires Authorization: Bearer <user access token>.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json(
        { status: 'failed', message: 'Missing Authorization Bearer token' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { status: 'failed', message: 'currentPassword and newPassword are required' },
        { status: 400 },
      );
    }

    const backendEndpoint = `${API_BASE_URL_AUTH}/vivapi-auth/user/auth/change-password`;

    const response = await fetch(backendEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY,
        Authorization: authHeader,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const responseText = await response.text();
    let result: Record<string, unknown> = {};
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      return NextResponse.json(
        { status: 'failed', message: 'Invalid response from auth service' },
        { status: 502 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'failed',
          message:
            (typeof result.error === 'string' && result.error) ||
            (typeof result.message === 'string' && result.message) ||
            'Failed to change password',
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      status: 'success',
      message:
        (typeof result.message === 'string' && result.message) ||
        'Password changed successfully. Please sign in again.',
    });
  } catch (error) {
    console.error('Change password proxy error:', error);
    return NextResponse.json(
      { status: 'failed', message: 'Failed to change password' },
      { status: 500 },
    );
  }
}
