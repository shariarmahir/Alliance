import Link from "next/link";
import { ShieldCheck, Radio, RotateCcw, Clock, Wrench, MessageCircleQuestion, PackageCheck, Recycle } from "lucide-react";
import { HeroCarousel } from "@/app/components/hero-carousel";
import { CategoryGrid } from "@/app/components/category-grid";
import { BrandStrip } from "@/app/components/brand-strip";
import { ClientReviews } from "@/app/components/client-reviews";
import { TopSellerCard } from "@/app/components/top-seller-card";
import { FaqAccordion } from "@/app/components/faq-accordion";
import { HomeEnquiryForm } from "@/app/components/home-enquiry-form";
import { topSellers } from "@/app/lib/top-sellers";

const uptimeTags = [
  { icon: ShieldCheck, label: "Automation spares" },
  { icon: RotateCcw, label: "Repair & exchange" },
  { icon: Clock, label: "Lifecycle management" },
  { icon: Radio, label: "On-site support" },
];

const heroStats = [
  { label: "Quality System", value: "ISO 9001:2015" },
  { label: "Parts Catalogued", value: "42,000+" },
  { label: "Quote Turnaround", value: "4 working hours" },
  { label: "Warranty", value: "2 years" },
];

const trustStats = [
  { label: "Manufacturers", value: "60+" },
  { label: "Countries Served", value: "100+" },
  { label: "Test Bench Pass", value: "99.4%" },
  { label: "Engineers On Call", value: "38" },
  { label: "Warehouse", value: "18,000 ft²" },
  { label: "Trading Since", value: "2009" },
];

// Each card keeps the colour its flat glyph used to carry (blue / accent
// orange / ink / blue), now as a tinted circle badge behind a real icon
// picked for what the service actually is.
const services = [
  {
    icon: Wrench,
    tone: "bg-primary/10 text-primary",
    title: "Repair & exchange",
    text: "Board-level repair for drives, HMIs and power supplies with a tested-and-returned guarantee.",
    cta: "Learn more",
    href: "/contact",
  },
  {
    icon: MessageCircleQuestion,
    tone: "bg-accent/15 text-accent-dark",
    title: "Ask an engineer",
    text: "Send a photo of the nameplate on WhatsApp and get the right part number back, not a catalogue link.",
    cta: "Start a chat",
    href: "https://wa.me/8801713116019",
  },
  {
    icon: PackageCheck,
    tone: "bg-ink/10 text-ink",
    title: "Critical spares programme",
    text: "We hold your line-critical stock in Dhaka and release it against a standing agreement.",
    cta: "Learn more",
    href: "/contact",
  },
  {
    icon: Recycle,
    tone: "bg-primary/10 text-primary",
    title: "Sell us your surplus",
    text: "Turn shelved automation stock into working capital. Send a list, get an offer.",
    cta: "Send a list",
    href: "/contact",
  },
];

const differenceItems = [
  { title: "Two-year warranty", text: "On new and tested surplus alike, extendable to five." },
  { title: "Quote in 4 hours", text: "Working hours GMT+6, with stock and lead time confirmed." },
  { title: "Function-tested", text: "Every unit powered up and logged before dispatch." },
  { title: "Export documentation", text: "Commercial invoice, packing list, HS codes and CoC included." },
  { title: "Obsolete sourcing", text: "If it is discontinued, we hunt it or offer a tested equivalent." },
  { title: "One engineer, start to finish", text: "The person who quotes your part follows the shipment." },
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

      <div className="grid grid-cols-2 gap-px border-b border-slate-line bg-slate-line sm:grid-cols-4">
        {heroStats.map((s) => (
          <div key={s.label} className="flex flex-col justify-center bg-surface px-7 py-3.5">
            <p className="mono-label text-[10.5px] tracking-[0.09em] text-[#8a94a6]">{s.label}</p>
            <p className="mt-1 text-[19px] font-bold text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      <CategoryGrid />

      {/* Protect uptime. Reduce downtime. */}
      <section className="mx-auto max-w-[1360px] px-7 py-15 md:px-[68px]">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <h2 className="mb-3.5 text-[28px] font-bold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[32px]">
              Protect uptime.
              <br />
              Reduce downtime.
            </h2>
            <p className="mb-5.5 max-w-[440px] text-[15px] leading-[1.7] text-[#4c5a72]">
              AutoLink keeps spares, repairs and lifecycle plans in one place, so maintenance teams stop
              chasing discontinued part numbers across three continents.
            </p>
            <div className="mb-6 flex flex-wrap gap-2.5">
              {uptimeTags.map((t) => (
                <span
                  key={t.label}
                  className="inline-flex items-center gap-1.5 rounded-[20px] border border-tint-line bg-tint px-3.5 py-2 text-[12.5px] font-semibold text-[#00618f]"
                >
                  <t.icon className="size-3.5" />
                  {t.label}
                </span>
              ))}
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2.5 border-b-[1.5px] border-[#b9dcf3] pb-1 text-sm font-semibold text-primary"
            >
              Discuss your uptime plan →
            </Link>
          </div>
          <div className="relative h-[326px] overflow-hidden rounded-xl bg-[#0d1626]">
            <video
              src="/video/video1.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="size-full object-cover opacity-[0.82]"
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-[#0b1420]/10 to-[#0b1420]/[0.72]" />
            <span className="absolute left-1/2 top-1/2 flex size-[70px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-white/50 bg-white/20 backdrop-blur-sm">
              <span className="ml-1.5 size-0 border-y-[11px] border-l-[17px] border-y-transparent border-l-white" />
            </span>
            <div className="absolute bottom-6 left-6">
              <p className="mono-label mb-1 text-[11px] tracking-[0.1em] text-accent">02:14 — CASE FILM</p>
              <p className="text-[21px] font-bold text-white">Keeping 42 knit lines running</p>
            </div>
          </div>
        </div>
      </section>

      {/* Most requested parts */}
      <section className="mx-auto max-w-[1360px] px-7 py-13 md:px-[68px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="mb-1 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
              Most requested parts
            </h2>
            <p className="text-[13.5px] text-[#64748b]">Ranked by price requests received</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/products"
              className="btn-glass-accent rounded-md px-5 py-2 text-[13px] font-bold shadow-[0_8px_18px_rgba(255,185,0,.24)]"
            >
              Want more?
            </Link>
            <div className="flex rounded-[9px] border border-slate-line bg-[#f2f4f7] p-1">
              <span className="rounded-md bg-white px-5 py-2 text-[13px] font-semibold text-ink shadow-[0_1px_3px_rgba(16,25,45,.12)]">
                This week
              </span>
              <Link href="/products" className="px-5 py-2 text-[13px] font-medium text-[#64748b] hover:text-primary">
                This month
              </Link>
              <Link href="/products" className="px-5 py-2 text-[13px] font-medium text-[#64748b] hover:text-primary">
                This year
              </Link>
            </div>
          </div>
        </div>
        {/* Two per row from the base breakpoint up, not one — the same fix as
            the category grid: grid-cols-1 stuck phones with a single
            full-width card at a time. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4.5 lg:grid-cols-4">
          {topSellers.slice(0, 4).map((p, i) => (
            <TopSellerCard key={p.id} product={p} rank={i === 0 ? 1 : undefined} />
          ))}
        </div>
      </section>

      {/* Quality parts and services you can trust */}
      <section className="border-y border-slate-line bg-surface-blue py-14">
        <div className="mx-auto max-w-[1360px] px-7 md:px-[68px]">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <h2 className="mb-3.5 text-2xl font-bold leading-[1.2] tracking-[-0.02em] text-ink sm:text-[29px]">
                Quality parts and services you can trust
              </h2>
              <p className="mb-5 text-[14.5px] leading-[1.7] text-[#4c5a72]">
                New, factory-sealed and tested surplus automation components — every unit inspected,
                function-tested and covered by an AutoLink warranty before it leaves Uttara.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2.5 border-b-[1.5px] border-[#b9dcf3] pb-1 text-sm font-semibold text-primary"
              >
                Learn about AutoLink →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-[#dbe4ec] bg-[#dbe4ec] sm:grid-cols-3">
              {trustStats.map((s) => (
                <div key={s.label} className="bg-white p-5">
                  <p className="mono-label mb-1 text-[10px] text-[#8a94a6]">{s.label}</p>
                  <p className="text-[22px] font-bold text-ink">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services & support */}
      <section id="services" className="mx-auto max-w-[1360px] px-7 py-14 md:px-[68px]">
        <h2 className="mb-5.5 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
          Services &amp; support
        </h2>
        {/* Two per row from the base breakpoint up, not one — same fix as the
            category grid and top-sellers section. This card is text-led
            rather than image-led, so at two-up it only needs tighter padding
            and type, not a different layout. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4.5 lg:grid-cols-4">
          {services.map((s) => (
            <div
              key={s.title}
              className="group rounded-[10px] border border-slate-line bg-white p-3.5 transition-all hover:border-primary hover:shadow-[0_10px_24px_rgba(16,25,45,.08)] sm:p-5.5"
            >
              <span
                className={`mb-3 flex size-9 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 sm:mb-4 sm:size-11 ${s.tone}`}
              >
                <s.icon className="size-4.5 sm:size-5.5" strokeWidth={2.25} />
              </span>
              <strong className="mb-1 block text-[13px] font-semibold text-ink sm:mb-1.5 sm:text-base">
                {s.title}
              </strong>
              <p className="mb-2.5 text-[11px] leading-[1.5] text-[#64748b] sm:mb-3.5 sm:text-[12.5px] sm:leading-[1.6]">
                {s.text}
              </p>
              <Link
                href={s.href}
                className="text-[11px] font-semibold text-primary hover:underline sm:text-[12.5px]"
              >
                {s.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <BrandStrip />

      {/* The AutoLink difference */}
      <section className="mt-14 bg-[#0d1626] py-13">
        <div className="mx-auto max-w-[1360px] px-7 md:px-[68px]">
          <h2 className="mb-1.5 text-center text-2xl font-bold tracking-[-0.02em] text-white sm:text-[28px]">
            The AutoLink difference
          </h2>
          <p className="mb-8.5 text-center text-sm text-white/60">
            Six commitments we put in writing on every quotation
          </p>
          <div className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {differenceItems.map((d, i) => (
              <div key={d.title} className="flex gap-3.5">
                <span className="flex size-[34px] shrink-0 items-center justify-center rounded-md border border-accent/35 bg-accent/[0.16] font-mono text-[13px] font-bold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong className="mb-1 block text-[15px] font-semibold text-white">{d.title}</strong>
                  <span className="text-[12.5px] leading-[1.6] text-white/[0.62]">{d.text}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ClientReviews />

      {/* Frequently asked + We are here to help you */}
      <section id="contact" className="mx-auto max-w-[1360px] px-7 pb-16 pt-15 md:px-[68px]">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <h2 className="mb-2 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
              Frequently asked
            </h2>
            <p className="mb-5 text-[13.5px] leading-[1.7] text-[#64748b]">
              Still unsure? WhatsApp an engineer on{" "}
              <a href="tel:+8801713116019" className="font-mono font-semibold text-primary">
                +8801713-116019
              </a>
              .
            </p>
            <FaqAccordion items={faqs} />
          </div>
          <div className="relative overflow-hidden rounded-xl border border-slate-line bg-surface p-6 sm:p-8">
            <h2 className="mb-1.5 text-[22px] font-bold tracking-[-0.02em] text-ink sm:text-2xl">
              We are here to help you
            </h2>
            <p className="mb-5.5 text-[13.5px] leading-[1.6] text-ink-muted">
              Send the part number or a photo of the nameplate. An engineer replies within four working
              hours.
            </p>
            <HomeEnquiryForm />
          </div>
        </div>
      </section>
    </div>
  );
}
