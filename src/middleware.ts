import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AGENT_PORTAL_NOT_CONFIGURED_MESSAGE,
  getAgentPortalBaseUrl,
  getB2cAppBaseUrl,
  isAgentPortalConfigured,
  isAgentPortalHost,
  isCombinedAgentAndB2cHost,
} from "@/lib/agentPortal";
import { USER_COOKIE_NAME, hasValidUserSessionCookie } from "@/lib/authSession";

function notConfiguredResponse(): NextResponse {
  return new NextResponse(AGENT_PORTAL_NOT_CONFIGURED_MESSAGE, {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function middleware(request: NextRequest) {
  if (!isAgentPortalConfigured()) {
    return notConfiguredResponse();
  }

  const host = request.headers.get("host");
  const { pathname } = request.nextUrl;
  const agentPortal = isAgentPortalHost(host);
  const agentPortalUrl = getAgentPortalBaseUrl();
  const b2cAppUrl = getB2cAppBaseUrl();

  // B2C host: send legacy /agent URLs to the agent portal (clean URLs there)
  if (!agentPortal) {
    if (pathname === "/agent" || pathname === "/agent/") {
      if (!agentPortalUrl) return notConfiguredResponse();
      return NextResponse.redirect(`${agentPortalUrl}/`);
    }
    if (pathname === "/agent/login" || pathname === "/agent/login/") {
      if (!agentPortalUrl) return notConfiguredResponse();
      return NextResponse.redirect(`${agentPortalUrl}/`);
    }
    if (
      pathname === "/agent/signup" ||
      pathname.startsWith("/agent/signup/") ||
      pathname === "/signup" ||
      pathname === "/signup/"
    ) {
      if (!agentPortalUrl) return notConfiguredResponse();
      return NextResponse.redirect(`${agentPortalUrl}/signup`);
    }
    return NextResponse.next();
  }

  // Agent portal host: canonical URLs without /agent prefix
  if (pathname === "/agent" || pathname === "/agent/") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname === "/agent/login" || pathname === "/agent/login/") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname === "/agent/signup" || pathname === "/agent/signup/") {
    return NextResponse.redirect(new URL("/signup", request.url));
  }

  if (pathname === "/" || pathname === "/login" || pathname === "/login/") {
    const sessionCookie = request.cookies.get(USER_COOKIE_NAME)?.value;
    if (hasValidUserSessionCookie(sessionCookie)) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/agent";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/signup" || pathname === "/signup/") {
    const url = request.nextUrl.clone();
    url.pathname = "/agent/signup";
    return NextResponse.rewrite(url);
  }

  // Agent portal is auth-only on a separate host; B2C routes live on NEXT_PUBLIC_B2C_APP_URL.
  // Local dev often uses the same host for both — redirecting to self causes ERR_TOO_MANY_REDIRECTS.
  if (
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    pathname !== "/favicon.ico"
  ) {
    if (isCombinedAgentAndB2cHost(host)) {
      return NextResponse.next();
    }
    if (!b2cAppUrl) {
      return notConfiguredResponse();
    }
    const dest = `${b2cAppUrl}${pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip multipart upload — middleware body buffering is unnecessary for this API route.
    "/((?!_next/static|_next/image|favicon.ico|api/agent/documents/upload|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
