import { proxyHolidays } from "@/lib/holidaysUpstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return proxyHolidays("/categories");
}
