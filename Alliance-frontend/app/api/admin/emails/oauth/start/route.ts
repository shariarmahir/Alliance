import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildConsentUrl } from "@/app/lib/gmail-client";
import { requireSuperAdminSession, isSessionResponse } from "../../../_auth";

// GET /api/admin/emails/oauth/start — redirects to Google's consent screen.
// Super-admin-only: this grants read access to the shared company mailbox,
// not a personal one, so it isn't something a sub-admin should be able to
// trigger even if the emails screen itself is ever opened up to them.
export async function GET() {
  const session = await requireSuperAdminSession();
  if (isSessionResponse(session)) return session;

  // CSRF guard on the OAuth round trip: Google echoes `state` back verbatim
  // on the callback, so a value only this server could have generated proves
  // the callback belongs to a flow we started, not one an attacker linked to.
  const state = randomBytes(16).toString("hex");
  const consentUrl = buildConsentUrl(state);

  const response = NextResponse.redirect(consentUrl);
  response.cookies.set({
    name: "gmail_oauth_state",
    value: state,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes — long enough for the consent screen, no longer
  });
  return response;
}
