import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_MT, API_KEY } from "@/lib/config";
import { getServerDomainTokenCached, invalidateServerDomainToken } from "@/lib/serverTokenCache";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const crRaw = body?.ChangeRequestId ?? body?.changeRequestId;
    const ChangeRequestId = String(crRaw ?? "").trim();
    if (!ChangeRequestId) {
      return NextResponse.json({ error: "ChangeRequestId is required" }, { status: 400 });
    }

    const resultTokenRaw = body?.ResultToken ?? body?.resultToken;
    const ResultToken =
      typeof resultTokenRaw === "string" && resultTokenRaw.trim()
        ? resultTokenRaw.trim()
        : "optional-for-logging";

    const url = `${API_BASE_URL_MT}/flight/service/tbo/get-change-request-status`;

    const payload = { ChangeRequestId, ResultToken };

    const doFetch = (token: string) =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

    let token = await getServerDomainTokenCached();
    let res = await doFetch(token);

    if (res.status === 401) {
      invalidateServerDomainToken();
      token = await getServerDomainTokenCached();
      res = await doFetch(token);
    }

    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? { error: `HTTP ${res.status}` }, { status: res.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
