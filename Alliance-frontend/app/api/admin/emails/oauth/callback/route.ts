import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForRefreshToken } from "@/app/lib/gmail-client";
import { saveGmailRefreshToken } from "@/app/lib/gmail-token-store";
import { requireSuperAdminSession, isSessionResponse } from "../../../_auth";

// GET /api/admin/emails/oauth/callback — Google redirects here after consent.
// Exchanges the one-time code for a refresh token and stores it (encrypted —
// see gmail-token-store.ts), then sends the admin back to the emails screen.
export async function GET(request: NextRequest) {
  const session = await requireSuperAdminSession();
  if (isSessionResponse(session)) return session;

  const url = request.nextUrl;
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/emails?gmail_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const expectedState = request.cookies.get("gmail_oauth_state")?.value;

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    return NextResponse.redirect(new URL("/admin/emails?gmail_error=state_mismatch", request.url));
  }

  try {
    const refreshToken = await exchangeCodeForRefreshToken(code);
    await saveGmailRefreshToken(refreshToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.redirect(
      new URL(`/admin/emails?gmail_error=${encodeURIComponent(message)}`, request.url)
    );
  }

  const response = NextResponse.redirect(new URL("/admin/emails?gmail_connected=true", request.url));
  response.cookies.delete("gmail_oauth_state");
  return response;
}
