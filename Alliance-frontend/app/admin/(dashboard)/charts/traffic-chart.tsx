// Design bundle renders site traffic as a headline session count plus a
// 14-bar sparkline that deepens in colour toward today. Static bars — no
// Recharts needed at this size, and it keeps the panel a server component.
const BARS = [38, 46, 41, 55, 62, 51, 44, 66, 72, 58, 80, 74, 88, 100];

function barColor(height: number) {
  if (height >= 95) return "bg-primary";
  if (height >= 75) return "bg-[#3ea5e8]";
  if (height >= 60) return "bg-[#9fd2f0]";
  return "bg-tint-line";
}

export function TrafficChart() {
  return (
    <div className="rounded-[10px] border border-slate-line bg-white p-5">
      <div className="mb-3.5 flex items-baseline justify-between">
        <p className="text-[15px] font-bold text-ink">Site traffic</p>
        <span className="font-mono text-[11px] text-[#8a94a6]">28 DAYS</span>
      </div>
      <p className="mb-0.5 font-mono text-2xl font-bold text-ink">64,180</p>
      <p className="mb-4 text-[11.5px] font-semibold text-ok">↑ 9.6% sessions · 3.4% request rate</p>

      <div className="flex h-24 items-end gap-1">
        {BARS.map((h, i) => (
          <span
            key={i}
            className={`flex-1 rounded-t-sm ${barColor(h)}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10.5px] text-[#8a94a6]">
        <span>28 DAYS AGO</span>
        <span>TODAY</span>
      </div>
    </div>
  );
}
