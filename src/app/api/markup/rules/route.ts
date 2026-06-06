import { NextRequest } from "next/server";
import { proxyMarkupGet, proxyMarkupPost } from "@/lib/markupApiProxy";

/** GET all active rules (admin). POST create rule. */
export async function GET() {
  return proxyMarkupGet("/markup/rules");
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyMarkupPost("/markup/rules", body);
}
