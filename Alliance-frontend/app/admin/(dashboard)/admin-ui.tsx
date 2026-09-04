import { cn } from "@/app/lib/utils";

// Shared presentation primitives for the admin screens, matching the tokens the
// Overview and Employees screens already use (design bundle 2a/2c). Keeping
// these in one place stops the six operational screens from drifting apart
// again the way they had before this pass.

export const TH =
  "mono-label px-4 py-2.5 text-left text-[10px] tracking-[0.07em] text-[#8a94a6]";
export const TD = "border-b border-[#f2f4f7] px-4 py-3";
export const ROW = "transition-colors hover:bg-surface";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="mb-1 text-[19px] font-bold tracking-[-0.02em] text-ink sm:text-[23px]">{title}</h1>
        <p className="text-[13px] text-ink-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-[10px] border border-slate-line bg-white", className)}>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-dashed border-slate-line bg-white p-10 text-center text-[13px] text-ink-muted">
      {children}
    </div>
  );
}

// Mono uppercase status chip — the bundle's one status vocabulary across every
// screen (SLA BREACH / PRICING / CONFIRMED / IN STOCK ...).
export type PillTone = "ok" | "warn" | "danger" | "info" | "neutral";

const PILL_TONE: Record<PillTone, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-[#fdecec] text-[#c22]",
  info: "bg-tint text-[#00618f]",
  neutral: "bg-[#f2f4f7] text-ink-muted",
};

export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-[5px] px-2.5 py-1 font-mono text-[10.5px] font-semibold whitespace-nowrap",
        PILL_TONE[tone]
      )}
    >
      {children}
    </span>
  );
}

// Segmented filter bar (Week/Month/Year on the Overview, status filters here).
export function FilterBar<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[9px] border border-slate-line bg-white p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "rounded-md px-4 py-2 text-[12.5px] transition-colors",
            value === opt.value
              ? "bg-ink font-semibold text-white"
              : "font-medium text-[#64748b] hover:text-primary"
          )}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span
              className={cn(
                "ml-1.5 font-mono text-[11px]",
                value === opt.value ? "text-white/60" : "text-[#8a94a6]"
              )}
            >
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// Small table action button. The screens use these in clusters of 2-3 per row,
// where shadcn's default Button is too tall and too loud.
export function RowButton({
  tone = "neutral",
  disabled,
  onClick,
  children,
}: {
  tone?: "primary" | "ok" | "danger" | "neutral";
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const tones = {
    primary: "border-primary/30 text-primary hover:border-primary hover:bg-tint",
    ok: "border-ok-dot/30 text-ok hover:border-ok-dot hover:bg-ok-bg",
    danger: "border-[#e04545]/30 text-[#c22] hover:border-[#e04545] hover:bg-[#fdecec]",
    neutral: "border-[#dde3ea] text-ink-soft hover:border-primary hover:text-primary",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-50",
        tones[tone]
      )}
    >
      {children}
    </button>
  );
}

/**
 * Placeholder for a panel that is still streaming in. Sized in rows rather
 * than a fixed height so the space it holds is close to what replaces it,
 * which keeps the grid from jumping as each panel lands.
 */
export function PanelSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn(
        "min-w-0 animate-pulse rounded-[10px] border border-slate-line bg-white p-5",
        className
      )}
      aria-hidden
    >
      <div className="mb-4 h-3.5 w-32 rounded bg-[#eef1f5]" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-[#f2f4f7]" style={{ width: `${92 - i * 11}%` }} />
        ))}
      </div>
    </div>
  );
}
