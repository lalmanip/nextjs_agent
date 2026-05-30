import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_HOTEL } from "@/lib/config";
import { API_CONFIG } from "@/config";
import { getHotelAuthTokenCached } from "@/lib/hotelAuth";
import { isPublicHotelApiHotelsLoop } from "@/lib/hotelUpstreamGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bookingCode = String(body?.BookingCode || body?.bookingCode || "").trim();
    const paymentMode = String(body?.PaymentMode || body?.paymentMode || "Limit");

    if (!bookingCode) {
      return NextResponse.json({ error: "BookingCode is required" }, { status: 400 });
    }

    let refreshToken: string;
    try {
      refreshToken = await getHotelAuthTokenCached();
    } catch (e: any) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[hotels/prebook] Auth error:", message);
      return NextResponse.json({ error: "Hotel prebook failed", message }, { status: 502 });
    }

    const apiUrl = `${API_BASE_URL_HOTEL}/api/v1/hotels/prebook`;
    if (isPublicHotelApiHotelsLoop(apiUrl)) {
      console.error("[hotels/prebook] Misconfigured HOTEL_API_BASE_URL (must be in-cluster). Base:", API_BASE_URL_HOTEL);
      return NextResponse.json(
        {
          error: "Hotel proxy misconfiguration",
          message:
            "Set HOTEL_API_BASE_URL to http://vivance-hotel-api-service:8090. Do not use the public ingress URL for server-side hotel calls.",
        },
        { status: 500 }
      );
    }
    console.log("[hotels/prebook] Proxying to:", apiUrl);
    console.log("[hotels/prebook] Payload:", JSON.stringify({ BookingCode: bookingCode, PaymentMode: paymentMode }, null, 2));

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_CONFIG.API_KEY,
          Authorization: `Bearer ${refreshToken}`,
        },
        body: JSON.stringify({ BookingCode: bookingCode, PaymentMode: paymentMode }),
      });
    } catch (e: any) {
      const code = e?.cause?.code || e?.code;
      const message = `Hotel service unreachable at ${API_BASE_URL_HOTEL}${code ? ` (${code})` : ""}`;
      console.error("[hotels/prebook] Upstream fetch error:", message);
      return NextResponse.json({ error: "Hotel prebook failed", message }, { status: 502 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[hotels/prebook] Backend error:", response.status, errorText);
      return NextResponse.json(
        { error: "Hotel prebook failed", details: errorText, status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[hotels/prebook] Exception:", message);
    return NextResponse.json({ error: "Hotel prebook failed", message }, { status: 500 });
  }
}

