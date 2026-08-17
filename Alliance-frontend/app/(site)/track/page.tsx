"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageSearch } from "lucide-react";

const FIELD =
  "w-full rounded-md border border-[#dde3ea] bg-white px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/15";

export default function TrackLandingPage() {
  const router = useRouter();
  const [trackingId, setTrackingId] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = trackingId.trim();
    if (!id) return;
    router.push(`/track/${encodeURIComponent(id)}`);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-7 py-20 text-center">
      <PackageSearch className="size-14 text-primary" />
      <h1 className="mt-4 text-2xl font-bold tracking-[-0.02em] text-ink">Track your order</h1>
      <p className="mt-2 max-w-md text-[13.5px] leading-[1.7] text-ink-muted">
        Enter the tracking ID from your order confirmation to see live delivery status.
      </p>

      <form onSubmit={submit} className="mt-6 flex w-full max-w-sm flex-col gap-3">
        <input
          value={trackingId}
          onChange={(e) => setTrackingId(e.target.value)}
          placeholder="e.g. AIT-TRK-634UPDN9"
          className={`${FIELD} text-center font-mono`}
        />
        <button
          type="submit"
          disabled={!trackingId.trim()}
          className="btn-glass w-full disabled:pointer-events-none disabled:opacity-50"
        >
          Track order
        </button>
      </form>

      <p className="mt-5 text-xs text-[#8a94a6]">
        Can&apos;t find your tracking ID? WhatsApp{" "}
        <a
          href="https://wa.me/8801713116019"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono font-semibold text-primary hover:underline"
        >
          +8801713-116019
        </a>
      </p>
    </div>
  );
}
