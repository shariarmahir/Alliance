import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | AutoLink Integrated Technologies",
  description: "How AutoLink Integrated Technologies collects, uses and protects your information.",
};

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "1. What we collect",
    body: (
      <>
        <p className="mb-3">We collect information you provide directly to us, specifically:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong className="text-ink">Price requests</strong> — your name, job title, company
            name, country, tax/VAT number, company website, email, phone, preferred contact method,
            and the parts and quantities requested.
          </li>
          <li>
            <strong className="text-ink">Contact form submissions</strong> — your name, email, and
            message.
          </li>
        </ul>
        <p className="mt-3">
          We do not collect payment card details — no payment is taken through this website. We do
          not use tracking cookies or third-party advertising trackers.
        </p>
      </>
    ),
  },
  {
    heading: "2. How we use it",
    body: (
      <>
        <p className="mb-3">Information you submit is used to:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Price your request and issue a quotation or order confirmation.</li>
          <li>Contact you about your request, order, or delivery.</li>
          <li>Send you the quotation document and delivery tracking details by email.</li>
          <li>Respond to enquiries submitted through the contact form.</li>
          <li>Maintain records required for order fulfilment, warranty and accounting purposes.</li>
        </ul>
        <p className="mt-3">
          We do not sell, rent, or trade your information to third parties. We do not use your
          information for advertising or marketing profiling.
        </p>
      </>
    ),
  },
  {
    heading: "3. Who can see it",
    body: (
      <p>
        Your request and order details are visible to AutoLink staff who need them to price,
        confirm, or fulfil your order — access is role-based, so a team member only sees what their
        role requires. We use third-party services strictly to operate the site: Resend for
        transactional email delivery (quotation and order emails) and Vercel for hosting and file
        storage. These providers process data on our behalf and do not use it for their own
        purposes.
      </p>
    ),
  },
  {
    heading: "4. How long we keep it",
    body: (
      <p>
        Quotation, order, and contact records are retained as part of our business records for as
        long as reasonably necessary for order history, warranty claims, and accounting
        obligations. If you would like a record deleted where we are not required to keep it,
        contact us and we will action the request.
      </p>
    ),
  },
  {
    heading: "5. Your requests to a price request",
    body: (
      <p>
        Each price request is tracked by a unique reference (its request or tracking ID) rather than
        a customer account — there is no login for customers on this site. That reference, together
        with the email on file, is how you or we identify your request. Keep it, as we use it the
        same way to answer follow-up questions.
      </p>
    ),
  },
  {
    heading: "6. Your rights",
    body: (
      <p>
        You may ask us at any time to tell you what information we hold about you, to correct
        inaccurate information, or to delete records we are not legally required to keep. Contact us
        using the details below and we will respond as soon as reasonably possible.
      </p>
    ),
  },
  {
    heading: "7. Security",
    body: (
      <p>
        We take reasonable technical measures to protect the information you provide, including
        restricting access to authorised staff and encrypting data in transit. No method of
        transmission or storage is perfectly secure, and we cannot guarantee absolute security.
      </p>
    ),
  },
  {
    heading: "8. Changes to this policy",
    body: (
      <p>
        We may update this policy from time to time to reflect changes in how we operate. The
        version published here is the one in effect. For questions about this policy or your
        information, reach us via the{" "}
        <Link href="/contact" className="font-semibold text-primary hover:underline">
          contact page
        </Link>
        .
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-7 py-14 md:px-0">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-tint">
          <ShieldCheck className="size-5 text-primary" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
            Privacy Policy
          </h1>
          <p className="text-[13px] text-ink-muted">Last updated: 19 August 2026</p>
        </div>
      </div>

      <p className="mb-10 text-[14.5px] leading-[1.75] text-ink-soft">
        This policy explains what information AutoLink Integrated Technologies collects when you
        request a price, submit an order, or contact us — and how we use, store, and protect it.
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
          To exercise your rights or ask about your information, contact us at{" "}
          <a href="mailto:info@auto-bd.com" className="font-semibold text-primary hover:underline">
            info@auto-bd.com
          </a>{" "}
          or write to House: 104, Road: 15, Sector: 11, Uttara, Dhaka-1230, Bangladesh.
        </p>
      </div>
    </div>
  );
}
