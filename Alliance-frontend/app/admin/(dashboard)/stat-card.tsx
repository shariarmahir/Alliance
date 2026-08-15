import { cn } from "@/app/lib/utils";

export type StatCardTone = "primary" | "accent" | "emerald" | "terracotta";

// Design bundle: a 3px colour rule across the top, the figure in IBM Plex
// Mono, and a status pill underneath. No icon — the rule is the only accent.
const TONE_TOP: Record<StatCardTone, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  emerald: "bg-ok-dot",
  terracotta: "bg-[#e04545]",
};

export function StatCard({
  label,
  value,
  note,
  negative = false,
  tone = "primary",
}: {
  label: string;
  value: string;
  note: string;
  negative?: boolean;
  tone?: StatCardTone;
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-slate-line bg-white">
      <span className={cn("block h-[3px]", TONE_TOP[tone])} />
      <div className="p-4.5">
        <p className="mb-2 text-xs font-medium text-[#64748b]">{label}</p>
        <p className="mb-2.5 font-mono text-[27px] font-bold tracking-[-0.02em] text-ink">{value}</p>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[11.5px] font-semibold",
            negative ? "bg-[#fdecec] text-[#c22]" : "bg-ok-bg text-ok"
          )}
        >
          {note}
        </span>
      </div>
    </div>
  );
}
