import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PAGES = new Set(["/login", "/setup"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  if (pathname.startsWith("/api/auth") || pathname === "/api/setup") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && !hasSessionCookie) {
    return NextResponse.json(
      { error: "로그인이 필요합니다.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (!PUBLIC_PAGES.has(pathname) && !hasSessionCookie) {
    const login = new URL("/login", request.url);
    const next = `${pathname}${request.nextUrl.search}`;
    if (next !== "/") login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
