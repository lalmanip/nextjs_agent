import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_AUTH, API_KEY } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Proxy to POST /vivapi-auth/user/auth/reset-password (BCrypt).
 * Body from client: { pwdToken, password } → auth: { token, newPassword }.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pwdToken, password, token, newPassword } = body;

    const resetToken = String(pwdToken || token || '').trim();
    const nextPassword = String(password || newPassword || '');

    if (!resetToken || !nextPassword) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const backendEndpoint = `${API_BASE_URL_AUTH}/vivapi-auth/user/auth/reset-password`;

    const response = await fetch(backendEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY,
      },
      body: JSON.stringify({
        token: resetToken,
        newPassword: nextPassword,
      }),
    });

    const responseText = await response.text();
    let result: Record<string, unknown> = {};
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      return NextResponse.json(
        { error: 'Invalid response from auth service' },
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
            'Failed to reset password',
          error: result.error || result.message,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      status: 'success',
      message:
        (typeof result.message === 'string' && result.message) ||
        'Password reset successfully. Please sign in.',
    });
  } catch (error) {
    console.error('Reset password proxy error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
