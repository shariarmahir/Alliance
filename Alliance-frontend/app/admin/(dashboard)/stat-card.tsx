import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { Card } from "@/app/components/ui/card";

export function StatCard({
  label,
  value,
  deltaPct,
  icon: Icon,
}: {
  label: string;
  value: string;
  deltaPct: number;
  icon: LucideIcon;
}) {
  const positive = deltaPct >= 0;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="size-5 text-primary" />
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
