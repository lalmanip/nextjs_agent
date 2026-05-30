import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_MT, API_KEY } from "@/lib/config";
import { getServerDomainTokenCached, invalidateServerDomainToken } from "@/lib/serverTokenCache";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const bookingIdRaw = (body?.BookingId ?? body?.bookingId) as unknown;
    const BookingId = String(bookingIdRaw ?? "").trim();
    if (!BookingId) return NextResponse.json({ error: "BookingId is required" }, { status: 400 });

    const url = `${API_BASE_URL_MT}/flight/service/tbo/send-change-request`;
    console.log("[send-change-request] Incoming payload:", {
      BookingId: body?.BookingId ?? body?.bookingId,
      RequestType: body?.RequestType ?? body?.requestType,
      CancellationType: body?.CancellationType ?? body?.cancellationType,
      Sectors: body?.Sectors ?? body?.sectors,
      TicketId: body?.TicketId ?? body?.ticketId,
      ResultToken: body?.ResultToken ?? body?.resultToken,
      Remarks: body?.Remarks ?? body?.remarks,
    });
    console.log("[send-change-request] Upstream endpoint:", url);

    const doFetch = (token: string) =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

    let token = await getServerDomainTokenCached();
    let res = await doFetch(token);

    if (res.status === 401) {
      invalidateServerDomainToken();
      token = await getServerDomainTokenCached();
      res = await doFetch(token);
    }

    const data = await res.json().catch(() => null);
    console.log("[send-change-request] Upstream response:", {
      status: res.status,
      ok: res.ok,
      bodyPreview: JSON.stringify(data).slice(0, 800),
    });
    return NextResponse.json(data ?? { error: `HTTP ${res.status}` }, { status: res.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

