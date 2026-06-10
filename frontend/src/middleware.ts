import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware — lightweight only:
 * - Redirects `/` → `/auth/login`
 * - Clears auth cookies on `?logout=1`
 *
 * All /game/* auth gating is handled client-side by AuthGuard + Bearer token.
 * Middleware MUST NOT redirect based on cookies to avoid desync loops with
 * the Bearer token auth flow (cookie can outlive localStorage tokens).
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.searchParams.has("logout")) {
    const res = NextResponse.next();
    res.cookies.set("campuskards_token", "", { path: "/", maxAge: 0 });
    res.cookies.set("campuskards_refresh_token", "", { path: "/", maxAge: 0 });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
