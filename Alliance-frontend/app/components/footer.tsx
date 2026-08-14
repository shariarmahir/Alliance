import Link from "next/link";
import { MapPin, Mail, Phone } from "lucide-react";
import { categories } from "@/app/lib/mock-data";

export function Footer() {
  return (
    <footer className="mt-16 bg-primary text-white/80">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 md:grid-cols-5">
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-white">
            AutoLink<span className="text-accent">.</span>
          </div>
          <div className="mb-3 mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/60">
            Integrated Technologies
          </div>
          <p className="text-sm text-white/70">
            Your global partner for industrial electronics — PLCs, drives, servos, motors and power
            systems. New, refurbished &amp; repair. Shipping worldwide from Bangladesh.
          </p>
        </div>

        <div>
          <h4 className="mb-4 font-semibold text-white">Categories</h4>
          <ul className="space-y-2 text-sm text-white/70">
            {categories.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link href={`/products?category=${c.slug}`} className="hover:text-accent">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-semibold text-white">Company</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li>
              <Link href="/products" className="hover:text-accent">All Products</Link>
            </li>
            <li>
              <Link href="/#services" className="hover:text-accent">Services &amp; Support</Link>
            </li>
            <li>
              <Link href="/#contact" className="hover:text-accent">Contact Us</Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-semibold text-white">Get in Touch</h4>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 text-accent" /> Uttara, Dhaka, Bangladesh
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-accent" />
              <a href="mailto:info@autolink.com" className="hover:text-accent">info@autolink.com</a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-accent" />
              <a href="tel:+8801713116019" className="hover:text-accent">+8801713-116019</a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-semibold text-white">Stock &amp; Price Alerts</h4>
          <p className="mb-3 text-sm text-white/70">
            New arrivals and obsolete finds, once a month. No resellers.
          </p>
          <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Work email"
              className="min-w-0 flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50 outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-accent px-3 py-2 text-sm font-bold text-slate-900 hover:bg-accent-dark"
            >
              Join
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/70 sm:flex-row">
          <p>&copy; AutoLink Integrated Technologies 2026-2028. All rights reserved.</p>
          <p>
            Developed by <span className="font-semibold text-accent">Mahir Shariar Mahin</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
