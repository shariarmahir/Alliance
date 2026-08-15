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
  Headset,
  Mail,
  Phone,
  ArrowUpRight,
} from "lucide-react";
import { HeroCarousel } from "@/app/components/hero-carousel";
import { CategoryGrid } from "@/app/components/category-grid";
import { BrandStrip } from "@/app/components/brand-strip";
import { ClientReviews } from "@/app/components/client-reviews";
import { TopSellerCard } from "@/app/components/top-seller-card";
import { FaqAccordion } from "@/app/components/faq-accordion";
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
  { label: "AutoLink Warranty", value: "2 Year" },
  { label: "Shipping To", value: "100+ Countries" },
  { label: "Direct Lines", value: "450+" },
  { label: "Engineers", value: "350+" },
];

const services = [
  {
    icon: Wrench,
    title: "Repair Services",
    text: "AutoLink's expert repair team restores your critical equipment with precision, extending its lifespan and minimizing downtime.",
  },
  {
    icon: Radio,
    title: "AutoLink Remote",
    text: "Live expert technical assistance from an AutoLink-qualified engineer. Get back up and running with the troubleshooting help you need.",
  },
  {
    icon: BadgeCheck,
    title: "Ask An Engineer",
    text: "Talk to an AutoLink engineer about your specific product or project. Eliminate guesswork and get the help you need.",
  },
  {
    icon: Truck,
    title: "Sell To Us",
    text: "Get cash for surplus or used parts and products, adding to your bottom line. Simple & easy process.",
  },
];

const differenceItems = [
  { icon: ShieldCheck, title: "Standard 2 Year Warranty", text: "Most products ship with a full 2 year AutoLink warranty. Extended warranty options available." },
  { icon: Rocket, title: "Same Day Shipping", text: "1M+ products ship the same day and millions more with rush processing available." },
  { icon: BadgeCheck, title: "ISO Certified", text: "Third party audited & certified materials, processes & services." },
  { icon: RotateCcw, title: "30 Day Money-Back Guarantee", text: "Send the product back for any reason for a refund, less any applicable restocking fee." },
  { icon: ZapIcon, title: "Rush Process", text: "Faster processing and a guaranteed ship date available on millions of qualified products." },
  { icon: Clock, title: "Available 24/7/365", text: "Don't wait to get help. Our experts are available around the clock, every day of the year." },
];

const faqs = [
  {
    question: "Why don't you publish prices?",
    answer:
      "Automation stock and freight move weekly, and most orders are multi-line. Send an Ask Price request and we reply with a firm quotation valid 14 days, including delivery.",
  },
  {
    question: "Are the parts new or surplus?",
    answer:
      "Both — every listing states its condition. New parts are factory sealed; surplus parts are function-tested and covered by the same AutoLink warranty.",
  },
  {
    question: "Do you ship to my country?",
    answer: "Yes — we ship to 100+ countries, with export documentation included on every order.",
  },
  {
    question: "What payment terms do you offer?",
    answer: "Terms are confirmed on your quotation; typical terms are 50% advance with balance before dispatch.",
  },
  {
    question: "Can you repair a unit instead of replacing it?",
    answer: "Often, yes — mention it in your Ask Price notes and our engineers will offer a repair route where available.",
  },
];

export default function Home() {
  return (
    <div>
      <HeroCarousel />

      <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 sm:grid-cols-4">
        <div className="border-r border-slate-200 px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quality System</p>
          <p className="mt-1 text-lg font-bold text-primary">ISO 9001:2015</p>
        </div>
        <div className="border-slate-200 px-6 py-5 sm:border-r">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Parts Catalogued</p>
          <p className="mt-1 text-lg font-bold text-primary">50,000+</p>
        </div>
        <div className="border-r border-t border-slate-200 px-6 py-5 sm:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quote Turnaround</p>
          <p className="mt-1 text-lg font-bold text-primary">4 working hours</p>
        </div>
        <div className="border-t border-slate-200 px-6 py-5 sm:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Warranty</p>
          <p className="mt-1 text-lg font-bold text-primary">2 years</p>
        </div>
      </div>

      <CategoryGrid />

      {/* Protect Uptime. Reduce Downtime. */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Protect Uptime. Reduce Downtime.
            </h2>
            <div className="mb-4 flex flex-wrap gap-2">
              {uptimeTags.map((t) => (
                <span
                  key={t.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  <t.icon className="size-3.5 text-primary" />
                  {t.label}
                </span>
              ))}
            </div>
            <p className="mb-5 max-w-lg text-sm leading-relaxed text-slate-600">
              AutoLink delivers automation parts, repair services, and lifecycle solutions that reduce
              downtime and keep maintenance, engineering, and operations teams running.
            </p>
            <Link href="/products" className="text-sm font-semibold text-primary hover:underline">
              Discuss Your Uptime Needs →
            </Link>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-xl">
            <video
              src="/video/video1.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="size-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-slate-900/70 via-slate-900/10 to-transparent" />
            <div className="absolute left-5 top-5 text-2xl font-extrabold leading-tight sm:text-3xl">
              <span className="block text-white">Keep Product</span>
              <span className="block text-accent">Moving</span>
            </div>
          </div>
        </div>
      </section>

      {/* Top Selling Products */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Top Selling Products</h2>
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

      {/* Most Requested Parts */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Most Requested Parts</h2>
            <p className="mt-1 text-sm text-slate-500">Ranked by price requests received this month</p>
          </div>
          <Link href="/products" className="text-sm font-medium text-primary hover:underline">
            Browse All
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {topSellers.slice(4, 8).map((p) => (
            <TopSellerCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Quality Parts and Services You Can Trust */}
      <section className="bg-secondary py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="mb-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Quality Parts and Services You Can Trust
              </h2>
              <p className="max-w-lg text-sm leading-relaxed text-slate-600">
                Automation, industrial, electrical, and MRO components to keep your business running
                smoothly. From obsolete and hard-to-find equipment to on-site services and expert repair
                capabilities, we&apos;ve got what you need.
              </p>
              <Link href="/products" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
                Learn About Us
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
              {trustStats.map((s) => (
                <div key={s.label} className="border-l-2 border-primary/30 pl-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{s.label}</p>
                  <p className="text-lg font-bold text-primary">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services & Support */}
      <section id="services" className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="mb-6 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Services &amp; Support</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <div
              key={s.title}
              className="rounded-xl border border-slate-200 bg-slate-50 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white hover:shadow-md"
            >
              <s.icon className="mb-3 size-7 text-primary" />
              <h3 className="mb-1.5 text-sm font-semibold text-slate-900">{s.title}</h3>
              <p className="text-xs leading-relaxed text-slate-600">{s.text}</p>
              <Link href="/products" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
                Learn More
              </Link>
            </div>
          ))}
        </div>
      </section>

      <BrandStrip />

      {/* The AutoLink Difference */}
      <section className="bg-primary py-12 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-8 text-center text-xl font-bold tracking-tight sm:text-2xl">The AutoLink Difference</h2>
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {differenceItems.map((d) => (
              <div key={d.title} className="flex gap-3.5">
                <d.icon className="size-7 shrink-0 text-accent" />
                <div>
                  <h3 className="mb-1 text-sm font-semibold">{d.title}</h3>
                  <p className="text-xs leading-relaxed text-white/80">{d.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ClientReviews />

      {/* We Are Here To Help You */}
      <section id="contact" className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="mb-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Frequently Asked</h2>
            <p className="mb-5 text-sm text-slate-600">
              Still unsure? WhatsApp an engineer on{" "}
              <a href="tel:+8801713116019" className="font-semibold text-primary">+8801713-116019</a>.
            </p>
            <FaqAccordion items={faqs} />
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 text-primary opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="flex gap-5">
              <div className="hidden shrink-0 items-center justify-center rounded-xl bg-primary/10 p-3.5 ring-1 ring-primary/15 sm:flex">
                <Headset className="size-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-primary sm:text-2xl">
                  We Are Here To Help You
                </h2>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">
                  If you have questions, need a price or repair quote, or are ready to place an
                  order, our team is here to assist you — every step of the way.
                </p>
              </div>
            </div>

            <div className="flex w-full shrink-0 flex-col items-stretch gap-4 lg:w-auto lg:items-end">
              <Link
                href="/contact"
                className="btn-glass-accent group w-full justify-center py-3 text-base lg:w-auto"
              >
                Contact Us
                <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col lg:items-end">
                <a
                  href="mailto:info@autolink.com"
                  className="flex items-center gap-2.5 rounded-lg px-1 text-sm font-medium text-slate-600 transition-colors hover:text-primary"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15">
                    <Mail className="size-4 text-primary" />
                  </span>
                  info@autolink.com
                </a>
                <a
                  href="tel:+8801713116019"
                  className="flex items-center gap-2.5 rounded-lg px-1 text-sm font-medium text-slate-600 transition-colors hover:text-primary"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15">
                    <Phone className="size-4 text-primary" />
                  </span>
                  +8801713-116019
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      </section>
    </div>
  );
}
