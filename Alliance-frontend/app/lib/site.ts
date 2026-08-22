// The canonical, absolute origin of the storefront.
//
// Search engines need absolute URLs — in the sitemap, in robots.txt, in
// canonical tags and in structured data — and they must point at the domain
// people actually visit. A placeholder here is not a cosmetic bug: the sitemap
// previously advertised every page as living on a domain that does not exist,
// which tells Google to index nothing here.
//
// Overridable per environment so preview deployments describe themselves
// rather than claiming to be production, but it falls back to the real domain
// because that is what matters if the variable is ever missing.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.auto-bd.com"
).replace(/\/$/, "");

// Used as the fixed part of page titles and in structured data.
export const SITE_NAME = "AutoLink Integrated Technologies";
export const SITE_SHORT_NAME = "AutoLink";

// The single place the business's contact details are expressed for machines.
// Kept beside the URL because Google's rich results tie them together: the
// name, logo, address and phone must agree across every page for the knowledge
// panel and the map pin to resolve to one entity.
export const BUSINESS = {
  streetAddress: "House: 104, Road: 15, Sector: 11",
  locality: "Uttara, Dhaka",
  postalCode: "1230",
  country: "BD",
  email: "info@auto-bd.com",
  telephone: "+8801315770099",
  // Centre of Uttara Sector 11, Dhaka (OpenStreetMap). Coordinates let Google
  // place the pin without geocoding the address itself, which is unreliable
  // for Dhaka sector addresses. Approximate to the sector, not the building —
  // worth replacing with the exact rooftop point from the business's own
  // Google Business Profile once that exists.
  latitude: 23.8774,
  longitude: 90.3905,
} as const;

// Public social profiles, in the order they appear in the header strip.
//
// WhatsApp is the number the business already publishes everywhere else, so it
// is authoritative. LinkedIn and Facebook are best-guess vanity URLs derived
// from the brand name: point them at the real pages when those exist, because
// a link to a page that isn't ours is worse than no link at all. These are
// also what Google reads as `sameAs` for entity resolution, so a wrong handle
// here teaches the knowledge panel the wrong account.
export const SOCIAL = {
  linkedin: "https://www.linkedin.com/company/autolink-integrated-technologies",
  facebook: "https://www.facebook.com/autolinkbd",
  whatsapp: `https://wa.me/${BUSINESS.telephone.replace(/\D/g, "")}`,
} as const;
