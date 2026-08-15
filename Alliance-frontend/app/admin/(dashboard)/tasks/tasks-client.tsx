"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { TaskCompletionChart } from "../charts/task-completion-chart";
import { PageHeader, Panel, Pill, type PillTone } from "../admin-ui";
import type { Task, TaskStatus } from "@/app/lib/types";

const COLUMNS: { status: TaskStatus; label: string; tone: PillTone }[] = [
  { status: "pending", label: "Pending", tone: "neutral" },
  { status: "in-progress", label: "In progress", tone: "warn" },
  { status: "completed", label: "Completed", tone: "ok" },
];

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  pending: "in-progress",
  "in-progress": "completed",
  completed: null,
};

const NEXT_LABEL: Record<TaskStatus, string> = {
  pending: "Start",
  "in-progress": "Mark complete",
  completed: "",
};

function TaskCard({ task, onChanged }: { task: Task; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const next = NEXT_STATUS[task.status];
  const overdue =
    task.status !== "completed" && task.dueDate < new Date().toISOString().slice(0, 10);

  async function advance() {
    if (!next) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not update task status.");
        return;
      }
      toast.success(`"${task.title}" moved to ${next.replace("-", " ")}.`);
      onChanged();
    } catch {
      toast.error("Could not update task status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">{task.title}</p>
        {overdue && <Pill tone="danger">OVERDUE</Pill>}
      </div>
      <p className="line-clamp-2 text-[12px] leading-[1.6] text-ink-muted">{task.description}</p>
      <p className="mt-2 font-mono text-[11px] text-[#8a94a6]">DUE {task.dueDate}</p>
      {next && (
        <button
          type="button"
          disabled={busy}
          onClick={advance}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-[#dde3ea] py-2 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {NEXT_LABEL[task.status]} <ArrowRight className="size-3.5" />
        </button>
      )}
    </Panel>
  );
}

export function TasksClient({ initialTasks }: { initialTasks: Task[] }) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Task desk"
        subtitle="Your assigned tasks — move them along as you work."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const tasks = initialTasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-bold text-ink">{col.label}</h2>
                <Pill tone={col.tone}>{tasks.length}</Pill>
              </div>
              {tasks.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-slate-line bg-white p-6 text-center text-[12px] text-ink-muted">
                  No tasks here.
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} onChanged={() => router.refresh()} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <TaskCompletionChart tasks={initialTasks} />
    </div>
  );
}
