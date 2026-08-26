import Link from "next/link";
import { getTopSellers } from "@/app/lib/catalog-data";
import { MostRequestedPartsTabs } from "@/app/components/most-requested-parts-tabs";

// Server component: top sellers are now aggregated from real issued order
// confirmations, so the three periods are fetched here and handed to the
// client tabs. Previously this computed a fabricated ranking in the browser.
export async function MostRequestedParts() {
  const [week, month, year] = await Promise.all([
    getTopSellers("week", 4),
    getTopSellers("month", 4),
    getTopSellers("year", 4),
  ]);

  // Nothing has been sold in any window yet — the section would render three
  // empty tabs, so it is omitted entirely rather than showing a dead control.
  if (!week.length && !month.length && !year.length) return null;

  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-7 py-13 md:px-[68px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="mb-1 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
            Most requested parts
          </h2>
          <p className="text-[13.5px] text-[#64748b]">Ranked by units ordered</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/products"
            className="btn-glass-accent rounded-md px-5 py-2 text-[13px] font-bold shadow-[0_8px_18px_rgba(255,185,0,.24)]"
          >
            Want more?
          </Link>
        </div>
      </div>
      <MostRequestedPartsTabs week={week} month={month} year={year} />
    </section>
  );
}
