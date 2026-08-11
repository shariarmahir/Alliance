import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, parseAdminSession, landingPathForRole } from "@/app/lib/admin-auth";

const SUB_ADMIN_ALLOWED_PREFIXES = ["/admin/products", "/admin/stock", "/admin/hero-images"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = parseAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (!session) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === "sub") {
    const allowed = SUB_ADMIN_ALLOWED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    if (!allowed) {
      return NextResponse.redirect(new URL(landingPathForRole("sub"), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
