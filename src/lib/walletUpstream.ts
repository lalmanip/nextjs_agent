import { API_BASE_URL_USER, API_KEY } from "@/lib/config";
import {
  getServerDomainTokenCached,
  refreshServerDomainTokenCached,
} from "@/lib/serverTokenCache";

const API_HEADERS = {
  "Content-Type": "application/json",
  "X-API-KEY": API_KEY,
};

function bearerPreview(authHeader: string) {
  const raw = String(authHeader || "").trim();
  if (!raw) return "(missing)";
  const token = raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : raw;
  if (!token) return "(missing)";
  if (token.length <= 24) return `[len=${token.length}] ${token}`;
  return `[len=${token.length}] ${token.slice(0, 10)}…${token.slice(-6)}`;
}

function isTokenExpired(status: number, responseText: string): boolean {
  if (status === 401 || status === 403) return true;
  if (/token\s*expired/i.test(responseText) || /jwt\s*expired/i.test(responseText)) return true;
  try {
    const j = JSON.parse(responseText);
    const msg = String(j?.message ?? j?.Message ?? j?.error ?? j?.Error ?? "").toLowerCase();
    return (
      (msg.includes("token") && msg.includes("expir")) ||
      msg.includes("jwt expired") ||
      msg.includes("unauthorized")
    );
  } catch {
    return false;
  }
}

export async function callUserWalletUpstream(
  method: string,
  userId: string,
  pathSuffix: string,
  body?: unknown,
  logLabel = "WALLET API",
) {
  const endpoint = `${API_BASE_URL_USER}/user/b2b/wallet/${encodeURIComponent(userId)}${pathSuffix}`;
  const token = await getServerDomainTokenCached();
  const headers = { ...API_HEADERS, Authorization: `Bearer ${token}` };

  console.log(`\n========== ${logLabel} ==========`);
  console.log("Timestamp:", new Date().toISOString());
  console.log("Endpoint:", endpoint);
  console.log("Method:", method);
  console.log("Headers (safe):", {
    "x-api-key": API_KEY ? `${String(API_KEY).slice(0, 6)}…` : "(missing)",
    authorization: bearerPreview(headers.Authorization),
  });
  if (body !== undefined) {
    console.log("Request Body:", JSON.stringify(body, null, 2).slice(0, 2000));
  }

  const doCall = async (h: Record<string, string>) => {
    const start = Date.now();
    const response = await fetch(endpoint, {
      method,
      headers: h,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const durationMs = Date.now() - start;
    const responseText = await response.text().catch(() => "");
    return { response, durationMs, responseText };
  };

  let { response, durationMs, responseText } = await doCall(headers);

  if (isTokenExpired(response.status, responseText)) {
    console.warn(`[${logLabel}] Token expired — refreshing and retrying`);
    const fresh = await refreshServerDomainTokenCached();
    ({ response, durationMs, responseText } = await doCall({
      ...headers,
      Authorization: `Bearer ${fresh}`,
    }));
  }

  console.log("--- RESPONSE FROM BACKEND ---");
  console.log("Status:", response.status, response.statusText);
  console.log("Response Time:", `${durationMs}ms`);
  console.log("Response Body:", responseText.slice(0, 2000));
  console.log("=================================\n");

  let result: unknown = null;
  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch {
    return {
      ok: false as const,
      status: 502,
      data: { error: "Invalid JSON from wallet service", raw: responseText.slice(0, 500) },
    };
  }

  return { ok: response.ok, status: response.status, data: result };
}
