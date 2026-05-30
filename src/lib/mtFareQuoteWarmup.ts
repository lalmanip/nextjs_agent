import { API_BASE_URL_MT, API_KEY } from "@/lib/config";

function httpStatus(resp: Response): number {
  const s = resp.status as number | string;
  if (typeof s === "number" && Number.isFinite(s)) return s;
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * vivapi-mt often ties ResultToken server-side sessions to the JWT used for search/booking APIs.
 * After a forced domain-token refresh, call update-fare-quote once per ResultToken so MT links
 * the shopping session to the new Bearer token before initiatePayment / validatePayment retries.
 */
export async function warmMtFareQuoteSession(
  bearerTokenRaw: string,
  resultToken: string,
  context: string,
): Promise<void> {
  const rt = String(resultToken || "").trim();
  if (!rt) return;
  const url = `${API_BASE_URL_MT}/flight/service/update-fare-quote`;
  console.log(`[${context}] Warming MT session via update-fare-quote (${rt.slice(0, 28)}…)`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": API_KEY,
      Authorization: `Bearer ${bearerTokenRaw}`,
    },
    body: JSON.stringify({ ResultToken: rt }),
  });
  const st = httpStatus(res);
  const text = await res.text();
  if (!res.ok) {
    console.warn(`[${context}] update-fare-quote HTTP ${st}:`, text.slice(0, 500));
    return;
  }
  console.log(`[${context}] update-fare-quote warmed OK (${st})`);
}

export async function warmMtFareQuoteSessionsForBooking(
  bearerTokenRaw: string,
  resultToken: string,
  returnResultToken: string | null | undefined,
  context: string,
): Promise<void> {
  await warmMtFareQuoteSession(bearerTokenRaw, resultToken, context);
  if (returnResultToken && returnResultToken !== resultToken) {
    await warmMtFareQuoteSession(bearerTokenRaw, returnResultToken, `${context}:return`);
  }
}
