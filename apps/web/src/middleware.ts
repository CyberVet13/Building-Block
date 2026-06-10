import { NextRequest, NextResponse } from "next/server";

/**
 * Auth guard middleware.
 *
 * Protected routes require the user to be signed in.
 * In dev mode (no Cognito env vars) all routes are open.
 *
 * Token detection: checks the sessionStorage token written by auth.ts.
 * Because middleware runs on the server/edge, we can't access sessionStorage
 * directly — instead we check for a lightweight cookie set by the client
 * after sign-in (bb_authed=1). The real JWT is never sent as a cookie.
 */

const PROTECTED = ["/create", "/plans", "/account"];
const ADMIN_ONLY = ["/admin"];
const PUBLIC = ["/", "/signin", "/signup", "/pricing"];

function isProtected(pathname: string): boolean {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isAdminOnly(pathname: string): boolean {
  return ADMIN_ONLY.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dev mode: skip auth entirely
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
  if (!userPoolId) return NextResponse.next();

  // Static files, API routes, Next internals — skip
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const authed = request.cookies.get("bb_authed")?.value === "1";
  const isAdmin = request.cookies.get("bb_role")?.value === "admin";

  if (isAdminOnly(pathname) && (!authed || !isAdmin)) {
    const url = request.nextUrl.clone();
    url.pathname = authed ? "/" : "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isProtected(pathname) && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
