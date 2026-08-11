import { PackageSearch } from "lucide-react";
import { TrackingTimeline } from "@/app/components/tracking-timeline";
import { addBusinessDays } from "@/app/lib/utils";

const STAGE_LABELS = ["Processing", "Shipped", "In Transit", "Delivered"];

function charCodeSum(str: string): number {
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
  return sum;
}

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ trackingId: string }>;
}) {
  const { trackingId } = await params;

  const seed = charCodeSum(trackingId);
  const currentStep = seed % 4;

  // Derive a stable base date from the tracking ID so reloads show the same dates.
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - (seed % 10));

  const steps = STAGE_LABELS.map((label, i) => ({
    label,
    date: addBusinessDays(baseDate, i * 2).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <PackageSearch className="size-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tracking: {trackingId}</h1>
          <p className="text-sm text-slate-600">Current status: {STAGE_LABELS[currentStep]}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <TrackingTimeline currentStep={currentStep} steps={steps} />
      </div>

      <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
        This is a live-tracking placeholder. Real-time courier integration is coming in a future release —
        for now, status is simulated based on your tracking ID.
      </p>
    </div>
  );
}
