import { readAccessTokenFromAuthResponse } from '@/lib/serverTokenCache';

export type UserAuthLoginOptions = {
  userName: string;
  password: string;
  authBaseUrl: string;
  userBaseUrl: string;
  apiKey: string;
  requiredUserType?: number;
  rejectInactiveB2b?: boolean;
};

type GenericUserEnvelope = {
  status?: string;
  message?: string | null;
  response?: Record<string, unknown> | null;
};

function readAuthErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const obj = data as Record<string, unknown>;
  const message = obj.message ?? obj.error;
  if (typeof message === 'string' && message.trim()) return message.trim();
  return fallback;
}

/** Login via vivapi-auth, then load profile from GET /user/me (replaces deprecated /user/authenticate). */
export async function loginViaAuthGatewayAndFetchProfile(
  opts: UserAuthLoginOptions,
): Promise<GenericUserEnvelope> {
  const authBase = opts.authBaseUrl.replace(/\/$/, '');
  const userBase = opts.userBaseUrl.replace(/\/$/, '');

  const loginRes = await fetch(`${authBase}/vivapi-auth/user/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': opts.apiKey,
    },
    body: JSON.stringify({
      username: String(opts.userName ?? '').trim(),
      password: String(opts.password ?? ''),
    }),
  });

  const loginText = await loginRes.text().catch(() => '');
  let loginJson: Record<string, unknown> | null = null;
  try {
    loginJson = loginText ? (JSON.parse(loginText) as Record<string, unknown>) : null;
  } catch {
    return {
      status: 'failed',
      message: 'Invalid JSON from auth service',
      response: null,
    };
  }

  if (!loginRes.ok) {
    return {
      status: 'failed',
      message: readAuthErrorMessage(loginJson, 'Invalid credentials'),
      response: null,
    };
  }

  const accessToken = readAccessTokenFromAuthResponse(loginJson ?? {});
  if (!accessToken) {
    return {
      status: 'failed',
      message: 'Auth service did not return an access token',
      response: null,
    };
  }

  const meRes = await fetch(`${userBase}/user/me`, {
    method: 'GET',
    headers: {
      'X-API-KEY': opts.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const meText = await meRes.text().catch(() => '');
  let meJson: GenericUserEnvelope | null = null;
  try {
    meJson = meText ? (JSON.parse(meText) as GenericUserEnvelope) : null;
  } catch {
    return {
      status: 'failed',
      message: 'Invalid JSON from user service',
      response: null,
    };
  }

  if (!meRes.ok || meJson?.status !== 'success' || !meJson.response) {
    return {
      status: 'failed',
      message: readAuthErrorMessage(meJson, 'Unable to load user profile'),
      response: null,
    };
  }

  const profile = meJson.response;
  const userType = profile.userType;
  if (opts.requiredUserType != null && userType !== opts.requiredUserType) {
    return {
      status: 'failed',
      message: 'Invalid credentials',
      response: null,
    };
  }

  if (
    opts.rejectInactiveB2b &&
    userType === 3 &&
    profile.status === 0
  ) {
    return {
      status: 'failed',
      message: 'User has not been activated yet',
      response: null,
    };
  }

  return {
    status: 'success',
    message: null,
    response: profile,
  };
}
