import { readAccessTokenFromAuthResponse } from '@/lib/serverTokenCache';

export type AuthGatewayRegisterInput = {
  /** Login id — email or alphanumeric (B2B agents). */
  userName?: string;
  email?: string;
  password: string;
  firstName: string;
  lastName: string;
  countryCode?: number;
  /** B2B agent = 3. Omit for B2C default (4). */
  userType?: number;
  /** 0 = pending activation (B2B), 1 = active. */
  status?: number;
};

export type AuthGatewayRegisterResult =
  | { ok: true; userId: string; accessToken: string }
  | { ok: false; status: number; message: string };

function readAuthErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const obj = data as Record<string, unknown>;
  const message = obj.message ?? obj.error;
  if (typeof message === 'string' && message.trim()) return message.trim();
  return fallback;
}

function readAuthUserId(data: Record<string, unknown>): string {
  return String(data.userId ?? data.user_id ?? '').trim();
}

function resolveLoginId(input: AuthGatewayRegisterInput): string {
  const userName = String(input.userName ?? '').trim();
  const email = String(input.email ?? '').trim();
  return userName || email;
}

/** Creates credentials in vivapi-auth (BCrypt). Required before sign-in via /user/auth/login. */
export async function registerViaAuthGateway(
  authBaseUrl: string,
  apiKey: string,
  input: AuthGatewayRegisterInput,
): Promise<AuthGatewayRegisterResult> {
  const authBase = authBaseUrl.replace(/\/$/, '');
  const loginId = resolveLoginId(input);

  const body: Record<string, unknown> = {
    password: input.password,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    userName: loginId,
    email: loginId.includes('@') ? loginId : undefined,
    ...(input.countryCode != null ? { countryCode: input.countryCode } : {}),
    ...(input.userType != null ? { userType: input.userType } : {}),
    ...(input.status != null ? { status: input.status } : {}),
  };

  const res = await fetch(`${authBase}/vivapi-auth/user/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => '');
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    return { ok: false, status: res.status || 502, message: 'Invalid JSON from auth service' };
  }

  if (!res.ok) {
    console.warn('[userAuthGateway] register failed', res.status, text.slice(0, 500));
    return {
      ok: false,
      status: res.status,
      message: readAuthErrorMessage(json, 'Registration failed'),
    };
  }

  const accessToken = readAccessTokenFromAuthResponse(json ?? {});
  const userId = readAuthUserId(json ?? {});
  if (!userId) {
    return { ok: false, status: 502, message: 'Auth service did not return userId' };
  }

  return { ok: true, userId, accessToken };
}
