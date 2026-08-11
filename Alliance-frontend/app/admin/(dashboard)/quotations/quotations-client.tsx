"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { formatPrice } from "@/app/lib/utils";
import type { Quotation, QuotationStatus } from "@/app/lib/types";

const STATUS_BADGE: Record<QuotationStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Pending", variant: "default" },
  confirmed: { label: "Confirmed", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

const FILTERS: { value: "all" | QuotationStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
];

const LEAD_TIME_LABEL: Record<string, string> = {
  standard: "Standard",
  urgent: "Urgent",
  flexible: "Flexible",
};

const CONTACT_LABEL: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  whatsapp: "WhatsApp",
};

function QuotationDetailDialog({ quotation }: { quotation: Quotation }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Eye className="size-3.5" /> View
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quotation Details</DialogTitle>
          <DialogDescription>
            Submitted {new Date(quotation.details.submittedAt).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Items</h3>
            <div className="divide-y divide-border rounded-lg ring-1 ring-foreground/10">
              {quotation.items.map((item) => (
                <div key={item.slug} className="flex items-center justify-between gap-4 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.partNumber} &middot; {item.quantity} &times; {formatPrice(item.price)}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium text-foreground">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-right text-sm font-semibold text-foreground">
              Estimated Total: {formatPrice(quotation.total)}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</h3>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <p><span className="text-muted-foreground">Name:</span> {quotation.details.fullName}</p>
              <p><span className="text-muted-foreground">Job Title:</span> {quotation.details.jobTitle || "—"}</p>
              <p><span className="text-muted-foreground">Email:</span> {quotation.details.email}</p>
              <p><span className="text-muted-foreground">Phone:</span> {quotation.details.phone}</p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company</h3>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <p><span className="text-muted-foreground">Company:</span> {quotation.details.companyName}</p>
              <p><span className="text-muted-foreground">Country:</span> {quotation.details.country}</p>
              <p><span className="text-muted-foreground">Tax ID:</span> {quotation.details.taxId || "—"}</p>
              <p><span className="text-muted-foreground">Website:</span> {quotation.details.companyWebsite || "—"}</p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preferences</h3>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <p><span className="text-muted-foreground">Preferred Contact:</span> {CONTACT_LABEL[quotation.details.preferredContact]}</p>
              <p><span className="text-muted-foreground">Lead Time:</span> {LEAD_TIME_LABEL[quotation.details.leadTime]}</p>
            </div>
            {quotation.details.notes && (
              <p className="mt-2">
                <span className="text-muted-foreground">Notes:</span> {quotation.details.notes}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuotationRow({ quotation, onChanged }: { quotation: Quotation; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function setStatus(status: QuotationStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/quotations/${quotation.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not update quotation status.");
        return;
      }
      toast.success(`Quotation for ${quotation.details.companyName} marked ${status}.`);
      onChanged();
    } catch {
      toast.error("Could not update quotation status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="bg-card">
      <td className="px-4 py-3 font-medium text-foreground">{quotation.details.fullName}</td>
      <td className="px-4 py-3 text-muted-foreground">{quotation.details.companyName}</td>
      <td className="px-4 py-3 text-muted-foreground">{quotation.items.length}</td>
      <td className="px-4 py-3 font-medium text-foreground">{formatPrice(quotation.total)}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {new Date(quotation.details.submittedAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_BADGE[quotation.status].variant}>{STATUS_BADGE[quotation.status].label}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <QuotationDetailDialog quotation={quotation} />
          {quotation.status === "pending" && (
            <>
              <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setStatus("confirmed")}>
                Confirm
              </Button>
              <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => setStatus("cancelled")}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export function QuotationsClient({ initialQuotations }: { initialQuotations: Quotation[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | QuotationStatus>("all");

  function refresh() {
    router.refresh();
  }

  const filtered = filter === "all" ? initialQuotations : initialQuotations.filter((q) => q.status === filter);
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.details.submittedAt).getTime() - new Date(a.details.submittedAt).getTime()
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Quotations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review submitted quotation requests and confirm or cancel them.
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | QuotationStatus)}>
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
          No quotations in this view yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Est. Total</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((quotation) => (
                <QuotationRow key={quotation.id} quotation={quotation} onChanged={refresh} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
