import { ShieldCheck, Globe, Headset, Zap, Wrench, PackageSearch, Star } from "lucide-react";
import { HeroCarousel } from "@/app/components/hero-carousel";
import { CategoryGrid } from "@/app/components/category-grid";
import { ProductTabsSection } from "@/app/components/product-tabs-section";
import { BrandStrip } from "@/app/components/brand-strip";
import { ContactForm } from "@/app/components/contact-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion";
import { reviews, faqs } from "@/app/lib/mock-data";

const trustFeatures = [
  {
    icon: ShieldCheck,
    title: "Genuine Parts",
    text: "Every component is sourced through authorized channels with full traceability and manufacturer warranty.",
  },
  {
    icon: Globe,
    title: "Global Shipping",
    text: "We ship worldwide from Bangladesh via air and sea freight, with door-to-door courier options.",
  },
  {
    icon: Headset,
    title: "Expert Support",
    text: "Our technical team helps you cross-reference parts and specify the right component for your system.",
  },
  {
    icon: Zap,
    title: "Fast Quotations",
    text: "Submit a request and receive a formal quotation with pricing and lead time within one business day.",
  },
];

const supportServices = [
  {
    icon: Wrench,
    title: "Technical Support",
    text: "Our engineers help you cross-reference obsolete or hard-to-find part numbers to current equivalents.",
  },
  {
    icon: PackageSearch,
    title: "Repair Services",
    text: "Send in faulty drives, PLCs, and HMIs for diagnostic evaluation and repair quotations.",
  },
  {
    icon: Globe,
    title: "Bulk Ordering",
    text: "Volume pricing and consolidated shipping available for plant-wide retrofits and spare parts stocking.",
  },
];

export default function Home() {
  return (
    <div>
      <HeroCarousel />
      <CategoryGrid />
      <ProductTabsSection />
      <BrandStrip />

      {/* Quality Parts & Services You Can Trust */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="mb-2 text-center text-2xl font-bold text-slate-900">
          Quality Parts &amp; Services You Can Trust
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-slate-600">
          We back every order with genuine parts, worldwide logistics, and a support team that knows
          industrial automation.
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {trustFeatures.map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <f.icon className="mx-auto mb-4 size-10 text-primary" />
              <h3 className="mb-2 font-semibold text-slate-900">{f.title}</h3>
              <p className="text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Protect Uptime. Reduce Downtime. */}
      <section className="bg-slate-900 py-16 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-3xl font-bold">
              Protect Uptime. Reduce Downtime. <span className="text-accent">The Alliance Difference.</span>
            </h2>
            <p className="mb-8 text-slate-300">
              When a critical part fails, every hour of downtime costs money. Our stocked inventory and
              fast quotation process get replacement parts moving before your line stops.
            </p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-3xl font-bold text-accent">24/7</p>
                <p className="text-sm text-slate-300">Support</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-accent">150+</p>
                <p className="text-sm text-slate-300">Brands</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-accent">Same-Day</p>
                <p className="text-sm text-slate-300">Quotation</p>
              </div>
            </div>
          </div>
          <div className="flex h-64 items-center justify-center rounded-xl bg-white/5 backdrop-blur">
            <Zap className="size-24 text-accent/60" />
          </div>
        </div>
      </section>

      {/* Services & Support */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold text-slate-900">Services &amp; Support</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {supportServices.map((s) => (
            <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-6">
              <s.icon className="mb-4 size-10 text-primary" />
              <h3 className="mb-2 font-semibold text-slate-900">{s.title}</h3>
              <p className="text-sm text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Client Reviews */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold text-slate-900">What Our Clients Say</h2>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {reviews.map((r) => (
              <div key={r.id} className="w-72 shrink-0 rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-2 flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`size-4 ${i < r.rating ? "fill-accent text-accent" : "text-slate-300"}`}
                    />
                  ))}
                </div>
                <p className="mb-4 text-sm text-slate-600">&ldquo;{r.text}&rdquo;</p>
                <p className="text-sm font-semibold text-slate-900">{r.author}</p>
                <p className="text-xs text-slate-500">{r.country}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="about" className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
        <Accordion>
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.question} value={`faq-${i}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-2 text-center text-2xl font-bold text-slate-900">Contact Us</h2>
          <p className="mx-auto mb-10 max-w-xl text-center text-slate-600">
            Have a question about a part or need help specifying a component? Send us a message.
          </p>
          <ContactForm />
        </div>
      </section>
    </div>
  );
}
