import Link from "next/link";
import { readQuotations } from "@/app/lib/admin-data";

// The design's "Price requests needing an answer" table. Rows come from real
// data/quotations.json (not mock analytics) so the SLA ages are meaningful —
// the business quotes within 4 working hours, so anything older is a breach.
const SLA_HOURS = 4;

function ageLabel(submittedAt: string) {
  const ms = Date.now() - new Date(submittedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return { text: "—", hours: 0 };
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return { text: hours > 0 ? `${hours} h ${minutes} m` : `${minutes} m`, hours: ms / 3_600_000 };
}

export async function PendingQuotationsPanel() {
  const quotations = await readQuotations();
  // Matches the Quotations screen's Pending tab: a quoted request is still
  // open until it is confirmed or cancelled, so it belongs in this queue.
  const isOpen = (status: string) => status === "pending" || status === "quoted";
  const pending = quotations
    .filter((q) => isOpen(q.status))
    .sort(
      (a, b) =>
        new Date(a.details.submittedAt).getTime() - new Date(b.details.submittedAt).getTime()
    )
    .slice(0, 5);

  return (
    <div className="overflow-hidden rounded-[10px] border border-slate-line bg-white">
      <div className="flex items-center justify-between border-b border-slate-line px-5 py-4">
        <p className="text-[15px] font-bold text-ink">Price requests needing an answer</p>
        <Link href="/admin/quotations" className="text-xs font-semibold text-primary hover:underline">
          Open all {quotations.filter((q) => isOpen(q.status)).length} →
        </Link>
      </div>

      {pending.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13px] text-ink-muted">
          No price requests waiting. Everything is quoted.
        </p>
      ) : (
        <div className="scrollbar-slim overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-surface">
                {["REQUEST", "CLIENT", "COUNTRY", "AGE", "STATUS"].map((h) => (
                  <th
                    key={h}
                    className="mono-label px-5 py-2.5 text-left text-[10px] tracking-[0.07em] text-[#8a94a6]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pending.map((q) => {
                const age = ageLabel(q.details.submittedAt);
                const breached = age.hours > SLA_HOURS;
                return (
                  <tr key={q.id} className="border-b border-[#f2f4f7] last:border-b-0">
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-semibold text-ink">
                      {q.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-5 py-3.5 text-ink-soft">{q.details.companyName || "—"}</td>
                    <td className="px-5 py-3.5 text-ink-muted">{q.details.country || "—"}</td>
                    <td
                      className={`whitespace-nowrap px-5 py-3.5 font-mono ${
                        breached ? "text-[#c22]" : "text-ink-muted"
                      }`}
                    >
                      {age.text}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-[5px] px-2.5 py-1 font-mono text-[10.5px] font-semibold ${
                          breached ? "bg-[#fdecec] text-[#c22]" : "bg-tint text-[#00618f]"
                        }`}
                      >
                        {breached ? "SLA BREACH" : "PRICING"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
