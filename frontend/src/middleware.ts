import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware — lightweight only:
 * - Redirects `/` → `/auth/login`
 * - Redirects authenticated users away from `/auth/login` → `/game` (cookie-based)
 *
 * /game/* auth is handled client-side by AuthGuard + Bearer token.
 * Edge middleware cannot read localStorage; cookie-only gating caused redirect loops.
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const raw = request.cookies.get("campuskards_token")?.value ?? null;
  const token = raw && raw.split(".").length >= 3 ? raw : null;

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/auth/login") && token && !request.nextUrl.searchParams.has("logout")) {
    const url = request.nextUrl.clone();
    url.pathname = "/game";
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
