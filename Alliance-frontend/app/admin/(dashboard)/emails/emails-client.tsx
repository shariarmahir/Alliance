"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { PageHeader, Panel, EmptyState, Pill } from "../admin-ui";
import type { MockEmail } from "@/app/lib/types";

// "Alliance Freight Forwarders <ops@...>" -> "AF". Falls back to the address.
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

export function EmailsClient({ emails }: { emails: MockEmail[] }) {
  const sorted = [...emails].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );
  const [selectedId, setSelectedId] = useState<string | null>(sorted[0]?.id ?? null);
  const selected = sorted.find((e) => e.id === selectedId) ?? null;
  const pending = sorted.filter((e) => e.status === "pending").length;

  return (
    <div className="space-y-4">
      <PageHeader title="Shared inbox" subtitle="A preview of AutoLink's shared mailbox.">
        {pending > 0 && <Pill tone="warn">{pending} PENDING</Pill>}
      </PageHeader>

      <div className="flex items-center gap-2.5 rounded-[10px] border border-tint-line bg-[#f4faff] px-4 py-3">
        <Pill tone="info">PREVIEW</Pill>
        <p className="text-[12.5px] text-[#00618f]">
          Sample data — not connected to a live mailbox.
        </p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState>No emails to show.</EmptyState>
      ) : (
        <Panel className="grid overflow-hidden lg:grid-cols-[340px_1fr]">
          <div className="max-h-128 overflow-y-auto border-b border-slate-line lg:max-h-144 lg:border-b-0 lg:border-r">
            {sorted.map((email) => {
              const active = selectedId === email.id;
              const unread = email.status === "pending";
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
                      unread ? "bg-accent/20 text-warn" : "bg-surface text-ink-muted"
                    )}
                  >
                    {initials(email.from)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-[12.5px]",
                          unread ? "font-bold text-ink" : "font-medium text-ink-soft"
                        )}
                      >
                        {email.from}
                      </span>
                      {unread && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}
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
            {selected ? (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-line pb-4">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-bold tracking-[-0.01em] text-ink">
                      {selected.subject}
                    </h2>
                    <p className="mt-1 text-[12.5px] text-ink-muted">From {selected.from}</p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-[#8a94a6]">
                      {new Date(selected.receivedAt).toLocaleString("en-GB")}
                    </p>
                  </div>
                  <Pill tone={selected.status === "pending" ? "warn" : "ok"}>
                    {selected.status === "pending" ? "PENDING" : "RECEIVED"}
                  </Pill>
                </div>
                <p className="text-[13px] leading-[1.75] text-ink-soft">{selected.preview}</p>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-muted">
                <Mail className="size-8" />
                <p className="text-[12.5px]">Select an email to preview it.</p>
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
