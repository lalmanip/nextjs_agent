import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_MT, API_KEY } from "@/lib/config";
import { getServerDomainTokenCached, invalidateServerDomainToken } from "@/lib/serverTokenCache";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      BookingId?: string;
      RequestType?: string;
      BookingMode?: string;
      ResultToken?: string;
    };

    const BookingId = String(body?.BookingId || "").trim();
    const RequestType = String(body?.RequestType || "1").trim();
    const BookingMode = String(body?.BookingMode || "5").trim();
    const ResultToken = String(body?.ResultToken || "").trim();

    if (!BookingId) {
      return NextResponse.json({ error: "BookingId is required" }, { status: 400 });
    }

    const url = `${API_BASE_URL_MT}/flight/service/tbo/get-cancellation-charges`;

    const doFetch = (token: string) =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          BookingId,
          RequestType,
          BookingMode,
          ...(ResultToken ? { ResultToken } : {}),
        }),
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

