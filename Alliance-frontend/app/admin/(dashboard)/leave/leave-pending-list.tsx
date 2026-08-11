"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import type { Employee, LeaveRequest, LeaveStatus } from "@/app/lib/types";

const STATUS_BADGE: Record<LeaveStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Pending", variant: "default" },
  approved: { label: "Approved", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
};

function LeaveRow({ request, employeeName, onChanged }: { request: LeaveRequest; employeeName: string; onChanged: () => void }) {
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
      toast.success(`Leave request ${status}.`);
      onChanged();
    } catch {
      toast.error("Could not update leave request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-foreground">{employeeName}</p>
        <p className="text-sm text-muted-foreground">
          {new Date(request.startDate).toLocaleDateString()} – {new Date(request.endDate).toLocaleDateString()}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{request.reason}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={STATUS_BADGE[request.status].variant}>{STATUS_BADGE[request.status].label}</Badge>
        {request.status === "pending" && (
          <>
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setStatus("approved")}>
              Approve
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => setStatus("rejected")}>
              Reject
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

// Pending-first list of leave requests across all employees, with
// approve/reject actions — the super-admin approval surface referenced by
// both the Employees -> Leave Requests tab and this shared /admin/leave page.
export function LeavePendingList({ requests, employees }: { requests: LeaveRequest[]; employees: Employee[] }) {
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  function employeeName(id: string): string {
    return employees.find((e) => e.id === id)?.name ?? "Unknown";
  }

  const sorted = [...requests].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-base font-medium text-foreground">Leave Requests</h2>
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground">
          No leave requests yet.
        </div>
      ) : (
        sorted.map((r) => <LeaveRow key={r.id} request={r} employeeName={employeeName(r.employeeId)} onChanged={refresh} />)
      )}
    </div>
  );
}
