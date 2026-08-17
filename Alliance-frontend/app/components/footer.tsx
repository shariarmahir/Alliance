import Link from "next/link";
import { categories } from "@/app/lib/mock-data";

export function Footer() {
  return (
    <footer className="bg-[#0d1626] text-white/[0.68]">
      <div className="mx-auto max-w-[1360px] px-7 pt-12 md:px-[68px]">
        <div className="grid grid-cols-1 gap-9 border-b border-white/10 pb-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.3fr]">
          {/* Brand stays full-width at every size below lg — the address
              block needs the room. The other four sections (three link
              columns + newsletter) were each going full-width too, which on
              a phone wider than a narrow handset left a large empty gap
              beside every short one — three items paired 2+1 left Company
              alone with an empty slot beside it. All four now share one
              2-column sub-grid, so newsletter fills that slot instead of
              sitting alone full-width below. */}
          <div>
            <div className="mb-1 text-[21px] font-bold leading-none text-white">
              AutoLink<span className="text-accent">.</span>
            </div>
            <p className="mono-label mb-4 text-[9.5px] tracking-[0.14em] text-white/45">
              Integrated Technologies
            </p>
            <p className="mb-4 text-[12.5px] leading-[1.75] text-white/60">
              Industrial electronics and automation spares, supplied worldwide from Bangladesh since 2009.
            </p>
            <p className="font-mono text-[12.5px] leading-[1.9] text-white/[0.78]">
              Uttara, Dhaka, Bangladesh
              <br />
              <a href="mailto:info@auto-bd.com" className="hover:text-accent">
                info@auto-bd.com
              </a>
              <br />
              <a href="tel:+8801713116019" className="hover:text-accent">
                +8801713-116019
              </a>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-9 lg:contents">
            <div>
              <p className="mono-label mb-3.5 text-[11px] tracking-[0.1em] text-accent">CATALOGUE</p>
              <ul className="space-y-2 text-[12.5px] text-white/[0.68]">
                {categories.slice(0, 5).map((c) => (
                  <li key={c.slug}>
                    <Link href={`/products?category=${c.slug}`} className="hover:text-accent">
                      {c.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/products" className="hover:text-accent">
                    All products
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="mono-label mb-3.5 text-[11px] tracking-[0.1em] text-accent">SERVICES</p>
              <ul className="space-y-2 text-[12.5px] text-white/[0.68]">
                <li>
                  <Link href="/products" className="hover:text-accent">
                    Ask Price
                  </Link>
                </li>
                <li>
                  <Link href="/#services" className="hover:text-accent">
                    Repair &amp; exchange
                  </Link>
                </li>
                <li>
                  <Link href="/#services" className="hover:text-accent">
                    Critical spares
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-accent">
                    Sell us your parts
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="mono-label mb-3.5 text-[11px] tracking-[0.1em] text-accent">COMPANY</p>
              <ul className="space-y-2 text-[12.5px] text-white/[0.68]">
                <li>
                  <Link href="/contact" className="hover:text-accent">
                    About AutoLink
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-accent">
                    Quality &amp; ISO
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-accent">
                    Export &amp; shipping
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-accent">
                    Terms of trade
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="mono-label mb-3.5 text-[11px] tracking-[0.1em] text-accent">
                STOCK &amp; PRICE ALERTS
              </p>
              <form className="mb-3 flex gap-2">
                <input
                  type="email"
                  placeholder="Work email"
                  className="min-w-0 flex-1 rounded-[7px] border border-white/20 bg-white/[0.07] px-3 py-2.5 text-[12.5px] text-white outline-none placeholder:text-white/50 focus:border-accent"
                />
                <button
                  type="button"
                  className="shrink-0 rounded-[7px] bg-accent px-3.5 py-2.5 text-[12.5px] font-bold text-ink hover:bg-accent-dark"
                >
                  Join
                </button>
              </form>
              <p className="text-[11.5px] leading-[1.6] text-white/45">
                New arrivals and obsolete finds, once a month. No resellers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 py-5 text-[11.5px] text-white/50 sm:flex-row">
          <p>
            &copy; AutoLink Integrated Technologies 2026–2028. All rights reserved. Developed by{" "}
            <span className="credit-shine font-semibold">Mahir Shariar Mahin</span>.
          </p>
          <p className="flex gap-5">
            <span>BD · BDT</span>
            <span>Terms</span>
            <span>Privacy</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
