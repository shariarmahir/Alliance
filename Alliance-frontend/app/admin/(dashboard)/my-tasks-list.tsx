"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import type { Task } from "@/app/lib/types";
import { apiFetch } from "@/app/lib/api-browser";

const STATUS_PILL: Record<Task["status"], { label: string; cls: string }> = {
  pending: { label: "PENDING", cls: "bg-[#f2f4f7] text-ink-muted" },
  "in-progress": { label: "IN PROGRESS", cls: "bg-warn-bg text-warn" },
  completed: { label: "COMPLETED", cls: "bg-ok-bg text-ok" },
};

const FILTERS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "completed", label: "Completed" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Task desk list from design 2d. Checkboxes are real: a sub-admin may flip
// their own task's status, which the API authorizes by assignee (403 otherwise).
export function MyTasksList({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("today");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(task: Task) {
    const next = task.status === "completed" ? "pending" : "completed";
    setBusyId(task.id);
    try {
      await apiFetch(`/api/admin/tasks/${encodeURIComponent(task.id)}/status`, {
        method: "PATCH",
        body: { status: next },
      });
      toast.success(next === "completed" ? "Task completed." : "Task reopened.");
      router.refresh();
    } catch {
      toast.error("Could not update task.");
    } finally {
      setBusyId(null);
    }
  }

  const today = isoToday();
  const weekEnd = isoInDays(7);
  const visible = tasks.filter((t) => {
    if (filter === "completed") return t.status === "completed";
    if (t.status === "completed") return false;
    return filter === "today" ? t.dueDate <= today : t.dueDate <= weekEnd;
  });

  return (
    <div className="overflow-hidden rounded-[10px] border border-slate-line bg-white">
      <div className="flex gap-5 border-b border-slate-line px-4.5 py-3.5 text-[12.5px]">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "pb-0.5 font-semibold transition-colors",
              filter === f.key
                ? "border-b-2 border-accent text-ink"
                : "text-[#64748b] hover:text-ink"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="px-4.5 py-10 text-center text-[13px] text-ink-muted">
          {filter === "completed" ? "Nothing completed yet." : "Nothing due in this window."}
        </p>
      ) : (
        visible.map((task) => {
          const done = task.status === "completed";
          const overdue = !done && task.dueDate < today;
          const pill = overdue
            ? { label: "OVERDUE", cls: "bg-[#fdecec] text-[#c22]" }
            : STATUS_PILL[task.status];
          return (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-3.5 border-b border-[#f2f4f7] px-4.5 py-4 last:border-b-0",
                done && "opacity-60"
              )}
            >
              <button
                type="button"
                disabled={busyId === task.id}
                onClick={() => toggle(task)}
                aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                aria-pressed={done}
                className={cn(
                  "flex size-4.5 shrink-0 items-center justify-center rounded-[5px] text-[11px] font-bold text-white transition-colors disabled:opacity-50",
                  done ? "bg-ok-dot" : "border-[1.5px] border-[#c8d0da] hover:border-primary"
                )}
              >
                {done ? "✓" : ""}
              </button>
              <span className="min-w-0 flex-1">
                <strong
                  className={cn(
                    "block text-[13px] font-semibold text-ink",
                    done && "line-through"
                  )}
                >
                  {task.title}
                </strong>
                <span className="font-mono text-[11.5px] text-[#8a94a6]">
                  DUE {task.dueDate}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-[5px] px-2.5 py-1 font-mono text-[10.5px] font-semibold ${pill.cls}`}
              >
                {pill.label}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
