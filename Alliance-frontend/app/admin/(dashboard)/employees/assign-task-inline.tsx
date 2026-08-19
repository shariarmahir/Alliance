"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SafeEmployee } from "@/app/lib/types";

// The design bundle puts task assignment inline on the employees screen rather
// than behind a dialog, with the priority as a chip row. Priority is presentation
// only — Task has no priority field, so it's folded into the description, which
// is what the task desk already surfaces.
const PRIORITIES = ["Normal", "Urgent", "Recurring weekly"] as const;
type Priority = (typeof PRIORITIES)[number];

function defaultDue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

export function AssignTaskInline({ employees }: { employees: SafeEmployee[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assigneeEmployeeId, setAssigneeEmployeeId] = useState("");
  const [dueDate, setDueDate] = useState(defaultDue);
  const [priority, setPriority] = useState<Priority>("Normal");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !assigneeEmployeeId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: priority === "Normal" ? title.trim() : `${priority} — ${title.trim()}`,
          assigneeEmployeeId,
          dueDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not assign task.");
        return;
      }
      toast.success(`"${title.trim()}" assigned.`);
      setTitle("");
      setPriority("Normal");
      router.refresh();
    } catch {
      toast.error("Could not assign task.");
    } finally {
      setSubmitting(false);
    }
  }

  const labelCls = "mono-label mb-1.5 block text-[10.5px] tracking-[0.06em] text-ink-muted";
  const fieldCls =
    "w-full rounded-[7px] border border-[#dde3ea] px-3 py-2.5 text-[12.5px] text-ink outline-none transition-colors focus:border-primary";

  return (
    <form onSubmit={handleSubmit} className="rounded-[10px] border border-slate-line bg-white p-4.5">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-bold text-ink">Assign a task</p>
        <span className="text-[11.5px] text-[#8a94a6]">
          Appears on the employee&apos;s task desk immediately
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
        <label className="block">
          <span className={labelCls}>TASK</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Photograph and list 40 new Omron arrivals"
            required
            className={fieldCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>ASSIGN TO</span>
          <select
            value={assigneeEmployeeId}
            onChange={(e) => setAssigneeEmployeeId(e.target.value)}
            required
            disabled={employees.length === 0}
            className={`${fieldCls} disabled:opacity-50`}
          >
            <option value="">Select employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>DUE</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            className={`${fieldCls} font-mono`}
          />
        </label>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              aria-pressed={priority === p}
              className={
                priority === p
                  ? "rounded-full border-[1.5px] border-primary bg-primary/[0.06] px-3 py-1.5 text-[11.5px] font-semibold text-[#00618f]"
                  : "rounded-full border border-[#dde3ea] px-3 py-1.5 text-[11.5px] font-medium text-ink-soft transition-colors hover:border-primary"
              }
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={submitting || employees.length === 0}
          className="btn-glass-accent rounded-md px-5 py-2.5 text-[12.5px] font-bold disabled:opacity-50"
        >
          {submitting ? "Assigning..." : "Assign task"}
        </button>
      </div>
    </form>
  );
}
