import type { Metadata } from "next";
import { BUSINESS, SITE_NAME, SITE_URL } from "@/app/lib/site";

// contact/page.tsx is a client component and cannot export metadata itself.
// A layout is the standard way to attach it — the address and phone number
// belong in the description because this is the page a local search should
// land on.
export const metadata: Metadata = {
  title: "Contact AutoLink — Uttara, Dhaka",
  description:
    "Contact AutoLink Integrated Technologies: House 104, Road 15, Sector 11, Uttara, Dhaka-1230, Bangladesh. Phone +8801713-116019, email info@auto-bd.com. Quotations answered within 4 working hours.",
  alternates: { canonical: "/contact" },
};

// A ContactPage that points back at the Organization defined in the root
// layout. Repeating the address on the page a local search lands on — rather
// than only on the homepage — is what ties the business to this location.
const CONTACT_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  url: `${SITE_URL}/contact`,
  mainEntity: {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    email: BUSINESS.email,
    telephone: BUSINESS.telephone,
    address: {
      "@type": "PostalAddress",
      streetAddress: BUSINESS.streetAddress,
      addressLocality: BUSINESS.locality,
      postalCode: BUSINESS.postalCode,
      addressCountry: BUSINESS.country,
    },
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(CONTACT_SCHEMA) }}
      />
      {children}
    </>
  );
}
