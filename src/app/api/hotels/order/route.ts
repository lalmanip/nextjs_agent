import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_MT, API_KEY } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resultToken = (searchParams.get("resultToken") || "").trim();
    const module = (searchParams.get("module") || "HOTEL").trim();
    const authHeader = request.headers.get("authorization");

    if (!resultToken || !authHeader) {
      return NextResponse.json(
        { error: "Missing parameters", message: "resultToken and Authorization are required" },
        { status: 400 }
      );
    }

    const endpoint = `${API_BASE_URL_MT}/flight/service/order-id-creation?resultToken=${encodeURIComponent(
      resultToken
    )}&module=${encodeURIComponent(module)}`;
    console.log("[hotels/order] Proxying to:", endpoint);

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_KEY,
          Authorization: authHeader,
        },
      });
    } catch (e: any) {
      const code = e?.cause?.code || e?.code;
      const message = `MT service unreachable at ${API_BASE_URL_MT}${code ? ` (${code})` : ""}`;
      console.error("[hotels/order] Upstream fetch error:", message);
      return NextResponse.json({ error: "Order creation failed", message }, { status: 502 });
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Order creation failed", details: errorText, status: res.status },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[hotels/order] Exception:", message);
    return NextResponse.json({ error: "Order creation failed", message }, { status: 500 });
  }
}

