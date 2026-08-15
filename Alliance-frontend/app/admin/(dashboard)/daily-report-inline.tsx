"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Compact composer for the sub-admin task desk (design 2d), posting to the same
// endpoint as the full /admin/daily-report page. Date and hours use sensible
// defaults so the desk version is one field and one button.
export function DailyReportInline({ defaultHours = 8 }: { defaultHours?: number }) {
  const router = useRouter();
  const [summary, setSummary] = useState("");
  const [hours, setHours] = useState(String(defaultHours));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          hoursWorked: Number(hours),
          summary: summary.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not submit daily report.");
        return;
      }
      toast.success("Daily report sent to the super admin.");
      setSummary("");
      router.refresh();
    } catch {
      toast.error("Could not submit daily report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[10px] border border-slate-line bg-white p-4.5">
      <p className="mb-3 text-[14px] font-bold text-ink">Daily report</p>
      <textarea
        rows={5}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="What you closed today, what is blocked, what needs the super admin"
        className="w-full resize-y rounded-lg border border-[#dde3ea] px-3 py-2.5 text-[12.5px] leading-[1.7] text-ink outline-none transition-colors focus:border-primary"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[11.5px] text-[#8a94a6]">
          Hours today
          <input
            type="number"
            min="0"
            max="24"
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-16 rounded border border-[#dde3ea] px-2 py-1 font-mono text-[12px] text-ink outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          disabled={submitting || !summary.trim()}
          className="btn-glass-accent shrink-0 rounded-md px-4 py-2.5 text-[12px] font-bold disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send to super admin"}
        </button>
      </div>
    </form>
  );
}
