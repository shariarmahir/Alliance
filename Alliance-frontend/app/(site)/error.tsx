"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

// Catches failures in the storefront's server components — most commonly a
// Blob store read rejecting (see app/lib/blob-store.ts). Without this file
// (none existed anywhere in the app) that crash reached visitors as Next's
// raw 500 page with no way back to a working screen.
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent/15">
          <AlertTriangle className="size-6 text-accent" />
        </span>
        <h1 className="text-xl font-bold text-slate-900">We hit a snag loading this page</h1>
        <p className="text-[14px] leading-relaxed text-slate-600">
          Something went wrong on our end. Please try again — if it keeps happening, contact us at{" "}
          <a href="mailto:info@auto-bd.com" className="text-primary underline">
            info@auto-bd.com
          </a>{" "}
          and we&apos;ll sort it out.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="btn-glass inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-bold"
          >
            <RefreshCw className="size-4" /> Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-5 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:border-primary hover:text-primary"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
