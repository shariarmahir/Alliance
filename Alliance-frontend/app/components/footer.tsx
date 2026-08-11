import Link from "next/link";
import { MapPin, Mail, Phone } from "lucide-react";
import { categories } from "@/app/lib/mock-data";

export function Footer() {
  return (
    <footer className="mt-16 bg-slate-900 text-slate-300">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 md:grid-cols-4">
        <div>
          <div className="mb-3 text-2xl font-extrabold text-white">
            Alliance<span className="text-accent">.</span>
          </div>
          <p className="text-sm text-slate-400">
            Your global partner for industrial electronics — PLCs, drives, servos, motors and power
            systems. New, refurbished &amp; repair. Shipping worldwide from Bangladesh.
          </p>
        </div>

        <div>
          <h4 className="mb-4 font-semibold text-white">Categories</h4>
          <ul className="space-y-2 text-sm text-slate-400">
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
          <ul className="space-y-2 text-sm text-slate-400">
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
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 text-accent" /> Uttara, Dhaka, Bangladesh
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-accent" />
              <a href="mailto:info@alliance.com" className="hover:text-accent">info@alliance.com</a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-accent" />
              <a href="tel:+8801713116019" className="hover:text-accent">+8801713-116019</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-400 sm:flex-row">
          <p>&copy; Alliance 2026-2028. All rights reserved.</p>
          <p>
            Developed by <span className="font-semibold text-accent">Mahir Shariar Mahin</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
