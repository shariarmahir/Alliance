"use client";

import { useState } from "react";
import Link from "next/link";

type Tab = "overview" | "specifications" | "repair";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "specifications", label: "Specifications" },
  { id: "repair", label: "Repair & exchange" },
];

export function ProductDetailTabs({
  description,
  specifications,
  repairRoute,
}: {
  description: string[];
  specifications: Record<string, string>;
  repairRoute: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div>
      <div className="mt-5.5 flex gap-6 overflow-x-auto border-b border-slate-line text-[13px] font-semibold text-[#64748b]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap pb-2.5 transition-colors ${
              tab === t.id ? "border-b-2 border-accent text-ink" : "hover:text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <ul className="mt-4 list-disc space-y-1 pl-4.5 text-[13.5px] leading-[1.85] text-ink-soft">
          {description.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}

      {tab === "specifications" && (
        <table className="mt-4 w-full overflow-hidden rounded-[10px] border border-slate-line text-[13px]">
          <tbody>
            {Object.entries(specifications).map(([key, value], i) => (
              <tr key={key} className={i % 2 === 0 ? "bg-surface" : "bg-white"}>
                <td className="w-[44%] border-b border-slate-line px-4 py-3 font-semibold text-ink-soft">
                  {key}
                </td>
                <td className="border-b border-slate-line px-4 py-3 text-ink-muted">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "repair" && (
        <div className="mt-4 rounded-[10px] border border-slate-line bg-[#0d1626] p-5">
          <p className="mono-label mb-1.5 text-[11px] tracking-[0.1em] text-accent">REPAIR ROUTE</p>
          <p className="mb-3.5 text-[13px] leading-[1.7] text-white/[0.72]">{repairRoute}</p>
          <div className="flex flex-wrap gap-2.5">
            <a
              href="https://wa.me/8801713116019"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-white/[0.28] bg-white/[0.13] px-4.5 py-2.5 text-[13px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/[0.22]"
            >
              WhatsApp an engineer
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-md px-4.5 py-2.5 text-[13px] font-semibold text-white/75 transition-colors hover:text-white"
            >
              Request a call back
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
