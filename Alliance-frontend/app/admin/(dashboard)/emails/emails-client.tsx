"use client";

import { useState } from "react";
import { Mail, Info } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { Badge } from "@/app/components/ui/badge";
import type { MockEmail } from "@/app/lib/types";

export function EmailsClient({ emails }: { emails: MockEmail[] }) {
  const sorted = [...emails].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );
  const [selectedId, setSelectedId] = useState<string | null>(sorted[0]?.id ?? null);
  const selected = sorted.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Emails</h1>
        <p className="mt-1 text-sm text-muted-foreground">A preview of Alliance&apos;s shared inbox.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-secondary/60 p-3 text-sm text-secondary-foreground ring-1 ring-foreground/10">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>Preview only — not connected to a live mailbox.</span>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/15 p-10 text-center text-sm text-muted-foreground">
          No emails to show.
        </div>
      ) : (
        <div className="grid gap-4 overflow-hidden rounded-xl ring-1 ring-foreground/10 lg:grid-cols-[340px_1fr]">
          <div className="max-h-[32rem] divide-y divide-border overflow-y-auto bg-card lg:max-h-[36rem]">
            {sorted.map((email) => (
              <button
                key={email.id}
                type="button"
                onClick={() => setSelectedId(email.id)}
                className={cn(
                  "block w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
                  selectedId === email.id && "bg-muted"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{email.from}</p>
                  <Badge variant={email.status === "pending" ? "default" : "secondary"} className="shrink-0 transition-colors duration-200">
                    {email.status === "pending" ? "Pending" : "Received"}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-sm text-foreground/90">{email.subject}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{email.preview}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(email.receivedAt).toLocaleString()}
                </p>
              </button>
            ))}
          </div>

          <div className="min-h-[20rem] bg-card p-6">
            {selected ? (
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{selected.subject}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">From {selected.from}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(selected.receivedAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={selected.status === "pending" ? "default" : "secondary"} className="transition-colors duration-200">
                    {selected.status === "pending" ? "Pending" : "Received"}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{selected.preview}</p>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Mail className="size-8" />
                <p className="text-sm">Select an email to preview it.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
