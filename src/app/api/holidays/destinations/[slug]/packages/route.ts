import { NextRequest } from "next/server";
import { proxyHolidays } from "@/lib/holidaysUpstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: { slug: string } },
) {
  const slug = context.params.slug;
  const categoryCode =
    request.nextUrl.searchParams.get("categoryCode") ?? "best-seller";
  return proxyHolidays(
    `/destinations/${encodeURIComponent(slug)}/packages?categoryCode=${encodeURIComponent(categoryCode)}`,
  );
}
