import { NextRequest } from "next/server";
import { proxyHolidays } from "@/lib/holidaysUpstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") ?? "international";
  return proxyHolidays(
    `/destinations/trending?region=${encodeURIComponent(region)}`,
  );
}
