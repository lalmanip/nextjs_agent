import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_USER, API_KEY } from "@/lib/config";
import {
  forceFreshServerDomainToken,
  getServerDomainTokenCached,
  refreshServerDomainTokenCached,
} from "@/lib/serverTokenCache";

export const dynamic = "force-dynamic";

function sanitizeIso(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ iso: string }> },
) {
  try {
    const { iso: raw } = await ctx.params;
    const iso = sanitizeIso(raw);
    if (iso.length < 2 || iso.length > 3) {
      return NextResponse.json([], { status: 400 });
    }

    const url = `${API_BASE_URL_USER}/api-state-list/country/${encodeURIComponent(iso)}`;

    const logVivapiUserStateRequest = (label: string, bearerToken: string) => {
      console.log(
        `[state-list] vivapi-user FULL REQUEST (${label}):\n` +
          JSON.stringify(
            {
              url,
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "X-API-KEY": API_KEY,
                Authorization: `Bearer ${bearerToken}`,
              },
            },
            null,
            2,
          ),
      );
    };

    const doFetch = (bearerToken: string, label: string) => {
      logVivapiUserStateRequest(label, bearerToken);
      return fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_KEY,
          Authorization: `Bearer ${bearerToken}`,
        },
      });
    };

    let token = await getServerDomainTokenCached();
    let response = await doFetch(token, "attempt-1");

    let rawText = await response.text();

    if (response.status === 401) {
      const accessBeforeRenewal = token;
      console.warn("[state-list] 401 — refresh domain access token (vivapi-auth) then retry");
      token = await refreshServerDomainTokenCached();
      if (token === accessBeforeRenewal) {
        console.warn(
          "[state-list] Bearer string unchanged after refresh — check vivapi-auth refresh/login response (retry may still 401)",
        );
      }
      response = await doFetch(token, "attempt-2");
      rawText = await response.text();
    }

    if (response.status === 401) {
      console.warn("[state-list] 401 after refresh — force new login then retry");
      token = await forceFreshServerDomainToken();
      response = await doFetch(token, "attempt-3");
      rawText = await response.text();
    }

    if (!response.ok) {
      console.warn(`[state-list] upstream not OK for ${iso}: HTTP ${response.status}`);
      throw new Error(`HTTP ${response.status}`);
    }

    const result = rawText ? (JSON.parse(rawText) as unknown) : null;
    const resultObj =
      result && typeof result === "object" ? (result as Record<string, unknown>) : null;
    const responseList = resultObj?.response;
    const rawList: any[] = Array.isArray(result)
      ? result
      : Array.isArray(responseList)
        ? (responseList as any[])
        : [];

    const normalized = rawList
      .map((s: any) => {
        const stateName = String(
          s.stateName ??
            s.StateName ??
            s.name ??
            s.Name ??
            s.enName ??
            s.EnName ??
            "",
        ).trim();
        const stateCode = String(
          s.stateCode ??
            s.StateCode ??
            s.isoStateCode ??
            s.IsoStateCode ??
            s.abbr ??
            s.Abbr ??
            "",
        ).trim();
        const name = stateName || stateCode;
        const code = stateCode || "";
        const originRaw = s.origin ?? s.Origin ?? s.stateOrigin ?? s.StateOrigin ?? s.id ?? s.Id ?? "";
        const stateOrigin =
          originRaw !== "" && originRaw !== null && originRaw !== undefined
            ? String(originRaw).trim()
            : "";
        return { stateName: name, stateCode: code, stateOrigin };
      })
      .filter((s) => s.stateName);

    return NextResponse.json(normalized);
  } catch (err) {
    console.warn("[state-list] GET failed:", err instanceof Error ? err.message : err);
    return NextResponse.json([]);
  }
}
