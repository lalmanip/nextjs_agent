import { proxyHolidays } from "@/lib/holidaysUpstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: { pkgId: string } },
) {
  const pkgId = context.params.pkgId;
  return proxyHolidays(`/packages/${encodeURIComponent(pkgId)}`);
}
