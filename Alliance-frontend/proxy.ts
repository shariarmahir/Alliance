import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/session-token";
import { API_BASE_URL } from "@/app/lib/api-browser";
import type { AccessArea } from "@/app/lib/types";

// Navigation-level gate. Authorisation itself is the backend's job — it
// rejects an unauthorised request regardless of which UI made it — but this
// gate still decides whether an admin page renders at all, so it must agree
// with the backend about whether a session is live.
//
// Verifying the signature locally is not enough for that. A signed, unexpired
// token says nothing about whether its holder signed out or had their account
// deleted since, because neither event changes the token. Trusting the
// signature alone is what let a logged-out session keep opening admin pages by
// pasting the URL. So the token is checked against the API, which is the only
// component that knows what is still valid.
//
// The signature check stays as a cheap first pass: a missing or forged cookie
// is rejected without a network round trip.

const ADMIN_LANDING = "/admin";

// Prefix-matched: pathname === prefix OR pathname starts with `${prefix}/`.
const SUB_ADMIN_ALLOWED_PREFIXES = [
  "/admin/products",
  "/admin/stock",
  "/admin/hero-images",
  "/admin/tasks",
  "/admin/leave",
  "/admin/daily-report",
];

// Exact-match ONLY — never prefix-matched. `/admin` is a legitimate sub-admin
// destination (their personal dashboard, role-branched inside the page), but
// as a prefix it would match every super-only path under /admin/*.
const SUB_ADMIN_ALLOWED_EXACT = ["/admin"];

// Gated behind a per-employee AccessArea grant, checked only after the fixed
// allowlists miss.
const SUB_ADMIN_GRANTABLE_PREFIXES: { prefix: string; area: AccessArea }[] = [
  { prefix: "/admin/quotations", area: "quotations" },
  { prefix: "/admin/orders", area: "orders" },
  { prefix: "/admin/emails", area: "emails" },
  { prefix: "/admin/contact-requests", area: "contact-requests" },
];

// Confirms with the API that this exact session is still live. A network
// failure denies rather than admits: an unreachable API is not evidence that a
// session is valid, and every page behind this gate would fail its own data
// fetches anyway.
async function sessionIsLive(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/me`, {
      headers: { Cookie: `${ADMIN_SESSION_COOKIE}=${token}` },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await parseAdminSession(token);

  if (!session || !token || !(await sessionIsLive(token))) {
    // Clear the cookie on the way out. Without this a revoked token sits in
    // the browser being re-checked and re-rejected on every navigation, and
    // the login page it lands on cannot tell why it was sent there.
    const redirect = NextResponse.redirect(new URL("/admin/login", request.url));
    redirect.cookies.delete(ADMIN_SESSION_COOKIE);
    return redirect;
  }

  if (session.role === "sub") {
    const matches = (prefix: string) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`);

    const allowed =
      SUB_ADMIN_ALLOWED_EXACT.includes(pathname) ||
      SUB_ADMIN_ALLOWED_PREFIXES.some(matches) ||
      SUB_ADMIN_GRANTABLE_PREFIXES.some(
        ({ prefix, area }) => matches(prefix) && (session.accessOptions ?? []).includes(area)
      );
    if (!allowed) {
      return NextResponse.redirect(new URL(ADMIN_LANDING, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
