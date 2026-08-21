"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Undo2 } from "lucide-react";
import { PageHeader, Panel, EmptyState, FilterBar, Pill, RowButton } from "../admin-ui";
import type { ContactRequest } from "@/app/lib/types";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import { useClientNow } from "@/app/lib/use-client-now";

// `now` is passed in rather than read here: Date.now() during render differs
// between the server and the browser, which React reports as a hydration
// mismatch. The caller supplies it from an effect, so the first paint matches
// what the server sent.
function ageLabel(submittedAt: string, now: number): string {
  const ms = now - new Date(submittedAt).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60_000))} M AGO`;
  if (hours < 24) return `${hours} H AGO`;
  return `${Math.floor(hours / 24)} D AGO`;
}

function ContactRequestCard({
  request,
  onChanged,
  now,
}: {
  request: ContactRequest;
  onChanged: () => void;
  now: number | null;
}) {
  const [busy, setBusy] = useState(false);

  async function toggleHandled() {
    setBusy(true);
    const nextHandled = !request.handled;
    try {
      // apiFetch, not fetch: a relative path resolves against this app's own
      // origin, which serves no API — in production that is a 404 the UI
      // reported as "Could not update this request."
      await apiFetch(`/api/admin/contact-requests/${request.id}/handled`, {
        method: "PATCH",
        body: { handled: nextHandled },
      });
      toast.success(nextHandled ? "Marked as handled." : "Marked as unhandled.");
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not update this request."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className={`p-4.5 ${request.handled ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-bold text-ink">{request.subject}</p>
            {request.handled ? (
              <Pill tone="ok">HANDLED</Pill>
            ) : (
              now !== null && <Pill tone="warn">{ageLabel(request.submittedAt, now)}</Pill>
            )}
          </div>
          <p className="text-[11.5px] text-[#8a94a6]">
            {request.name} ·{" "}
            <a href={`mailto:${request.email}`} className="font-mono text-primary hover:underline">
              {request.email}
            </a>
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.65] text-ink-soft">{request.message}</p>
          <p className="mt-2 font-mono text-[10.5px] text-[#8a94a6]">
            {new Date(request.submittedAt).toLocaleString("en-GB")}
          </p>
        </div>
        <RowButton
          tone={request.handled ? "neutral" : "ok"}
          disabled={busy}
          onClick={toggleHandled}
        >
          {request.handled ? (
            <>
              <Undo2 className="size-3.5" /> Reopen
            </>
          ) : (
            <>
              <Check className="size-3.5" /> Mark handled
            </>
          )}
        </RowButton>
      </div>
    </Panel>
  );
}

export function ContactRequestsClient({ initialRequests }: { initialRequests: ContactRequest[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unhandled" | "handled">("all");
  // Null during SSR; a real timestamp once mounted. Ages are omitted rather
  // than guessed while it is null — see useClientNow.
  const now = useClientNow();

  const unhandled = initialRequests.filter((r) => !r.handled);
  const filtered = initialRequests.filter((r) => {
    if (filter === "handled") return r.handled;
    if (filter === "unhandled") return !r.handled;
    return true;
  });

  // Unanswered first, oldest at the top — the sidebar promo counts exactly this.
  const sorted = [...filtered].sort((a, b) => {
    if (a.handled !== b.handled) return a.handled ? 1 : -1;
    const at = new Date(a.submittedAt).getTime();
    const bt = new Date(b.submittedAt).getTime();
    return a.handled ? bt - at : at - bt;
  });

  const oldest = unhandled.reduce<string | null>(
    (acc, r) => (!acc || new Date(r.submittedAt) < new Date(acc) ? r.submittedAt : acc),
    null
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contact requests"
        subtitle="Enquiries submitted from the storefront's contact form."
      >
        <FilterBar
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: initialRequests.length },
            { value: "unhandled", label: "Unanswered", count: unhandled.length },
            {
              value: "handled",
              label: "Handled",
              count: initialRequests.length - unhandled.length,
            },
          ]}
        />
      </PageHeader>

      {unhandled.length > 0 && oldest && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-tint-line bg-[#f4faff] px-4 py-3">
          <Pill tone="info">{unhandled.length} OPEN</Pill>
          <p className="text-[12.5px] text-[#00618f]">
            {unhandled.length} unanswered
            {now !== null && `, oldest ${ageLabel(oldest, now).toLowerCase()}`}.
          </p>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState>No contact requests in this view yet.</EmptyState>
      ) : (
        <div className="space-y-3">
          {sorted.map((request) => (
            <ContactRequestCard
              key={request.id}
              request={request}
              onChanged={() => router.refresh()}
              now={now}
            />
          ))}
        </div>
      )}
    </div>
  );
}
