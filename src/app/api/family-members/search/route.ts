import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_USER, API_KEY } from "@/lib/config";
import { getServerDomainTokenCached, refreshServerDomainTokenCached } from "@/lib/serverTokenCache";
import { normalizeTravellerMember } from "@/lib/travellerFields";

function travellerNameMatchesQuery(member: Record<string, unknown>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const fn = String(member.firstName ?? member.FirstName ?? "").trim().toLowerCase();
  const ln = String(member.lastName ?? member.LastName ?? "").trim().toLowerCase();
  const full = `${fn} ${ln}`.trim();
  const lead = String(member.leadPassengerName ?? member.LeadPassengerName ?? "").trim().toLowerCase();
  return (
    fn.startsWith(q) ||
    ln.startsWith(q) ||
    full.includes(q) ||
    lead.includes(q)
  );
}

async function fetchSavedPaxList(
  userId: string,
  headers: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const endpoint = `${API_BASE_URL_USER}/userTravellerDetails/getSavedPaxById/${encodeURIComponent(userId)}`;
  const response = await fetch(endpoint, { method: "GET", headers });
  const text = await response.text().catch(() => "");
  if (!response.ok) return [];
  try {
    const json = text ? JSON.parse(text) : null;
    return Array.isArray(json?.response) ? json.response : [];
  } catch {
    return [];
  }
}

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
      const start = Date.now();
      const response = await fetch(endpoint, { method: "GET", headers: h });
      const durationMs = Date.now() - start;
      const responseText = await response.text().catch(() => "");
      return { response, durationMs, responseText };
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

    let result = responseText ? JSON.parse(responseText) : null;
    let rows: Record<string, unknown>[] = Array.isArray(result?.response) ? result.response : [];

    const searchUnavailable =
      !response.ok ||
      result?.status === "failed" ||
      (response.status === 404);

    if (searchUnavailable || rows.length === 0) {
      const allSaved = await fetchSavedPaxList(userId, headers);
      const filtered = allSaved.filter((row) => travellerNameMatchesQuery(row, q));
      if (filtered.length > 0) {
        rows = filtered;
        result = { status: "success", response: rows };
      }
    }

    if (rows.length > 0) {
      result = { ...(result ?? { status: "success" }), response: rows };
      result.response = rows.map((row: Record<string, unknown>) => normalizeTravellerMember(row));
    }

    return NextResponse.json(result ?? { status: "success", response: [] }, {
      status: searchUnavailable && rows.length === 0 ? (response.ok ? 200 : response.status) : 200,
    });
  } catch (error) {
    console.error("Search saved travellers error:", error);
    return NextResponse.json({ error: "Failed to search saved passengers" }, { status: 500 });
  }
}
