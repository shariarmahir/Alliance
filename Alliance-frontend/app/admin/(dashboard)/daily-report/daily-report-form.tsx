"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import type { DailyReport } from "@/app/lib/types";
import { apiFetch } from "@/app/lib/api-browser";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Sub-admin's daily report submission form + their own history. One
// submission per day is NOT enforced as a hard constraint per the spec —
// a same-day correction is just a new entry, not blocked or upserted.
export function DailyReportForm({ myReports }: { myReports: DailyReport[] }) {
  const router = useRouter();
  const [date, setDate] = useState(today());
  const [hoursWorked, setHoursWorked] = useState("8");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/admin/daily-reports", {
        method: "POST",
        body: { date, hoursWorked: Number(hoursWorked), summary },
      });
      toast.success("Daily report submitted.");
      setDate(today());
      setHoursWorked("8");
      setSummary("");
      router.refresh();
    } catch {
      toast.error("Could not submit daily report.");
    } finally {
      setSubmitting(false);
    }
  }

  const sorted = [...myReports].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-[14px] font-bold text-ink">Submit Daily Report</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hoursWorked">Hours Worked</Label>
              <Input
                id="hoursWorked"
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={hoursWorked}
                onChange={(e) => setHoursWorked(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Summary</Label>
            <Textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What did you work on today?" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        <h2 className="text-[14px] font-bold text-ink">Your Reports</h2>
        {sorted.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-slate-line bg-white p-8 text-center text-[13px] text-ink-muted">
            You haven&apos;t submitted any daily reports yet.
          </div>
        ) : (
          sorted.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-semibold text-ink">{new Date(r.date).toLocaleDateString()}</p>
                <p className="text-[12.5px] text-ink-muted">{r.hoursWorked}h</p>
              </div>
              <p className="mt-1 text-[12.5px] text-ink-muted">{r.summary}</p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
