"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { TaskCompletionChart } from "../charts/task-completion-chart";
import type { Task, TaskStatus } from "@/app/lib/types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "in-progress", label: "In Progress" },
  { status: "completed", label: "Completed" },
];

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  pending: "in-progress",
  "in-progress": "completed",
  completed: null,
};

const NEXT_LABEL: Record<TaskStatus, string> = {
  pending: "Start",
  "in-progress": "Mark Complete",
  completed: "",
};

function TaskCard({ task, onChanged }: { task: Task; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const next = NEXT_STATUS[task.status];

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
    <Card className="p-4 transition-all duration-200 hover:shadow-md">
      <p className="font-medium text-foreground">{task.title}</p>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
      <p className="mt-2 text-xs text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString()}</p>
      {next && (
        <Button type="button" size="sm" variant="secondary" className="mt-3 w-full" disabled={busy} onClick={advance}>
          {NEXT_LABEL[task.status]} <ArrowRight className="size-3.5" />
        </Button>
      )}
    </Card>
  );
}

export function TasksClient({ initialTasks }: { initialTasks: Task[] }) {
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Task Desk</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your assigned tasks — move them along as you work.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const tasks = initialTasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">{col.label}</h2>
                <Badge variant="secondary" className="transition-colors duration-200">{tasks.length}</Badge>
              </div>
              {tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-foreground/15 p-6 text-center text-xs text-muted-foreground">
                  No tasks here.
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} onChanged={refresh} />
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
