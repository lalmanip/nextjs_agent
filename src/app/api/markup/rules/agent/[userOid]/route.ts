import { proxyMarkupGet } from "@/lib/markupApiProxy";

type RouteContext = { params: Promise<{ userOid: string }> };

/** Agent rules + inherited GLOBAL defaults. */
export async function GET(_request: Request, context: RouteContext) {
  const { userOid } = await context.params;
  return proxyMarkupGet(`/markup/rules/agent/${encodeURIComponent(userOid)}`);
}
