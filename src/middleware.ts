import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAgentPortalBaseUrl,
  getB2cAppBaseUrl,
  isAgentPortalHost,
  isCombinedAgentAndB2cHost,
} from "@/lib/agentPortal";
import { USER_COOKIE_NAME, hasValidUserSessionCookie } from "@/lib/authSession";

const B2C_APP_URL = getB2cAppBaseUrl();
const AGENT_PORTAL_URL = getAgentPortalBaseUrl();

export function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const { pathname } = request.nextUrl;
  const agentPortal = isAgentPortalHost(host);

  // B2C host: send legacy /agent URLs to the agent portal (clean URLs there)
  if (!agentPortal) {
    if (pathname === "/agent" || pathname === "/agent/") {
      return NextResponse.redirect(`${AGENT_PORTAL_URL}/`);
    }
    if (pathname === "/agent/login" || pathname === "/agent/login/") {
      return NextResponse.redirect(`${AGENT_PORTAL_URL}/`);
    }
    if (pathname === "/agent/signup" || pathname.startsWith("/agent/signup/")) {
      return NextResponse.redirect(`${AGENT_PORTAL_URL}/signup`);
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
    const dest = `${B2C_APP_URL}${pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
