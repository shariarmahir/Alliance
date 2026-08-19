"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Loader2, PlugZap, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { PageHeader, Panel, EmptyState, Pill } from "../admin-ui";

type ThreadSummary = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
};

type ThreadDetail = ThreadSummary & { bodyText: string };

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

function ConnectPanel() {
  return (
    <Panel className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-tint">
        <PlugZap className="size-5 text-primary" />
      </span>
      <h2 className="text-[15.5px] font-bold text-ink">Connect info@auto-bd.com</h2>
      <p className="max-w-sm text-[13px] leading-[1.65] text-ink-muted">
        Sign in as the mailbox once to see real messages here — AutoLink only reads mail, it never
        sends or deletes anything through this connection.
      </p>
      <Link
        href="/api/admin/emails/oauth/start"
        className="btn-glass mt-2 inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-bold"
      >
        <PlugZap className="size-4" /> Connect Gmail
      </Link>
    </Panel>
  );
}

// useSearchParams() requires a Suspense boundary above it or the build fails
// at static-generation time (not caught by tsc/eslint) — this thin wrapper is
// the boundary, EmailsClientInner does the actual work.
export function EmailsClient(props: { connected: boolean; connectedSince: string | null }) {
  return (
    <Suspense fallback={null}>
      <EmailsClientInner {...props} />
    </Suspense>
  );
}

function EmailsClientInner({
  connected: initiallyConnected,
  connectedSince,
}: {
  connected: boolean;
  connectedSince: string | null;
}) {
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
      const res = await fetch("/api/admin/emails");
      const data = await res.json().catch(() => ({}));
      setConnected(Boolean(data.connected));
      setThreads(data.threads ?? []);
      if (data.threads?.[0]) setSelectedId((id) => id ?? data.threads[0].id);
    } catch {
      toast.error("Could not load the inbox.");
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
        const res = await fetch(`/api/admin/emails/${selectedId}`);
        const data = await res.json();
        if (!cancelled) setDetail(data.thread ?? null);
      } catch {
        if (!cancelled) toast.error("Could not load that message.");
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
      const res = await fetch("/api/admin/emails", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not disconnect.");
        return;
      }
      setConnected(false);
      setThreads([]);
      setSelectedId(null);
      toast.success("Gmail disconnected.");
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
          <button
            type="button"
            onClick={disconnect}
            disabled={disconnecting}
            className="inline-flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold text-ink-muted transition-colors hover:text-[#c22] disabled:opacity-60"
          >
            <Unplug className="size-3.5" /> Disconnect
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-tint-line bg-[#f4faff] px-4 py-3">
          <Pill tone="info">NOT CONNECTED</Pill>
          <p className="text-[12.5px] text-[#00618f]">
            Connect the info@auto-bd.com mailbox to see real messages here.
          </p>
        </div>
      )}

      {!connected ? (
        <ConnectPanel />
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
              const active = selectedId === email.id;
              return (
                <button
                  key={email.id}
                  type="button"
                  onClick={() => setSelectedId(email.id)}
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
            ) : visibleDetail ? (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-line pb-4">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-bold tracking-[-0.01em] text-ink">
                      {visibleDetail.subject}
                    </h2>
                    <p className="mt-1 text-[12.5px] text-ink-muted">From {visibleDetail.from}</p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-[#8a94a6]">
                      {new Date(visibleDetail.receivedAt).toLocaleString("en-GB")}
                    </p>
                  </div>
                  <Pill tone={visibleDetail.unread ? "warn" : "ok"}>
                    {visibleDetail.unread ? "UNREAD" : "READ"}
                  </Pill>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-[1.75] text-ink-soft">
                  {visibleDetail.bodyText}
                </p>
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
