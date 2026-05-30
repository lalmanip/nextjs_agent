import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_HOTEL } from "@/lib/config";
import { API_CONFIG } from "@/config";
import { getHotelAuthTokenCached } from "@/lib/hotelAuth";
import { isPublicHotelApiHotelsLoop } from "@/lib/hotelUpstreamGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function headersObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function redactHeadersForLog(h: Record<string, string>): Record<string, string> {
  const copy = { ...h };
  const auth = copy.authorization ?? copy.Authorization;
  if (auth) {
    const v = String(auth);
    if (v.toLowerCase().startsWith("bearer ") && v.length > 14) {
      const t = v.slice(7);
      copy.authorization = `Bearer ${t.slice(0, 4)}…${t.slice(-4)} (${t.length} chars)`;
      delete copy.Authorization;
    }
  }
  const key = copy["x-api-key"] ?? copy["X-API-KEY"];
  if (key) {
    const s = String(key);
    copy["x-api-key"] = s.length > 10 ? `${s.slice(0, 4)}…${s.slice(-4)} (${s.length} chars)` : "****";
    delete copy["X-API-KEY"];
  }
  return copy;
}

export async function GET(request: NextRequest) {
  // Always log first: if this never appears in `kubectl logs` on the Next pod, the request
  // is not reaching this route (Ingress still routing /api/hotels elsewhere, wrong pod, etc.).
  console.log("[hotels/locations] incoming", request.url);

  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("query") || "").trim();
    const limit = searchParams.get("limit") || "15";

    console.log("[hotels/locations] query params:", JSON.stringify(Object.fromEntries(searchParams.entries())));
    console.log(
      "[hotels/locations] incoming headers:",
      JSON.stringify(redactHeadersForLog(headersObject(request.headers)), null, 2)
    );

    if (query.length < 2) return NextResponse.json([]);

    const apiUrl = `${API_BASE_URL_HOTEL}/api/hotels/locations?query=${encodeURIComponent(
      query
    )}&limit=${encodeURIComponent(limit)}`;

    if (isPublicHotelApiHotelsLoop(apiUrl)) {
      console.error(
        "[hotels/locations] HOTEL_API_BASE_URL / API_BASE_URL_HOTEL must be in-cluster (e.g. http://vivance-hotel-api-service:8090).",
        "Using the public site URL causes Next to fetch itself forever. Current base:",
        API_BASE_URL_HOTEL
      );
      return NextResponse.json(
        {
          error: "Hotel proxy misconfiguration",
          message:
            "Unset HOTEL_API_BASE_URL or set it to http://vivance-hotel-api-service:8090 (or your hotel Service DNS). Do not use https://next.vivancetravels.com for server-side hotel calls when Next serves /api/hotels/*.",
        },
        { status: 500 }
      );
    }

    // Log before auth so this line still appears if getHotelAuthTokenCached() fails
    // (previously the URL was only logged after auth, which hid it on auth errors).
    console.log("Hotels locations API URL:", apiUrl);

    let refreshToken: string;
    try {
      refreshToken = await getHotelAuthTokenCached();
    } catch (e: any) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[hotels/locations] Auth error:", message);
      return NextResponse.json(
        { error: "Locations lookup failed", message },
        { status: 502 }
      );
    }

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "X-API-KEY": API_CONFIG.API_KEY,
          Authorization: `Bearer ${refreshToken}`,
        },
      });
    } catch (e: any) {
      const code = e?.cause?.code || e?.code;
      const message = `Hotel service unreachable at ${API_BASE_URL_HOTEL}${code ? ` (${code})` : ""}`;
      console.error("[hotels/locations] Upstream fetch error:", message);
      return NextResponse.json(
        { error: "Locations lookup failed", message },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[hotels/locations] Backend error:", response.status, errorText);
      return NextResponse.json(
        { error: "Locations lookup failed", details: errorText, status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    return NextResponse.json(list);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[hotels/locations] Exception:", message);
    return NextResponse.json({ error: "Locations lookup failed", message }, { status: 500 });
  }
}

