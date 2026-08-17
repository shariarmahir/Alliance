import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/app/components/ui/sonner";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "AutoLink Integrated Technologies — Industrial Electronics & Automation Parts", template: "%s | AutoLink" },
  description:
    "AutoLink Integrated Technologies supplies PLCs, drives, servos, HMIs, and industrial automation components worldwide, shipped from Bangladesh.",
  applicationName: "AutoLink Integrated Technologies",
  openGraph: {
    siteName: "AutoLink Integrated Technologies",
    title: "AutoLink Integrated Technologies — Industrial Electronics & Automation Parts",
    description:
      "PLCs, drives, servos, HMIs and automation spares, quoted within 4 working hours and shipped worldwide from Bangladesh.",
    type: "website",
  },
};

// Tells search engines the registered entity behind the "AutoLink" wordmark,
// so the legal name, contact details and address can surface in rich results.
const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AutoLink Integrated Technologies",
  alternateName: "AutoLink",
  description:
    "Supplier of industrial electronics and automation spares — PLCs, drives, servos, HMIs and power system electronics.",
  logo: "/logo-mark.png",
  email: "info@auto-bd.com",
  telephone: "+8801713-116019",
  foundingDate: "2009",
  address: {
    "@type": "PostalAddress",
    streetAddress: "House: 104, Road: 15, Sector: 11",
    addressLocality: "Uttara, Dhaka-1230",
    addressCountry: "BD",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    email: "info@auto-bd.com",
    telephone: "+8801713-116019",
  },
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }}
        />
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}


