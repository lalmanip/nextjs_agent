import type { NextRequest } from "next/server";
import { forceFreshServerDomainToken } from "@/lib/serverTokenCache";

/** Short preview only — avoids logging entire JWT in server logs. */
export function bearerPreview(bearerJwt: string): string {
  const t = String(bearerJwt || "").trim();
  if (!t) return "(empty)";
  if (t.length <= 32) return `[len=${t.length}] ${t}`;
  return `[len=${t.length}] ${t.slice(0, 14)}…${t.slice(-8)}`;
}

/**
 * Fresh domain JWT for vivapi-mt after 401/403 (client-supplied Bearer is stale).
 * Forces a vivapi-auth login (`forceFreshServerDomainToken`) instead of reusing stale cache/in-flight reads.
 *
 * @param expiredBearerJwt — raw JWT (no `Bearer ` prefix) that failed / was rejected; logged in full next to the new token for comparison.
 */
export async function getFreshDomainToken(
  _request?: NextRequest,
  context = "mt-payment",
  expiredBearerJwt?: string,
): Promise<string> {
  const expired = expiredBearerJwt?.trim() ?? "";
  console.log(`[${context}] Forcing NEW domain JWT via vivapi-auth POST`);
  try {
    const token = (await forceFreshServerDomainToken()).trim();
    if (!token) throw new Error("Domain token missing after refresh");
    console.log(`[${context}] ── Token comparison (full strings) ──`);
    console.log(`[${context}] Expired / previous Token:`, expired || "(not provided)");
    console.log(`[${context}] New Token:`, token);
    console.log(`[${context}] Same string as previous?`, expired ? expired === token : "(n/a)");
    console.log(`[${context}] Preview — was: ${bearerPreview(expired)} | now: ${bearerPreview(token)}`);
    return token;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${context}] Domain token refresh failed:`, msg);
    throw new Error(`Domain token refresh failed: ${msg}`);
  }
}

/** Some MT responses use HTTP 200 with Status "0" and a session-expired message. */
export function jsonIndicatesSessionExpiredOnSuccess(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const p = parsed as Record<string, unknown>;
  const ec = String(p.ErrorCode ?? p.errorCode ?? "");
  const st = String(p.Status ?? p.status ?? "");
  const msg = String(p.Message ?? p.message ?? p.Data ?? p.data ?? "").toLowerCase();
  const authy =
    msg.includes("session expired") ||
    msg.includes("token expired") ||
    msg.includes("please login again") ||
    msg.includes("unauthorized");
  if (ec === "401 UNAUTHORIZED" && authy) return true;
  if (st === "0" && authy) return true;
  return false;
}

/** Normalize Fetch `response.status` (number or rare string env). */
export function httpResponseStatus(resp: Response): number {
  const s = resp.status as number | string;
  if (typeof s === "number" && Number.isFinite(s)) return s;
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) ? n : 0;
}
