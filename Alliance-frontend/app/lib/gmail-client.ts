import "server-only";
import { google } from "googleapis";
import { readGmailRefreshToken } from "./gmail-token-store";

// Read-only Gmail API access to info@auto-bd.com, via a one-time OAuth
// consent (see /api/admin/emails/oauth/*) rather than a service account —
// domain-wide delegation needs Workspace super-admin rights, which this
// project doesn't assume are available. The refresh token, once granted,
// keeps working indefinitely without asking again.

export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

function oauthClient() {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Gmail OAuth is not configured — set GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET and GMAIL_OAUTH_REDIRECT_URI. See SECURITY.md."
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function buildConsentUrl(state: string): string {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // forces a refresh_token even on a re-consent
    scope: GMAIL_SCOPES,
    state,
  });
}

export async function exchangeCodeForRefreshToken(code: string): Promise<string> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. This happens on a repeat consent without prompt=consent, or if access was already granted — revoke access at myaccount.google.com/permissions for this app and try again."
    );
  }
  return tokens.refresh_token;
}

async function authorizedClient() {
  const stored = await readGmailRefreshToken();
  if (!stored) return null;
  const client = oauthClient();
  client.setCredentials({ refresh_token: stored.token });
  return client;
}

export async function isGmailConnected(): Promise<{ connected: boolean; savedAt?: string }> {
  const stored = await readGmailRefreshToken();
  return stored ? { connected: true, savedAt: stored.savedAt } : { connected: false };
}

export type GmailThreadSummary = {
  id: string;
  from: string;
  subject: string;
  preview: string; // Gmail's own snippet
  receivedAt: string; // ISO
  unread: boolean;
};

function headerValue(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// Lists the most recent threads across the whole mailbox, newest first —
// mirrors what the old mock inbox showed (a flat recent list, not folders).
export async function listRecentThreads(maxResults = 25): Promise<GmailThreadSummary[]> {
  const auth = await authorizedClient();
  if (!auth) return [];

  const gmail = google.gmail({ version: "v1", auth });
  const { data } = await gmail.users.threads.list({
    userId: "me",
    maxResults,
  });

  const threads = data.threads ?? [];
  const summaries = await Promise.all(
    threads.map(async (t) => {
      if (!t.id) return null;
      const { data: thread } = await gmail.users.threads.get({
        userId: "me",
        id: t.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const latest = thread.messages?.[thread.messages.length - 1];
      if (!latest) return null;
      return {
        id: t.id,
        from: headerValue(latest.payload?.headers, "From"),
        subject: headerValue(latest.payload?.headers, "Subject") || "(no subject)",
        preview: thread.snippet ?? "",
        receivedAt: new Date(Number(latest.internalDate ?? Date.now())).toISOString(),
        unread: (latest.labelIds ?? []).includes("UNREAD"),
      } satisfies GmailThreadSummary;
    })
  );

  return summaries.filter((s): s is GmailThreadSummary => s !== null);
}

export type GmailMessageDetail = GmailThreadSummary & { bodyText: string };

// Extracts the first text/plain part, falling back to a stripped text/html
// part — good enough for a read-only preview pane, not a full MIME renderer.
function extractBody(payload: unknown): string {
  type Part = { mimeType?: string | null; body?: { data?: string | null } | null; parts?: Part[] | null };
  const root = payload as Part | undefined;
  if (!root) return "";

  function decode(data: string): string {
    return Buffer.from(data, "base64url").toString("utf8");
  }

  function walk(part: Part): string | null {
    if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
    for (const child of part.parts ?? []) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }

  const plain = walk(root);
  if (plain) return plain;

  function walkHtml(part: Part): string | null {
    if (part.mimeType === "text/html" && part.body?.data) return decode(part.body.data);
    for (const child of part.parts ?? []) {
      const found = walkHtml(child);
      if (found) return found;
    }
    return null;
  }
  const html = walkHtml(root);
  return html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}

export async function getThreadDetail(threadId: string): Promise<GmailMessageDetail | null> {
  const auth = await authorizedClient();
  if (!auth) return null;

  const gmail = google.gmail({ version: "v1", auth });
  const { data: thread } = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  const latest = thread.messages?.[thread.messages.length - 1];
  if (!latest) return null;

  return {
    id: threadId,
    from: headerValue(latest.payload?.headers, "From"),
    subject: headerValue(latest.payload?.headers, "Subject") || "(no subject)",
    preview: thread.snippet ?? "",
    receivedAt: new Date(Number(latest.internalDate ?? Date.now())).toISOString(),
    unread: (latest.labelIds ?? []).includes("UNREAD"),
    bodyText: extractBody(latest.payload) || thread.snippet || "",
  };
}
