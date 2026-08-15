"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import type { LeaveRequest, LeaveStatus } from "@/app/lib/types";

const STATUS_BADGE: Record<LeaveStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Pending", variant: "default" },
  approved: { label: "Approved", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
};

// Sub-admin's leave request form + their own submission history. Handles the
// no-employeeId case (original hardcoded subadmin@gmail.com mock account)
// gracefully — the form still submits but the route rejects it with a clear
// error rather than crashing.
export function LeaveRequestForm({ myRequests }: { myRequests: LeaveRequest[] }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not submit leave request.");
        toast.error(data.error ?? "Could not submit leave request.");
        return;
      }
      toast.success("Leave request submitted.");
      setStartDate("");
      setEndDate("");
      setReason("");
      router.refresh();
    } catch {
      toast.error("Could not submit leave request.");
    } finally {
      setSubmitting(false);
    }
  }

  const sorted = [...myRequests].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-[14px] font-bold text-ink">Request Leave</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        <h2 className="text-[14px] font-bold text-ink">Your Requests</h2>
        {sorted.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-slate-line bg-white p-8 text-center text-[13px] text-ink-muted">
            You haven&apos;t submitted any leave requests yet.
          </div>
        ) : (
          sorted.map((r) => (
            <Card key={r.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[12.5px] font-semibold text-ink">
                  {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                </p>
                <p className="text-[12.5px] text-ink-muted">{r.reason}</p>
              </div>
              <Badge variant={STATUS_BADGE[r.status].variant}>{STATUS_BADGE[r.status].label}</Badge>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
