import { NextResponse } from "next/server";
import { listRecentThreads, isGmailConnected } from "@/app/lib/gmail-client";
import { clearGmailRefreshToken } from "@/app/lib/gmail-token-store";
import { requireAdminSession, isSessionResponse } from "../_auth";

// GET /api/admin/emails — real threads from info@auto-bd.com once connected,
// or a "not connected" status the client uses to show the Connect button.
export async function GET() {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;

  const status = await isGmailConnected();
  if (!status.connected) {
    return NextResponse.json({ connected: false, threads: [] });
  }

  const threads = await listRecentThreads();
  return NextResponse.json({ connected: true, connectedSince: status.savedAt, threads });
}

// DELETE /api/admin/emails — disconnects the mailbox (super-admin only,
// enforced the same way the OAuth start route is).
export async function DELETE() {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;
  if (session.role !== "super") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await clearGmailRefreshToken();
  return NextResponse.json({ ok: true });
}
