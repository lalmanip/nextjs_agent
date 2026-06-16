import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_USER, API_KEY } from "@/lib/config";
import { getServerDomainTokenCached, refreshServerDomainTokenCached } from "@/lib/serverTokenCache";
import { normalizeTravellerMember } from "@/lib/travellerFields";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const q = String(searchParams.get("q") ?? "").trim();
    const limit = searchParams.get("limit") ?? "10";

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    if (!q) {
      return NextResponse.json({ status: "success", response: [] });
    }

    const endpoint = `${API_BASE_URL_USER}/userTravellerDetails/search/${encodeURIComponent(userId)}?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`;
    const token = await getServerDomainTokenCached();
    const headers = { ...API_HEADERS, Authorization: `Bearer ${token}` };

    const doCall = async (h: Record<string, string>) => {
      const response = await fetch(endpoint, { method: "GET", headers: h });
      const responseText = await response.text().catch(() => "");
      return { response, responseText };
    };

    let { response, responseText } = await doCall(headers);

    const expired =
      response.status === 401 ||
      /token\s*expired/i.test(responseText) ||
      /jwt\s*expired/i.test(responseText);

    if (expired) {
      const fresh = await refreshServerDomainTokenCached();
      const retryHeaders = { ...headers, Authorization: `Bearer ${fresh}` };
      console.log("[family-members search] Retry bearer:", bearerPreview(retryHeaders.Authorization));
      ({ response, responseText } = await doCall(retryHeaders));
    }

    let result: { status?: string; response?: Record<string, unknown>[]; message?: string } | null = null;
    try {
      result = responseText ? JSON.parse(responseText) : null;
    } catch {
      result = { status: "failed", message: responseText };
    }

    if (!response.ok || result?.status === "failed") {
      return NextResponse.json(
        result ?? { status: "failed", message: "Search failed" },
        { status: response.ok ? 200 : response.status },
      );
    }

    const rows: Record<string, unknown>[] = Array.isArray(result?.response) ? result.response : [];
    return NextResponse.json({
      ...(result ?? { status: "success" }),
      response: rows.map((row) => normalizeTravellerMember(row)),
    });
  } catch (error) {
    console.error("Search saved travellers error:", error);
    return NextResponse.json({ error: "Failed to search saved passengers" }, { status: 500 });
  }
}
