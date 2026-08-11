import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  Wrench,
  Radio,
  Zap as ZapIcon,
  BadgeCheck,
  Truck,
  RotateCcw,
  Clock,
  Rocket,
} from "lucide-react";
import { HeroCarousel } from "@/app/components/hero-carousel";
import { CategoryGrid } from "@/app/components/category-grid";
import { BrandStrip } from "@/app/components/brand-strip";
import { TopSellerCard } from "@/app/components/top-seller-card";
import { topSellers } from "@/app/lib/top-sellers";

const uptimeTags = [
  { icon: ShieldCheck, label: "Automation Parts" },
  { icon: RotateCcw, label: "Repair & Exchange" },
  { icon: Clock, label: "Lifecycle Management" },
  { icon: Radio, label: "Operations Support" },
];

const trustStats = [
  { label: "ISO Certified", value: "9001:2015" },
  { label: "Products Available", value: "20+ Million" },
  { label: "Alliance Warranty", value: "2 Year" },
  { label: "Shipping To", value: "100+ Countries" },
  { label: "Direct Lines", value: "450+" },
  { label: "Engineers", value: "350+" },
];

const services = [
  {
    icon: Wrench,
    title: "Repair Services",
    text: "Alliance's expert repair team restores your critical equipment with precision, extending its lifespan and minimizing downtime.",
  },
  {
    icon: Radio,
    title: "Alliance Remote",
    text: "Live expert technical assistance from an Alliance-qualified engineer. Get back up and running with the troubleshooting help you need.",
  },
  {
    icon: BadgeCheck,
    title: "Ask An Engineer",
    text: "Talk to an Alliance engineer about your specific product or project. Eliminate guesswork and get the help you need.",
  },
  {
    icon: Truck,
    title: "Sell To Us",
    text: "Get cash for surplus or used parts and products, adding to your bottom line. Simple & easy process.",
  },
];

const differenceItems = [
  { icon: ShieldCheck, title: "Standard 2 Year Warranty", text: "Most products ship with a full 2 year Alliance warranty. Extended warranty options available." },
  { icon: Rocket, title: "Same Day Shipping", text: "1M+ products ship the same day and millions more with rush processing available." },
  { icon: BadgeCheck, title: "ISO Certified", text: "Third party audited & certified materials, processes & services." },
  { icon: RotateCcw, title: "30 Day Money-Back Guarantee", text: "Send the product back for any reason for a refund, less any applicable restocking fee." },
  { icon: ZapIcon, title: "Rush Process", text: "Faster processing and a guaranteed ship date available on millions of qualified products." },
  { icon: Clock, title: "Available 24/7/365", text: "Don't wait to get help. Our experts are available around the clock, every day of the year." },
];

export default function Home() {
  return (
    <div>
      <HeroCarousel />
      <CategoryGrid />

      {/* Protect Uptime. Reduce Downtime. */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-2xl font-bold text-slate-900 sm:text-3xl">
              Protect Uptime. Reduce Downtime.
            </h2>
            <div className="mb-5 flex flex-wrap gap-2">
              {uptimeTags.map((t) => (
                <span
                  key={t.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  <t.icon className="size-3.5 text-primary" />
                  {t.label}
                </span>
              ))}
            </div>
            <p className="mb-6 max-w-lg text-slate-600">
              Alliance delivers automation parts, repair services, and lifecycle solutions that reduce
              downtime and keep maintenance, engineering, and operations teams running.
            </p>
            <Link href="/products" className="text-sm font-semibold text-primary hover:underline">
              Discuss Your Uptime Needs →
            </Link>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-xl">
            <Image
              src="/images/uptime-support.svg"
              alt="Field engineer supporting industrial equipment"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Top Selling Products */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Top Selling Products</h2>
          <Link href="/products" className="text-sm font-medium text-primary hover:underline">
            Browse All
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {topSellers.map((p) => (
            <TopSellerCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Quality Parts and Services You Can Trust */}
      <section className="bg-secondary py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="mb-4 text-2xl font-bold text-slate-900 sm:text-3xl">
                Quality Parts and Services You Can Trust
              </h2>
              <p className="max-w-lg text-slate-600">
                Automation, industrial, electrical, and MRO components to keep your business running
                smoothly. From obsolete and hard-to-find equipment to on-site services and expert repair
                capabilities, we&apos;ve got what you need.
              </p>
              <Link href="/products" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
                Learn About Us
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
              {trustStats.map((s) => (
                <div key={s.label} className="border-l-2 border-primary/30 pl-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{s.label}</p>
                  <p className="text-xl font-bold text-primary">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services & Support */}
      <section id="services" className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="mb-10 text-2xl font-bold text-slate-900">Services &amp; Support</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <div key={s.title} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <s.icon className="mb-4 size-8 text-primary" />
              <h3 className="mb-2 font-semibold text-slate-900">{s.title}</h3>
              <p className="text-sm text-slate-600">{s.text}</p>
              <Link href="/products" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
                Learn More
              </Link>
            </div>
          ))}
        </div>
      </section>

      <BrandStrip />

      {/* The Alliance Difference */}
      <section className="bg-primary py-16 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">The Alliance Difference</h2>
          <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {differenceItems.map((d) => (
              <div key={d.title} className="flex gap-4">
                <d.icon className="size-8 shrink-0 text-accent" />
                <div>
                  <h3 className="mb-1 font-semibold">{d.title}</h3>
                  <p className="text-sm text-white/80">{d.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* We Are Here To Help You */}
      <section id="contact" className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-slate-200 p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="mb-2 text-xl font-bold text-slate-900">We Are Here To Help You</h2>
            <p className="max-w-xl text-sm text-slate-600">
              If you have questions, need a price or repair quote, or are ready to place an order, our
              team is here to assist you.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <Link href="/products" className="btn-glass-accent">
              Contact Us
            </Link>
            <div className="flex flex-col gap-1 text-sm text-slate-600 sm:items-end">
              <a href="mailto:info@alliance.com" className="hover:text-primary">info@alliance.com</a>
              <a href="tel:+8801713116019" className="hover:text-primary">+8801713-116019</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
