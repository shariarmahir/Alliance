"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Employee, LeaveRequest, LeaveStatus } from "@/app/lib/types";

const STATUS_LABEL: Record<LeaveStatus, { label: string; cls: string }> = {
  pending: { label: "PENDING", cls: "text-warn" },
  approved: { label: "APPROVED", cls: "text-ok" },
  rejected: { label: "DECLINED", cls: "text-[#c22]" },
};

// "17–19 AUG" / "5–6 AUG" — the compact mono range the bundle puts on each card.
function dateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const month = e.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
  if (s.getMonth() === e.getMonth()) {
    return s.getDate() === e.getDate()
      ? `${s.getDate()} ${month}`
      : `${s.getDate()}–${e.getDate()} ${month}`;
  }
  const sMonth = s.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
  return `${s.getDate()} ${sMonth} – ${e.getDate()} ${month}`;
}

function daysBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1;
}

// Pending requests get the full card with Approve/Decline; already-decided ones
// collapse to a single quiet row, per the design.
function PendingCard({
  request,
  employeeName,
  onChanged,
}: {
  request: LeaveRequest;
  employeeName: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function setStatus(status: "approved" | "rejected") {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/leave-requests/${request.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not update leave request.");
        return;
      }
      toast.success(status === "approved" ? "Leave approved." : "Leave declined.");
      onChanged();
    } catch {
      toast.error("Could not update leave request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-2.5 rounded-lg border border-slate-line bg-surface p-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <strong className="text-[12.5px] font-semibold text-ink">{employeeName}</strong>
        <span className="shrink-0 font-mono text-[10.5px] font-medium text-warn">
          {dateRange(request.startDate, request.endDate)}
        </span>
      </div>
      <p className="mb-3 text-[11.5px] leading-[1.6] text-ink-muted">{request.reason}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => setStatus("approved")}
          className="flex-1 rounded-[7px] bg-ok-dot py-2 text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setStatus("rejected")}
          className="flex-1 rounded-[7px] border border-[#dde3ea] py-2 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-[#e04545] hover:text-[#c22] disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

export function LeavePendingList({
  requests,
  employees,
}: {
  requests: LeaveRequest[];
  employees: Employee[];
}) {
  const router = useRouter();

  function employeeName(id: string): string {
    return employees.find((e) => e.id === id)?.name ?? "Unknown";
  }

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests
    .filter((r) => r.status !== "pending")
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 4);

  const daysTaken = requests
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + daysBetween(r.startDate, r.endDate), 0);
  const allocated = employees.length * 21;

  return (
    <div className="rounded-[10px] border border-slate-line bg-white p-4.5">
      <p className="mb-3 text-[14px] font-bold text-ink">Leave requests</p>

      {requests.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-ink-muted">No leave requests yet.</p>
      ) : (
        <>
          {pending.map((r) => (
            <PendingCard
              key={r.id}
              request={r}
              employeeName={employeeName(r.employeeId)}
              onChanged={() => router.refresh()}
            />
          ))}

          {decided.map((r) => (
            <div
              key={r.id}
              className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-hairline px-3.5 py-2.5 text-[12px] text-ink-muted last:mb-0"
            >
              <span className="min-w-0 truncate">
                {employeeName(r.employeeId)} · {dateRange(r.startDate, r.endDate)}
              </span>
              <span className={`shrink-0 font-mono text-[10.5px] font-semibold ${STATUS_LABEL[r.status].cls}`}>
                {STATUS_LABEL[r.status].label}
              </span>
            </div>
          ))}

          {allocated > 0 && (
            <p className="mt-3 text-[11.5px] text-[#8a94a6]">
              Monthly report: {daysTaken} day{daysTaken === 1 ? "" : "s"} taken of {allocated}{" "}
              allocated.
            </p>
          )}
        </>
      )}
    </div>
  );
}
