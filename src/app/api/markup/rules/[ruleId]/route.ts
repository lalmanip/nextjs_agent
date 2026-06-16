import { NextRequest } from "next/server";
import {
  proxyMarkupDelete,
  proxyMarkupGet,
  proxyMarkupPut,
} from "@/lib/markupApiProxy";

type RouteContext = { params: Promise<{ ruleId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { ruleId } = await context.params;
  return proxyMarkupGet(`/markup/rules/${encodeURIComponent(ruleId)}`);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { ruleId } = await context.params;
  const body = await request.json();
  return proxyMarkupPut(`/markup/rules/${encodeURIComponent(ruleId)}`, body);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { ruleId } = await context.params;
  const actorUserId = request.nextUrl.searchParams.get("actorUserId");
  const qs = actorUserId ? `?actorUserId=${encodeURIComponent(actorUserId)}` : "";
  return proxyMarkupDelete(`/markup/rules/${encodeURIComponent(ruleId)}${qs}`);
}
