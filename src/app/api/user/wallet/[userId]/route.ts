import { NextRequest, NextResponse } from "next/server";
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

export async function GET(
  _request: NextRequest,
  { params }: { params: { userId: string } },
) {
  try {
    const userId = String(params.userId ?? "").trim();
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const endpoint = `${API_BASE_URL_USER}/user/b2b/wallet/${encodeURIComponent(userId)}`;
    const token = await getServerDomainTokenCached();
    const headers = { ...API_HEADERS, Authorization: `Bearer ${token}` };

    console.log("\n========== B2B WALLET GET ==========");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Endpoint:", endpoint);
    console.log("Method: GET");
    console.log("Params:", { userId });
    console.log("Headers (safe):", {
      "x-api-key": API_KEY ? `${String(API_KEY).slice(0, 6)}…` : "(missing)",
      authorization: bearerPreview(headers.Authorization),
    });

    const doCall = async (h: Record<string, string>) => {
      const start = Date.now();
      const response = await fetch(endpoint, { method: "GET", headers: h });
      const durationMs = Date.now() - start;
      const responseText = await response.text().catch(() => "");
      return { response, durationMs, responseText };
    };

    let { response, durationMs, responseText } = await doCall(headers);

    let tokenExpiredInBody = false;
    try {
      const j = JSON.parse(responseText);
      const msg = String(j?.message ?? j?.Message ?? j?.error ?? j?.Error ?? "").toLowerCase();
      tokenExpiredInBody =
        (msg.includes("token") && msg.includes("expir")) ||
        msg.includes("jwt expired") ||
        msg.includes("unauthorized");
    } catch {
      /* not JSON */
    }

    const expired =
      response.status === 401 ||
      response.status === 403 ||
      tokenExpiredInBody ||
      /token\s*expired/i.test(responseText) ||
      /jwt\s*expired/i.test(responseText);

    if (expired) {
      console.warn("[wallet] Token expired — refreshing and retrying");
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
      return NextResponse.json(
        { error: "Invalid JSON from wallet service", raw: responseText.slice(0, 500) },
        { status: 502 },
      );
    }

    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error("[wallet] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch wallet" }, { status: 500 });
  }
}
