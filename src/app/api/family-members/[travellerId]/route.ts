import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL_USER, API_KEY } from "@/lib/config";
import { getServerDomainTokenCached, invalidateServerDomainToken } from "@/lib/serverTokenCache";
import { withPassportIssuingCountryForApi } from "@/lib/travellerFields";

export const dynamic = "force-dynamic";

/**
 * PUT …/userTravellerDetails/update/{id}
 * The path `id` is the **`origin`** field returned per row from getSavedPaxById (not necessarily DB `id`).
 */
export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ travellerId: string }> },
) {
  try {
    const { travellerId } = await ctx.params;
    const id = String(travellerId || "").trim();
    if (!id) return NextResponse.json({ error: "travellerId (origin) required" }, { status: 400 });

    const body = withPassportIssuingCountryForApi(
      (await request.json().catch(() => ({}))) as Record<string, unknown>,
    );

    const endpoint = `${API_BASE_URL_USER}/userTravellerDetails/update/${encodeURIComponent(id)}`;
    const doFetch = (token: string) =>
      fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

    let token = await getServerDomainTokenCached();
    const incomingUrl = new URL(request.url);

    console.log("\n========== USER TRAVELLER UPDATE (proxy) ==========");
    console.log("Timestamp:", new Date().toISOString());
    console.log("--- INCOMING (Next.js) ---");
    console.log("Path:", incomingUrl.pathname);
    console.log("Query params:", Object.fromEntries(incomingUrl.searchParams));
    console.log("Route params (origin for update path):", { travellerId: id });
    console.log("Method:", request.method);
    console.log("Headers:", {
      "content-type": request.headers.get("content-type"),
      accept: request.headers.get("accept"),
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
    });
    console.log("Request body:", JSON.stringify(body, null, 2).slice(0, 2000));

    console.log("--- OUTBOUND (vivapi-user) ---");
    console.log("Endpoint:", endpoint);
    console.log("Method: PUT");
    console.log("Params (path):", { travellerId: id });
    console.log("Headers (safe):", {
      "content-type": "application/json",
      "x-api-key": API_KEY ? `${String(API_KEY).slice(0, 6)}…` : "(missing)",
      authorization: token ? `[len=${token.length}] …${token.slice(-6)}` : "(missing)",
    });
    console.log("Request body:", JSON.stringify(body, null, 2).slice(0, 2000));

    const start = Date.now();
    let res = await doFetch(token);
    if (res.status === 401) {
      console.warn("[family-members/update] 401 — refreshing domain token and retrying once");
      invalidateServerDomainToken();
      token = await getServerDomainTokenCached();
      res = await doFetch(token);
    }
    const durationMs = Date.now() - start;
    const text = await res.text().catch(() => "");

    console.log("--- RESPONSE (vivapi-user) ---");
    console.log("Status Code:", res.status);
    console.log("Status Text:", res.statusText);
    console.log("Response Time:", `${durationMs}ms`);
    console.log("Response Headers:", {
      "content-type": res.headers.get("content-type"),
      "content-length": res.headers.get("content-length"),
    });
    console.log("Response Body (raw preview):", text.slice(0, 2000));
    console.log("==================================================\n");

    const data = text ? JSON.parse(text) : null;
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

