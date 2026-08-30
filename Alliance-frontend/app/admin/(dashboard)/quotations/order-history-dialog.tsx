"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  History,
  Inbox,
  FileText,
  Mail,
  CheckCircle2,
  FileUp,
  Receipt,
  Truck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { formatPrice } from "@/app/lib/utils";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import type { Quotation } from "@/app/lib/types";

// Section C of the client's specification: complete traceability from the
// customer's first enquiry through to delivery and payment, in one place
// rather than spread over four screens.

type HistoryEvent = {
  kind: "request" | "quotation" | "email" | "confirmed" | "po" | "invoice" | "challan";
  label: string;
  reference: string;
  detail: string;
  status: string;
  amount: number | null;
  at: string | null;
};

type OrderHistory = {
  quotationId: string;
  customerName: string;
  refNumber: string;
  poNumber: string;
  poDocumentUrl: string | null;
  events: HistoryEvent[];
};

// Each stage gets its own mark so the timeline can be read at a glance
// without parsing the label text.
const MARK: Record<HistoryEvent["kind"], { icon: typeof Inbox; tint: string }> = {
  request: { icon: Inbox, tint: "text-[#8a94a6] bg-[#f1f4f8]" },
  quotation: { icon: FileText, tint: "text-primary bg-[#eaf4fb]" },
  email: { icon: Mail, tint: "text-[#8a6400] bg-[#fff8e6]" },
  confirmed: { icon: CheckCircle2, tint: "text-ok-dot bg-[#e9f7f0]" },
  po: { icon: FileUp, tint: "text-[#8a6400] bg-[#fff8e6]" },
  invoice: { icon: Receipt, tint: "text-primary bg-[#eaf4fb]" },
  challan: { icon: Truck, tint: "text-ok-dot bg-[#e9f7f0]" },
};

function when(at: string | null): string {
  if (!at) return "—";
  return new Date(at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Section C's combined document flow, as a progress strip. The timeline
// below says what happened; this says where the order sits now and what
// comes next, which is the "better control" the section asks for.
const FLOW = [
  "Price Request",
  "Quotation",
  "Submitted",
  "Approved Order",
  "Work Order/PO",
  "Invoice",
  "Challan",
  "Payment/Delivery",
  "Completed",
] as const;

// Derived from the events already fetched rather than from a stored stage:
// a stage column could disagree with the documents, and the documents are
// what an auditor reads.
function reachedThrough(history: OrderHistory | null): number {
  if (!history) return 0;
  const kinds = new Set(history.events.map((e) => e.kind));
  let reached = 1; // the request itself always exists
  if (kinds.has("quotation")) reached = 2;
  if (kinds.has("email")) reached = 3;
  if (kinds.has("confirmed")) reached = 4;
  if (kinds.has("po")) reached = 5;
  if (kinds.has("invoice")) reached = 6;
  if (kinds.has("challan")) reached = 7;

  const paid = history.events.some(
    (e) => e.kind === "invoice" && (e.status === "paid" || e.status === "completed")
  );
  const delivered = history.events.some(
    (e) => e.kind === "challan" && e.status === "delivered"
  );
  if (paid || delivered) reached = 8;
  if (paid && delivered) reached = 9;
  return reached;
}

function FlowStrip({ history }: { history: OrderHistory | null }) {
  const reached = reachedThrough(history);

  return (
    <ol className="mb-4 flex flex-wrap items-center gap-1 rounded-md border border-[#e4ecf4] bg-[#f7fafd] p-2.5">
      {FLOW.map((label, i) => {
        const step = i + 1;
        const done = step < reached;
        const current = step === reached;
        return (
          <li key={label} className="flex items-center gap-1">
            <span
              className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${
                current
                  ? "bg-primary text-white"
                  : done
                    ? "bg-[#e9f7f0] text-ok-dot"
                    : "text-[#a8b2c1]"
              }`}
            >
              {label}
            </span>
            {i < FLOW.length - 1 && (
              <span className={done ? "text-ok-dot" : "text-[#d4dbe4]"}>›</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function OrderHistoryDialog({ quotation }: { quotation: Quotation }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<OrderHistory | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetched on open rather than with the list: a timeline nobody has asked
  // for is a query per row on every page load.
  async function load(next: boolean) {
    setOpen(next);
    if (!next || history) return;
    setLoading(true);
    try {
      setHistory(
        await apiFetch<OrderHistory>(
          `/api/admin/quotations/${encodeURIComponent(quotation.id)}/history`
        )
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load the order history."
      );
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={load}>
      <DialogTrigger className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary">
        <History className="size-3.5" /> History
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Order history</DialogTitle>
          <DialogDescription className="text-[12.5px] text-ink-muted">
            {quotation.details.companyName}
            {history?.refNumber ? ` · ${history.refNumber}` : ""}
            {history?.poNumber ? ` · PO ${history.poNumber}` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-[13px] text-ink-muted">Loading…</p>
        ) : (
          <>
          <FlowStrip history={history} />
          <ol className="max-h-[55vh] space-y-0 overflow-y-auto">
            {(history?.events ?? []).map((event, i, all) => {
              const mark = MARK[event.kind];
              const Icon = mark.icon;
              return (
                <li key={`${event.kind}-${i}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full ${mark.tint}`}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    {/* No tail on the last entry, so the line stops at the
                        final event rather than trailing into empty space. */}
                    {i < all.length - 1 && <span className="w-px flex-1 bg-[#e4e9ef]" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-5">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13px] font-semibold text-ink">{event.label}</span>
                      {event.reference && (
                        <span className="font-mono text-[11.5px] text-primary">
                          {event.reference}
                        </span>
                      )}
                      {event.status && (
                        <span className="mono-label text-[10px] text-ink-muted">
                          {event.status.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11.5px] text-ink-muted">
                      <span className="font-mono">{when(event.at)}</span>
                      {event.detail && <span>· {event.detail}</span>}
                      {event.amount !== null && (
                        <span className="font-mono font-semibold text-ink-soft">
                          · {formatPrice(event.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
