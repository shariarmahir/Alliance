"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Undo2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import type { ContactRequest } from "@/app/lib/types";

const FILTERS: { value: "all" | "unhandled" | "handled"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unhandled", label: "Unhandled" },
  { value: "handled", label: "Handled" },
];

function ContactRequestCard({ request, onChanged }: { request: ContactRequest; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function toggleHandled() {
    setBusy(true);
    const nextHandled = !request.handled;
    try {
      const res = await fetch(`/api/admin/contact-requests/${request.id}/handled`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handled: nextHandled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not update this request.");
        return;
      }
      toast.success(nextHandled ? "Marked as handled." : "Marked as unhandled.");
      onChanged();
    } catch {
      toast.error("Could not update this request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{request.subject}</p>
            <Badge variant={request.handled ? "secondary" : "default"}>
              {request.handled ? "Handled" : "Unhandled"}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {request.name} &middot; {request.email}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{request.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Submitted {new Date(request.submittedAt).toLocaleString()}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={request.handled ? "outline" : "secondary"}
          disabled={busy}
          onClick={toggleHandled}
        >
          {request.handled ? (
            <>
              <Undo2 className="size-3.5" /> Mark Unhandled
            </>
          ) : (
            <>
              <Check className="size-3.5" /> Mark Handled
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function ContactRequestsClient({ initialRequests }: { initialRequests: ContactRequest[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unhandled" | "handled">("all");

  function refresh() {
    router.refresh();
  }

  const filtered = initialRequests.filter((r) => {
    if (filter === "handled") return r.handled;
    if (filter === "unhandled") return !r.handled;
    return true;
  });
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Contact Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submissions from the storefront&apos;s Contact Us form.
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unhandled" | "handled")}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/15 p-10 text-center text-sm text-muted-foreground">
          No contact requests in this view yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((request) => (
            <ContactRequestCard key={request.id} request={request} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
