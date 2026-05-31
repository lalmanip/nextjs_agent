import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_USER, API_KEY } from "@/lib/config";
import {
  forceFreshServerDomainToken,
  getServerDomainTokenCached,
  refreshServerDomainTokenCached,
} from "@/lib/serverTokenCache";

export const dynamic = "force-dynamic";

/** State `origin` from api-state-list (e.g. 4027) — digits only for path safety. */
function sanitizeStateOrigin(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\D/g, "");
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ origin: string }> },
) {
  try {
    const { origin: raw } = await ctx.params;
    const origin = sanitizeStateOrigin(raw);
    if (!origin || origin.length > 12) {
      return NextResponse.json([], { status: 400 });
    }

    const url = `${API_BASE_URL_USER}/api-city-list/state/${encodeURIComponent(origin)}`;

    const doFetch = (token: string) =>
      fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_KEY,
          Authorization: `Bearer ${token}`,
        },
      });

    let token = await getServerDomainTokenCached();
    let response = await doFetch(token);

    if (response.status === 401) {
      console.warn("[city-list] 401 — refresh domain access token then retry");
      token = await refreshServerDomainTokenCached();
      response = await doFetch(token);
    }
    if (response.status === 401) {
      console.warn("[city-list] 401 after refresh — force new login then retry");
      token = await forceFreshServerDomainToken();
      response = await doFetch(token);
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    const rawList: any[] = Array.isArray(result)
      ? result
      : Array.isArray(result?.response)
        ? result.response
        : [];

    const normalized = rawList
      .map((c: any) => {
        const cityName = String(
          c.cityName ??
            c.CityName ??
            c.name ??
            c.Name ??
            c.destination ??
            c.Destination ??
            "",
        ).trim();
        const cityCode = String(
          c.cityCode ?? c.CityCode ?? c.code ?? c.Code ?? c.origin ?? c.Origin ?? "",
        ).trim();
        const name = cityName || cityCode;
        const code = cityCode || "";
        return { cityName: name, cityCode: code };
      })
      .filter((c) => c.cityName);

    return NextResponse.json(normalized);
  } catch {
    return NextResponse.json([]);
  }
}
