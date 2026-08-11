import Link from "next/link";
import { MapPin, Mail, Phone } from "lucide-react";
import { categories } from "@/app/lib/mock-data";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="col-span-2 lg:col-span-2">
          <p className="mb-3 text-xl font-bold text-primary">Alliance</p>
          <p className="mb-4 max-w-sm text-sm text-slate-600">
            Alliance supplies PLCs, drives, servos, HMIs, and industrial automation
            components worldwide, shipped from Bangladesh.
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" /> Uttara, Dhaka, Bangladesh
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-primary" /> info@alliance.com
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-primary" /> +8801713-116019
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-slate-900">Customer Care</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              <a href="#" className="hover:text-primary">Contact Us</a>
            </li>
            <li>
              <a href="#" className="hover:text-primary">Shipping Info</a>
            </li>
            <li>
              <a href="#" className="hover:text-primary">Returns</a>
            </li>
            <li>
              <a href="#" className="hover:text-primary">FAQ</a>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-slate-900">Company</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              <a href="#" className="hover:text-primary">About Alliance</a>
            </li>
            <li>
              <Link href="/products" className="hover:text-primary">All Products</Link>
            </li>
            <li>
              {categories[0] && (
                <Link href={`/products?category=${categories[0].slug}`} className="hover:text-primary">
                  {categories[0].name}
                </Link>
              )}
            </li>
            <li>
              <a href="#" className="hover:text-primary">Careers</a>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-slate-900">Stay Updated</p>
          <p className="mb-3 text-sm text-slate-600">Subscribe for new product and pricing updates.</p>
          <form className="flex gap-2">
            <input
              type="email"
              placeholder="Your email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button type="button" className="btn-glass px-3 py-2 text-sm">
              Join
            </button>
          </form>
          <div className="mt-4 flex gap-3 text-xs text-slate-500">
            <a href="#" className="hover:text-primary">Privacy Policy</a>
            <a href="#" className="hover:text-primary">Terms</a>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row">
          <p>© Alliance 2026-2028. All rights reserved.</p>
          <p>Developed by Mahir Shariar Mahin</p>
        </div>
      </div>
    </footer>
  );
}
