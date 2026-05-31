import { proxyHolidays } from "@/lib/holidaysUpstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: { slug: string } },
) {
  const slug = context.params.slug;
  return proxyHolidays(`/destinations/${encodeURIComponent(slug)}`);
}
