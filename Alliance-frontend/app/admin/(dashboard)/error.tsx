"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Panel, Pill } from "./admin-ui";

// Catches failures in this route group's server components — most commonly
// a Blob store read rejecting (see app/lib/blob-store.ts), which previously
// crashed every admin page with the raw dev/500 overlay because no error
// boundary existed anywhere in the app.
export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isBlobIssue = /blob (read|write) failed/i.test(error.message);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Panel className="flex max-w-md flex-col items-center gap-3 px-8 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-[#fdecec]">
          <AlertTriangle className="size-5 text-[#c22]" />
        </span>
        <Pill tone="danger">DASHBOARD ERROR</Pill>
        <h2 className="text-[15.5px] font-bold text-ink">
          {isBlobIssue ? "Storage is temporarily unavailable" : "Something went wrong loading this page"}
        </h2>
        <p className="max-w-sm text-[13px] leading-[1.65] text-ink-muted">
          {isBlobIssue
            ? "AutoLink couldn't reach the data store. This usually resolves on its own — try again in a moment, or check the Vercel Blob dashboard if it persists."
            : "An unexpected error occurred. Try again, or come back to this page shortly."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="btn-glass mt-2 inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-bold"
        >
          <RefreshCw className="size-4" /> Try again
        </button>
      </Panel>
    </div>
  );
}
