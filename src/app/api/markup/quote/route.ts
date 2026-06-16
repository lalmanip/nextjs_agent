import { NextRequest } from "next/server";
import { proxyMarkupPost } from "@/lib/markupApiProxy";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyMarkupPost("/markup/quote", body);
}
