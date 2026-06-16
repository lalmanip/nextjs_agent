export interface MarkupQuoteResult {
  markupAmount: number;
  fareAfterMarkup?: number;
  ruleId?: number | null;
  ruleScope?: string;
  baseFare?: number;
}

type MarkupQuoteResponse = {
  status?: string;
  message?: string;
  response?: {
    markupAmount?: number;
    fareAfterMarkup?: number;
    ruleId?: number;
    ruleScope?: string;
    baseFare?: number;
  };
};

/** Lead segment airline code for markup rule matching. */
export function getLeadAirlineCode(details: any[][] | undefined | null): string | undefined {
  const seg = details?.[0]?.[0];
  if (!seg) return undefined;
  return (
    seg?.Airline?.AirlineCode ||
    seg?.airline?.AirlineCode ||
    seg?.airline?.code ||
    undefined
  );
}

export async function quoteMarkup(params: {
  userOid: number;
  baseFare: number;
  tripType: "DOMESTIC" | "INTERNATIONAL";
  airlineCode?: string;
  channel?: string;
}): Promise<MarkupQuoteResult> {
  const res = await fetch("/api/markup/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userOid: params.userOid,
      channel: params.channel ?? "B2B",
      productType: "FLIGHT",
      tripType: params.tripType,
      baseFare: params.baseFare,
      actorUserId: params.userOid,
      ...(params.airlineCode ? { airlineCode: params.airlineCode } : {}),
    }),
  });
  const data = (await res.json()) as MarkupQuoteResponse;
  if (!res.ok || data?.status === "failed") {
    throw new Error(data?.message || "Markup quote failed");
  }
  const r = data.response ?? {};
  return {
    markupAmount: Number(r.markupAmount ?? 0),
    fareAfterMarkup: r.fareAfterMarkup != null ? Number(r.fareAfterMarkup) : undefined,
    ruleId: r.ruleId ?? null,
    ruleScope: r.ruleScope,
    baseFare: r.baseFare != null ? Number(r.baseFare) : undefined,
  };
}
