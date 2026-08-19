import Link from "next/link";
import { PackageSearch, SearchX } from "lucide-react";
import { TrackingTimeline } from "@/app/components/tracking-timeline";
import { findByTrackingId } from "@/app/lib/admin-operations";
import { DELIVERY_STAGES, clampStage } from "@/app/lib/delivery";
import { formatPrice } from "@/app/lib/utils";

// Real delivery status, looked up by tracking ID. This page previously
// simulated a status by summing the tracking ID's character codes
// (charCodeSum(id) % 4), so any string produced a confident-looking timeline
// and a genuine order's true state was never shown. Stages are now advanced
// by an admin from the Orders screen and read straight off the confirmation.

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ trackingId: string }>;
}) {
  const { trackingId } = await params;
  const quotation = await findByTrackingId(trackingId);
  const confirmation = quotation?.confirmation;

  if (!confirmation) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-7 py-20 text-center">
        <SearchX className="size-14 text-[#c8d0da]" />
        <h1 className="mt-4 text-2xl font-bold tracking-[-0.02em] text-ink">
          No order found for that ID
        </h1>
        <p className="mt-2 max-w-md text-[13.5px] leading-[1.7] text-ink-muted">
          We couldn&apos;t find an order with tracking ID{" "}
          <strong className="font-mono text-ink">{trackingId}</strong>. Check the ID on your order
          confirmation, or contact us and we&apos;ll look it up for you.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/track" className="btn-glass">
            Try another ID
          </Link>
          <Link
            href="/contact"
            className="rounded-[9px] border border-slate-line px-5 py-3 text-[13.5px] font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
          >
            Contact us
          </Link>
        </div>
      </div>
    );
  }

  const stage = clampStage(confirmation.deliveryStage);
  const updatedAt = confirmation.deliveryUpdatedAt ?? confirmation.issuedAt;

  const steps = DELIVERY_STAGES.map((s, i) => ({
    label: s.label,
    // Only stages actually reached carry a date — a future stage showing a
    // confident date is the fabrication this page used to commit.
    date: i === stage ? new Date(updatedAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) : i < stage ? "Completed" : "Pending",
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <PackageSearch className="size-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-ink">
            Tracking: <span className="font-mono">{confirmation.trackingId}</span>
          </h1>
          <p className="text-sm text-ink-muted">
            Current status:{" "}
            <strong className="text-ink">{DELIVERY_STAGES[stage].label}</strong>
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-line bg-white p-8">
        <TrackingTimeline currentStep={stage} steps={steps} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-line bg-surface p-4">
          <span className="mono-label text-[10.5px] tracking-[0.07em] text-[#8a94a6]">
            REFERENCE
          </span>
          <p className="mt-1 font-mono text-[13.5px] font-semibold text-ink">
            {confirmation.refNumber}
          </p>
        </div>
        <div className="rounded-lg border border-slate-line bg-surface p-4">
          <span className="mono-label text-[10.5px] tracking-[0.07em] text-[#8a94a6]">ITEMS</span>
          <p className="mt-1 text-[13.5px] font-semibold text-ink">
            {confirmation.lines.length}{" "}
            {confirmation.lines.length === 1 ? "line" : "lines"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-line bg-surface p-4">
          <span className="mono-label text-[10.5px] tracking-[0.07em] text-[#8a94a6]">TOTAL</span>
          <p className="mt-1 text-[13.5px] font-semibold text-ink">
            {formatPrice(confirmation.grandTotal)}
          </p>
        </div>
      </div>

      <p className="mt-6 rounded-lg border border-tint-line bg-[#f4faff] p-4 text-[12.5px] leading-[1.65] text-[#00618f]">
        {DELIVERY_STAGES[stage].hint} Freight and delivery are arranged with you directly — reply to
        your quotation email or WhatsApp{" "}
        <a
          href="https://wa.me/8801713116019"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono font-semibold hover:underline"
        >
          +8801713-116019
        </a>{" "}
        for anything urgent.
      </p>
    </div>
  );
}
