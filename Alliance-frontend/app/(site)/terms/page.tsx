import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Trade | AutoLink Integrated Technologies",
  description:
    "Terms of trade for quotations, orders and delivery with AutoLink Integrated Technologies.",
};

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "1. How a quotation becomes an order",
    body: (
      <p>
        AutoLink is a quotation-based supplier: browsing the catalogue and requesting a price does
        not create an order or any payment obligation. A price request becomes a firm order only
        once AutoLink issues a priced order confirmation and you accept it. Nothing on this site
        should be read as an offer capable of acceptance by simply adding an item to a cart — there
        is no cart, by design.
      </p>
    ),
  },
  {
    heading: "2. Pricing and validity",
    body: (
      <p>
        Prices quoted are specific to the request they were issued against and are valid for the
        period stated on the order confirmation (typically 7 days from the offer date unless stated
        otherwise). Prices exclude freight, duty, and applicable VAT/AIT unless the confirmation says
        otherwise, and are subject to change without notice until formally confirmed in writing.
      </p>
    ),
  },
  {
    heading: "3. Payment",
    body: (
      <p>
        Unless a different arrangement is confirmed in writing on your order confirmation, payment
        terms are 100% cash or pay order. No payment is collected through this website — all payment
        is arranged directly with our team once your order is confirmed.
      </p>
    ),
  },
  {
    heading: "4. Delivery",
    body: (
      <p>
        Stated delivery timelines (e.g. &ldquo;from ready stock&rdquo;) are estimates based on
        current inventory and are confirmed at the time of order. Freight, duty, and final delivery
        arrangements are agreed with you directly by our team after your order is confirmed — this
        site does not process shipping bookings itself. Our team will keep you updated on delivery
        status directly by email or WhatsApp.
      </p>
    ),
  },
  {
    heading: "5. Warranty",
    body: (
      <p>
        Unless otherwise stated on your order confirmation, parts supplied by AutoLink carry a
        12-month warranty from the date of delivery, covering manufacturing defects under normal
        use. Warranty does not cover damage from misuse, incorrect installation, electrical
        transients, or unauthorised repair. Repair/exchange items are warranted against the specific
        fault repaired, not as new-condition parts.
      </p>
    ),
  },
  {
    heading: "6. Cancellations",
    body: (
      <p>
        A pending price request may be cancelled at any time before it is confirmed by contacting
        us. Once an order confirmation has been issued and accepted, cancellation is handled
        case-by-case — contact us as early as possible, as parts may already be reserved or shipped
        against your order.
      </p>
    ),
  },
  {
    heading: "7. Returns",
    body: (
      <p>
        Unused parts in original packaging may be returned within 14 days of delivery for eligible
        products. Contact our support team with your order number to initiate a return. Parts
        supplied to a custom specification, or opened/installed parts, are not eligible for return
        except where covered by warranty.
      </p>
    ),
  },
  {
    heading: "8. Export and international orders",
    body: (
      <p>
        AutoLink ships internationally. Export documentation, HS codes, and any import duties or
        taxes in the destination country are the responsibility of the buyer unless explicitly
        agreed otherwise in writing.
      </p>
    ),
  },
  {
    heading: "9. Changes to these terms",
    body: (
      <p>
        These terms may be updated from time to time; the version in effect at the time your order
        is confirmed applies to that order. For questions about these terms, reach us via the{" "}
        <Link href="/contact" className="font-semibold text-primary hover:underline">
          contact page
        </Link>
        .
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-7 py-14 md:px-0">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-tint">
          <FileText className="size-5 text-primary" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
            Terms of Trade
          </h1>
          <p className="text-[13px] text-ink-muted">Last updated: 19 August 2026</p>
        </div>
      </div>

      <p className="mb-10 text-[14.5px] leading-[1.75] text-ink-soft">
        These terms govern quotations, orders and delivery arranged through the AutoLink Integrated
        Technologies website and sales team. By requesting a price or accepting an order
        confirmation, you agree to the terms below.
      </p>

      <div className="space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.heading}>
            <h2 className="mb-2 text-[15.5px] font-bold text-ink">{s.heading}</h2>
            <div className="text-[13.5px] leading-[1.75] text-ink-soft">{s.body}</div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-[10px] border border-slate-line bg-surface p-5">
        <p className="text-[13px] leading-[1.7] text-ink-muted">
          Questions about a specific order or quotation? Contact us at{" "}
          <a href="mailto:info@auto-bd.com" className="font-semibold text-primary hover:underline">
            info@auto-bd.com
          </a>{" "}
          or WhatsApp{" "}
          <a
            href="https://wa.me/8801315770099"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono font-semibold text-primary hover:underline"
          >
            +8801315-770099
          </a>
          .
        </p>
      </div>
    </div>
  );
}
