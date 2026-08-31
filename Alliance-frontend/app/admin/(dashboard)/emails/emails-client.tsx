"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Loader2, PlugZap, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { PageHeader, Panel, EmptyState, Pill } from "../admin-ui";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import type { MailProvider } from "@/app/lib/admin-data";

type ThreadSummary = {
  id: string;
  // The list is of messages, but a message is opened by its *thread* id —
  // using the message id here 404s on any mail with a reply attached.
  threadId: string;
  from: string;
  subject: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
};

// One message within an opened thread.
type ThreadMessage = {
  id: string;
  from: string;
  to: string;
  subject: string;
  receivedAt: string;
  body: string;
};

type ThreadDetail = { id: string; messages: ThreadMessage[] };

// Gmail's Date header is an RFC 2822 string, and an unparseable one would
// otherwise render as "Invalid Date". Fixed timezone so the server and the
// browser agree — see the hydration note on the quotations screen.
function formatReceived(raw: string): string {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(parsed);
}

// "Padma Power <a.hasan@padma-power.com>" -> "PP". Falls back to the address.
function initials(from: string): string {
  const name = from.replace(/<[^>]*>/, "").trim() || from;
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function ConnectPanel({
  configured,
  provider,
  error,
}: {
  configured: boolean;
  provider: MailProvider;
  error: string | null;
}) {
  const [starting, setStarting] = useState(false);

  // The API hands back Google's consent URL as JSON rather than redirecting,
  // so this cannot be a plain link — following one would display the JSON.
  // Fetch the URL, then send the browser to Google.
  async function connect() {
    setStarting(true);
    try {
      const { url } = await apiFetch<{ url: string }>("/api/admin/emails/oauth/start");
      window.location.href = url;
    } catch (err) {
      // 503 means the Google credentials are not set on the server. Say that,
      // rather than a generic failure the admin cannot act on.
      const message =
        err instanceof ApiError && err.status === 503
          ? "Gmail sign-in is not configured on the server yet."
          : err instanceof ApiError
            ? err.message
            : "Could not start Gmail sign-in.";
      toast.error(message);
      setStarting(false);
    }
  }

  // IMAP has nothing for an admin to click: the mailbox is configured on the
  // server with its own password, so a failure here is a server problem to
  // report rather than a connection to authorise. Showing a Connect button
  // would be a dead end.
  if (provider === "imap") {
    return (
      <Panel className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-[#fdecec]">
          <PlugZap className="size-5 text-[#c22]" />
        </span>
        <h2 className="text-[15.5px] font-bold text-ink">
          Could not reach the mailbox
        </h2>
        <p className="max-w-md text-[13px] leading-[1.65] text-ink-muted">
          The mail server rejected the connection for info@auto-bd.com. This is
          set up on the server, so it needs the IMAP host, username and password
          checked there — most often the password is wrong, or the mailbox has
          not been created yet in the mail host&rsquo;s dashboard.
        </p>
        {error && (
          <p className="max-w-md rounded-md bg-surface px-3 py-2 font-mono text-[11.5px] text-ink-soft">
            {error}
          </p>
        )}
      </Panel>
    );
  }

  return (
    <Panel className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-tint">
        <PlugZap className="size-5 text-primary" />
      </span>
      <h2 className="text-[15.5px] font-bold text-ink">Connect info@auto-bd.com</h2>
      {/* Two different situations, and offering the button in the second one
          sends the admin to a dead end: the server has no Google credentials,
          so there is nothing for the button to open. */}
      <p className="max-w-sm text-[13px] leading-[1.65] text-ink-muted">
        {configured
          ? "Sign in as the mailbox once to see real messages here — AutoLink only reads mail, it never sends or deletes anything through this connection."
          : "No mailbox is set up on the server yet. Add either IMAP settings for info@auto-bd.com or Google sign-in credentials, and this screen will connect to it."}
      </p>
      {configured && (
        <button
          type="button"
          onClick={connect}
          disabled={starting}
          className="btn-glass mt-2 inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-bold disabled:opacity-60"
        >
          {starting ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
          {starting ? "Opening Google..." : "Connect Gmail"}
        </button>
      )}
    </Panel>
  );
}

// useSearchParams() requires a Suspense boundary above it or the build fails
// at static-generation time (not caught by tsc/eslint) — this thin wrapper is
// the boundary, EmailsClientInner does the actual work.
type EmailsClientProps = {
  configured: boolean;
  connected: boolean;
  connectedSince: string | null;
  provider: MailProvider;
  error: string | null;
};

export function EmailsClient(props: EmailsClientProps) {
  return (
    <Suspense fallback={null}>
      <EmailsClientInner {...props} />
    </Suspense>
  );
}

function EmailsClientInner({
  configured,
  connected: initiallyConnected,
  connectedSince,
  provider,
  error,
}: EmailsClientProps) {
  const searchParams = useSearchParams();
  const gmailError = searchParams.get("gmail_error");
  // The redirect back from Google's consent screen is the one moment
  // server-known state (initiallyConnected, computed before this component
  // existed) and the URL can disagree — deriving here instead of syncing via
  // an effect keeps there from being two sources of truth for "connected".
  const [connected, setConnected] = useState(
    initiallyConnected || searchParams.get("gmail_connected") === "true"
  );
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(initiallyConnected);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Toasts are a one-time side effect reacting to the redirect, not state
  // synchronization, so they stay in an effect — but nothing here calls
  // setState, which is what the lint rule actually objects to.
  useEffect(() => {
    if (gmailError) toast.error(`Could not connect Gmail: ${gmailError}`);
    else if (searchParams.get("gmail_connected") === "true") {
      toast.success("Gmail connected — showing real messages from info@auto-bd.com.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadThreads() {
    setLoading(true);
    try {
      const data = await apiFetch<{ connected: boolean; threads: ThreadSummary[] }>(
        "/api/admin/emails"
      );
      setConnected(Boolean(data.connected));
      setThreads(data.threads ?? []);
      // Open by thread id, not message id — see ThreadSummary.
      if (data.threads?.[0]) setSelectedId((id) => id ?? data.threads[0].threadId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load the inbox.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!connected || cancelled) return;
      await loadThreads();
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [connected]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    async function load() {
      setDetailLoading(true);
      try {
        // The endpoint returns the thread itself, not a { thread } wrapper.
        const thread = await apiFetch<ThreadDetail>(`/api/admin/emails/${selectedId}`);
        if (!cancelled) setDetail(thread ?? null);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.message : "Could not load that message.");
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Derived rather than nulled by an earlier effect run: once a thread has
  // never been selected, there is nothing to show — no separate "clear" step
  // needed when selectedId goes back to null.
  const visibleDetail = selectedId ? detail : null;

  async function disconnect() {
    setDisconnecting(true);
    try {
      // The connection lives at /connection; DELETE on the collection is a
      // different (nonexistent) route.
      await apiFetch("/api/admin/emails/connection", { method: "DELETE" });
      setConnected(false);
      setThreads([]);
      setSelectedId(null);
      setDetail(null);
      toast.success("Gmail disconnected.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not disconnect.");
    } finally {
      setDisconnecting(false);
    }
  }

  const unreadCount = threads.filter((t) => t.unread).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Shared inbox" subtitle="info@auto-bd.com">
        <div className="flex items-center gap-2">
          {connected && unreadCount > 0 && <Pill tone="warn">{unreadCount} UNREAD</Pill>}
          {connected && (
            <button
              type="button"
              onClick={loadThreads}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-line px-3 py-1.5 text-[12px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
            </button>
          )}
        </div>
      </PageHeader>

      {connected ? (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-ok-bg bg-ok-bg/40 px-4 py-3">
          <Pill tone="ok">LIVE</Pill>
          <p className="flex-1 text-[12.5px] text-ok">
            Connected to info@auto-bd.com
            {connectedSince && ` since ${new Date(connectedSince).toLocaleDateString("en-GB")}`}.
            Read-only — nothing is sent or deleted from here.
          </p>
          {/* Gmail only. An IMAP mailbox is configured in the server's
              environment, so there is no stored authorisation to revoke and
              nothing a button here could undo. */}
          {provider === "gmail" && (
            <button
              type="button"
              onClick={disconnect}
              disabled={disconnecting}
              className="inline-flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold text-ink-muted transition-colors hover:text-[#c22] disabled:opacity-60"
            >
              <Unplug className="size-3.5" /> Disconnect
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-tint-line bg-[#f4faff] px-4 py-3">
          <Pill tone={provider === "imap" ? "danger" : "info"}>
            {provider === "imap" ? "LOGIN FAILED" : configured ? "NOT CONNECTED" : "NOT SET UP"}
          </Pill>
          <p className="text-[12.5px] text-[#00618f]">
            {provider === "imap"
              ? "The mailbox is set up on the server but the mail server refused the connection."
              : configured
                ? "Connect the info@auto-bd.com mailbox to see real messages here."
                : "Mailbox access needs to be set up on the server before this inbox can be connected."}
          </p>
        </div>
      )}

      {!connected ? (
        <ConnectPanel configured={configured} provider={provider} error={error} />
      ) : loading ? (
        <Panel className="flex items-center justify-center gap-2 py-16 text-ink-muted">
          <Loader2 className="size-4 animate-spin" /> Loading inbox...
        </Panel>
      ) : threads.length === 0 ? (
        <EmptyState>No messages in the last 25 threads.</EmptyState>
      ) : (
        <Panel className="grid overflow-hidden lg:grid-cols-[340px_1fr]">
          <div className="scrollbar-slim max-h-128 overflow-y-auto border-b border-slate-line lg:max-h-144 lg:border-b-0 lg:border-r">
            {threads.map((email) => {
              // Selection is by thread id: opening a message fetches its
              // whole conversation, and the message id would not resolve.
              const active = selectedId === email.threadId;
              return (
                <button
                  key={email.id}
                  type="button"
                  onClick={() => setSelectedId(email.threadId)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full gap-3 border-b border-[#f2f4f7] px-4 py-3.5 text-left transition-colors last:border-b-0",
                    active ? "bg-tint" : "hover:bg-surface"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      email.unread ? "bg-accent/20 text-warn" : "bg-surface text-ink-muted"
                    )}
                  >
                    {initials(email.from)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-[12.5px]",
                          email.unread ? "font-bold text-ink" : "font-medium text-ink-soft"
                        )}
                      >
                        {email.from}
                      </span>
                      {email.unread && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-ink-soft">
                      {email.subject}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-[#8a94a6]">
                      {email.preview}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] text-[#8a94a6]">
                      {new Date(email.receivedAt).toLocaleString("en-GB")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="min-h-80 p-5 sm:p-6">
            {detailLoading ? (
              <div className="flex h-full items-center justify-center text-ink-muted">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : visibleDetail && visibleDetail.messages.length > 0 ? (
              <>
                <div className="mb-4 border-b border-slate-line pb-4">
                  <h2 className="text-[17px] font-bold tracking-[-0.01em] text-ink">
                    {visibleDetail.messages[0].subject}
                  </h2>
                  {visibleDetail.messages.length > 1 && (
                    <p className="mt-1 text-[12.5px] text-ink-muted">
                      {visibleDetail.messages.length} messages in this conversation
                    </p>
                  )}
                </div>
                {/* A thread is a conversation, not one message — rendering only
                    the first would hide every reply. */}
                <div className="space-y-5">
                  {visibleDetail.messages.map((message, index) => (
                    <article
                      key={message.id}
                      className={cn(index > 0 && "border-t border-slate-line pt-5")}
                    >
                      <p className="text-[12.5px] font-semibold text-ink">{message.from}</p>
                      {message.to && (
                        <p className="mt-0.5 text-[12px] text-ink-muted">To {message.to}</p>
                      )}
                      <p className="mt-0.5 font-mono text-[10.5px] text-[#8a94a6]">
                        {formatReceived(message.receivedAt)}
                      </p>
                      <p className="mt-2.5 whitespace-pre-wrap text-[13px] leading-[1.75] text-ink-soft">
                        {message.body}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-muted">
                <Mail className="size-8" />
                <p className="text-[12.5px]">Select a message to read it.</p>
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
