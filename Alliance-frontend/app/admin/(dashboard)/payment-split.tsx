import Link from "next/link";
import { ArrowRight, Clock3, Wallet } from "lucide-react";
import { formatPrice } from "@/app/lib/utils";

/**
 * The collected/owed breakdown of revenue, shown on the Overview and linking
 * through to Orders where payment is actually recorded. Reads the same figures
 * the Orders screen does, so the two cannot disagree about what was collected.
 *
 * The bar is the point: two numbers side by side invite mental arithmetic,
 * while their proportions answer "how much of what we sold has actually
 * arrived?" at a glance.
 */
export function PaymentSplit({
  received,
  receivedCount,
  pending,
  pendingCount,
  rangeLabel,
}: {
  received: number;
  receivedCount: number;
  pending: number;
  pendingCount: number;
  rangeLabel: string;
}) {
  const total = received + pending;
  const receivedPct = total > 0 ? (received / total) * 100 : 0;

  return (
    <div className="min-w-0 rounded-[10px] border border-slate-line bg-white p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="mb-0.5 text-[15px] font-bold text-ink">Payments</p>
          <p className="text-[11.5px] text-[#8a94a6]">
            Received {rangeLabel} &middot; outstanding across all unpaid orders
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary transition-colors hover:text-primary-dark"
        >
          Record payments <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[#64748b]">
            <Wallet className="size-3.5 text-ok-dot" />
            Received payments
          </p>
          <p className="font-mono text-[20px] font-bold tracking-[-0.02em] text-ink">
            {formatPrice(received)}
          </p>
          <p className="mt-0.5 text-[11.5px] text-[#8a94a6]">
            {receivedCount} {receivedCount === 1 ? "order" : "orders"} paid
          </p>
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[#64748b]">
            <Clock3 className="size-3.5 text-accent-dark" />
            Pending payments
          </p>
          <p className="font-mono text-[20px] font-bold tracking-[-0.02em] text-ink">
            {formatPrice(pending)}
          </p>
          <p className="mt-0.5 text-[11.5px] text-[#8a94a6]">
            {pendingCount} {pendingCount === 1 ? "order" : "orders"} awaiting payment
          </p>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-4">
          <div className="flex h-2 overflow-hidden rounded-full bg-surface">
            <div className="bg-ok-dot" style={{ width: `${receivedPct}%` }} />
            <div className="flex-1 bg-accent" />
          </div>
          <p className="mt-2 text-[11.5px] text-[#8a94a6]">
            {Math.round(receivedPct)}% of this value collected
          </p>
        </div>
      )}
    </div>
  );
}
