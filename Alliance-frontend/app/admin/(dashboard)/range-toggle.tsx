"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AnalyticsRange } from "@/app/lib/admin-data";

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

// The range lives in the URL rather than component state so the Overview can
// stay a server component and read real figures per range — and so a chosen
// range survives a refresh or a shared link.
export function RangeToggle({ active }: { active: AnalyticsRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(range: AnalyticsRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex rounded-[9px] border border-slate-line bg-white p-1">
      {RANGES.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => select(option.value)}
          aria-pressed={active === option.value}
          className={`rounded-md px-4 py-2 text-[12.5px] transition-colors ${
            active === option.value
              ? "bg-ink font-semibold text-white"
              : "font-medium text-[#64748b] hover:text-primary"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
