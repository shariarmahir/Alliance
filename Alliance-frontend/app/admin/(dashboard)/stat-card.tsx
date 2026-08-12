import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { Card } from "@/app/components/ui/card";

export type StatCardTone = "primary" | "accent" | "emerald" | "terracotta";

const TONE_STYLES: Record<StatCardTone, { top: string; iconBg: string; iconText: string }> = {
  primary: { top: "from-primary to-primary/40", iconBg: "bg-primary/10", iconText: "text-primary" },
  accent: { top: "from-accent to-accent/40", iconBg: "bg-accent/15", iconText: "text-accent-dark" },
  emerald: { top: "from-emerald-500 to-emerald-500/40", iconBg: "bg-emerald-500/10", iconText: "text-emerald-600" },
  terracotta: { top: "from-orange-700 to-orange-700/40", iconBg: "bg-orange-700/10", iconText: "text-orange-800" },
};

export function StatCard({
  label,
  value,
  deltaPct,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  deltaPct: number;
  icon: LucideIcon;
  tone?: StatCardTone;
}) {
  const positive = deltaPct >= 0;
  const styles = TONE_STYLES[tone];

  return (
    <Card className="group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <span className={cn("absolute inset-x-0 top-0 h-1 bg-linear-to-r", styles.top)} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
            styles.iconBg
          )}
        >
          <Icon className={cn("size-5", styles.iconText)} />
        </div>
      </div>
      <div
        className={cn(
          "mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
          positive ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
        )}
      >
        {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
        {Math.abs(deltaPct).toFixed(1)}%
        <span className="font-normal text-muted-foreground">vs last period</span>
      </div>
    </Card>
  );
}
