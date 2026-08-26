import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/app/components/ui/sonner";
import { Providers } from "./providers";
import { BUSINESS, SITE_NAME, SITE_SHORT_NAME, SITE_URL, SOCIAL } from "@/app/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Without metadataBase every relative URL in metadata (OG images, canonicals)
  // resolves against localhost in the built output, so shared links and
  // canonical tags point nowhere.
  metadataBase: new URL(SITE_URL),
  title: {
    // The brand name leads: someone searching "autolink" should see it as the
    // first words of the result, not buried behind a keyword phrase.
    default: `${SITE_SHORT_NAME} — Industrial Electronics & Automation Parts in Bangladesh`,
    template: `%s | ${SITE_SHORT_NAME}`,
  },
  description:
    "AutoLink Integrated Technologies supplies PLCs, drives, servos, HMIs and industrial automation spares from Uttara, Dhaka — quoted within 4 working hours and shipped worldwide.",
  applicationName: SITE_NAME,
  // Tells Google which URL is the real one when a page is reachable at several
  // (www vs bare domain, query-string variants).
  alternates: { canonical: "/" },
  // Google ignores this tag for ranking. It is kept because other engines
  // (Bing, Yandex, and most site-search tools) still read it, and it costs
  // nothing. The brand variants that actually matter for search live in the
  // Organization's alternateName below, which Google does read.
  keywords: [
    "AutoLink",
    "AutoLink BD",
    "AutoLinkBD",
    "AutoLink Bangladesh",
    "AutoLink Integrated Technologies",
    "auto technology Bangladesh",
    "industrial electronics Bangladesh",
    "PLC supplier Dhaka",
    "automation parts Bangladesh",
    "servo drives Dhaka",
    "HMI supplier Bangladesh",
    "inverter supplier Bangladesh",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Lets Google show full-length text snippets, large image previews and
      // video previews — without this it may truncate the listing.
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Industrial Electronics & Automation Parts`,
    description:
      "PLCs, drives, servos, HMIs and automation spares, quoted within 4 working hours and shipped worldwide from Bangladesh.",
    url: SITE_URL,
    type: "website",
    locale: "en_US",
    images: [{ url: "/logo-mark.png", width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} — Industrial Electronics & Automation Parts`,
    description:
      "PLCs, drives, servos, HMIs and automation spares, shipped worldwide from Bangladesh.",
    images: ["/logo-mark.png"],
  },
  icons: { icon: "/logo-mark.png", apple: "/logo-mark.png" },
  // Search Console's HTML-tag verification, as an alternative to the DNS TXT
  // record. Set GOOGLE_SITE_VERIFICATION to the token Google gives you and
  // redeploy; when unset the meta tag is simply omitted. Worth having because
  // DNS verification depends on the registrar's editor accepting the record,
  // and this route does not.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

// Structured data describing the business to search engines.
//
// Three linked entities rather than one blob, because Google treats them
// differently: the Organization is what a knowledge panel and the logo in a
// result are drawn from, the LocalBusiness with geo coordinates is what places
// a map pin, and the WebSite entity is what lets the brand name resolve to
// this site. They are cross-referenced by @id so Google reads them as one
// business rather than three unrelated things.
//
// Every URL here is absolute. Relative paths are silently ignored in
// structured data, which is the usual reason a logo never appears in results.
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: SITE_NAME,
      // Every spelling someone might actually type. Google matches a brand
      // query against these, so "autolinkbd" and "autolink bd" resolve to
      // this entity rather than to nothing — they are how the business is
      // written on social handles and in conversation, not just formally.
      alternateName: [
        SITE_SHORT_NAME,
        "AutoLink BD",
        "AutoLinkBD",
        "AutoLink Bangladesh",
        "Auto Link",
        "AutoLink Technologies",
        "AutoLink Integrated Technology",
      ],
      url: SITE_URL,
      // The strongest single signal tying a brand name to a site. Google
      // corroborates the entity against profiles it already knows, so a
      // knowledge panel for "autolink" resolves here instead of to an
      // unrelated company sharing the word. SOCIAL already held these; they
      // were simply never expressed to search engines.
      sameAs: [SOCIAL.facebook, SOCIAL.linkedin],
      description:
        "Supplier of industrial electronics and automation spares — PLCs, drives, servos, HMIs and power system electronics.",
      logo: {
        "@type": "ImageObject",
        "@id": `${SITE_URL}/#logo`,
        url: `${SITE_URL}/logo-mark.png`,
        contentUrl: `${SITE_URL}/logo-mark.png`,
        width: 512,
        height: 512,
        caption: SITE_NAME,
      },
      image: { "@id": `${SITE_URL}/#logo` },
      email: BUSINESS.email,
      telephone: BUSINESS.telephone,
      foundingDate: "2009",
      address: {
        "@type": "PostalAddress",
        streetAddress: BUSINESS.streetAddress,
        addressLocality: BUSINESS.locality,
        postalCode: BUSINESS.postalCode,
        addressCountry: BUSINESS.country,
      },
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "sales",
          email: BUSINESS.email,
          telephone: BUSINESS.telephone,
          areaServed: "Worldwide",
          availableLanguage: ["en", "bn"],
        },
      ],
    },
    {
      // The geo block is what produces a map location for the business.
      "@type": "LocalBusiness",
      "@id": `${SITE_URL}/#localbusiness`,
      parentOrganization: { "@id": ORGANIZATION_ID },
      name: SITE_NAME,
      url: SITE_URL,
      image: { "@id": `${SITE_URL}/#logo` },
      email: BUSINESS.email,
      telephone: BUSINESS.telephone,
      priceRange: "$$",
      address: {
        "@type": "PostalAddress",
        streetAddress: BUSINESS.streetAddress,
        addressLocality: BUSINESS.locality,
        postalCode: BUSINESS.postalCode,
        addressCountry: BUSINESS.country,
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: BUSINESS.latitude,
        longitude: BUSINESS.longitude,
      },
      // Sunday-Thursday is the Bangladeshi working week; Friday is the weekly
      // holiday and Saturday is commonly worked in trade.
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: [
            "Saturday",
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
          ],
          opens: "09:00",
          closes: "18:00",
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: SITE_SHORT_NAME,
      publisher: { "@id": ORGANIZATION_ID },
      inLanguage: "en",
      // Offers the catalogue search box directly in the result listing.
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/products?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}


