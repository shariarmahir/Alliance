"use client";

import { useMemo, useState } from "react";
import { cn } from "@/app/lib/utils";
import type { SafeEmployee, LeaveRequest } from "@/app/lib/types";

function toIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Compact month grid from the design bundle: a 7-column mono numeral grid
// where a day carrying leave is tinted rather than expanded into a cell with
// names — approved days go green, pending days amber, today gets a blue ring.
export function LeaveCalendar({
  requests,
  employees,
}: {
  requests: LeaveRequest[];
  employees: SafeEmployee[];
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = toIso(new Date());

  // Leading blanks are filled with trailing days of the previous month, shown
  // greyed — the bundle's grid never starts with empty holes.
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells = [
    ...Array.from({ length: startOffset }, (_, i) => ({
      day: prevMonthDays - startOffset + i + 1,
      outside: true,
      iso: null as string | null,
    })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      outside: false,
      iso: toIso(new Date(year, month, i + 1)),
    })),
  ];

  const byDay = useMemo(() => {
    const map = new Map<string, LeaveRequest["status"]>();
    for (const r of requests) {
      if (r.status === "rejected") continue;
      for (let d = new Date(r.startDate); toIso(d) <= r.endDate; d.setDate(d.getDate() + 1)) {
        const iso = toIso(d);
        // Approved wins over pending when two employees overlap on a day.
        if (r.status === "approved" || !map.has(iso)) map.set(iso, r.status);
      }
    }
    return map;
  }, [requests]);

  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long" });
  const onLeave = employees.length;

  return (
    <div className="rounded-[10px] border border-slate-line bg-white p-4.5">
      <div className="mb-3.5 flex items-center justify-between">
        <p className="text-[14px] font-bold text-ink">Leave calendar — {monthLabel}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="flex size-6 items-center justify-center rounded border border-slate-line text-[11px] text-ink-muted transition-colors hover:border-primary hover:text-primary"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="flex size-6 items-center justify-center rounded border border-slate-line text-[11px] text-ink-muted transition-colors hover:border-primary hover:text-primary"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1 text-center font-mono text-[9.5px] font-semibold text-[#8a94a6]">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11.5px] text-ink-soft">
        {cells.map((cell, idx) => {
          const status = cell.iso ? byDay.get(cell.iso) : undefined;
          const isToday = cell.iso === todayIso;
          return (
            <span
              key={idx}
              className={cn(
                "rounded-[5px] py-1.5",
                cell.outside && "text-[#c8d0da]",
                status === "approved" && "bg-ok-bg text-ok",
                status === "pending" && "bg-warn-bg text-warn",
                isToday && "border border-primary font-semibold text-primary"
              )}
            >
              {cell.day}
            </span>
          );
        })}
      </div>

      <div className="mt-3.5 flex gap-3.5 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-xs bg-ok-dot" />
          Approved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-xs bg-accent" />
          Pending
        </span>
        {onLeave > 0 && (
          <span className="ml-auto font-mono text-[10.5px] text-[#8a94a6]">
            {onLeave} ON ROSTER
          </span>
        )}
      </div>
    </div>
  );
}
