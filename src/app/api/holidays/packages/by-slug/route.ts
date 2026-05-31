import { NextRequest } from "next/server";
import { proxyHolidays } from "@/lib/holidaysUpstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const destinationSlug = request.nextUrl.searchParams.get("destinationSlug");
  const packageSlug = request.nextUrl.searchParams.get("packageSlug");
  if (!destinationSlug || !packageSlug) {
    return new Response(
      JSON.stringify({ error: "destinationSlug and packageSlug are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  return proxyHolidays(
    `/packages/by-slug?destinationSlug=${encodeURIComponent(destinationSlug)}&packageSlug=${encodeURIComponent(packageSlug)}`,
  );
}
