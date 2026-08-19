// TEMPORARY MOCK DATA — replace with FastAPI backend
// Landing-page-only "Top Selling" showcase, separate from the main catalog
// dataset in mock-data.ts. Uses stock photography for visual variety.

export type TopSellerPeriod = "week" | "month" | "year";

export type TopSeller = {
  id: string;
  partNumber: string; // rendered in IBM Plex Mono as the card's primary identity
  name: string; // descriptive line beneath the part number
  brand: string;
  image: string;
  price: number;
  oldPrice: number;
  rating: number;
  reviews: number;
  condition: "New" | "Refurbished" | "Repair / Exchange";
  stock: number;
  // Rank within each period, 1 = most requested. Every item in the pool
  // appears in all three periods (there's no separate per-period catalog
  // yet — see Product.weekRank/monthRank/yearRank for the real equivalent
  // used once a part has actual request-volume history), just reordered, so
  // switching periods on the homepage is a genuine re-sort rather than a
  // fixed illustration.
  weekRank: number;
  monthRank: number;
  yearRank: number;
};

const PIMG = [
  "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  "https://images.unsplash.com/photo-1562408590-e32931084e23?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  "https://images.unsplash.com/photo-1596213812143-ff89bd9ddecd?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  "https://images.unsplash.com/photo-1692719094491-2746e82a8595?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  "https://images.unsplash.com/photo-1638734255280-8bae834f8297?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  "https://images.unsplash.com/photo-1583267925993-935f26612138?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  "https://images.unsplash.com/photo-1638734254958-4a11c989e9bb?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
];

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Part number / description / brand triples. These must exist in
// data/products.json (checked against Product.partNumber, not just similar) —
// the "View details" link on each card sends shoppers to /products?q=<part>,
// and a part with no catalog match lands on an empty search result. Six of
// the original eight were mock numbers from the design bundle with no
// catalog counterpart; swapped for the closest real analogue in the same
// brand/category. 1606-XLE120E and 6ES7214-1AG40-0XB0 were already real.
const PARTS: { partNumber: string; name: string; brand: string }[] = [
  {
    partNumber: "1769-L33ER",
    name: "CompactLogix 5370 controller, embedded EtherNet/IP, expandable I/O",
    brand: "Allen-Bradley",
  },
  {
    partNumber: "FR-E820-3.7K-1",
    name: "FREQROL-E800 compact inverter, 3.7 kW, built-in EMC filter",
    brand: "Mitsubishi",
  },
  {
    partNumber: "6AV2123-2GB03-0AX0",
    name: "SIMATIC KTP700 Basic panel, 7\" widescreen TFT, PROFINET",
    brand: "Siemens",
  },
  {
    partNumber: "3G3MX2-AB004-E",
    name: "SYSDRIVE MX2 series inverter, compact vector control drive",
    brand: "Omron",
  },
  {
    partNumber: "1756-L61",
    name: "ControlLogix 5561 processor module, 2 MB user memory, ControlBus backplane",
    brand: "Allen-Bradley",
  },
  {
    partNumber: "6ES7214-1AG40-0XB0",
    name: "SIMATIC S7-1200 CPU 1214C, 14 DI / 10 DO / 2 AI, PROFINET",
    brand: "Siemens",
  },
  {
    partNumber: "CJ2M-CPU34",
    name: "SYSMAC CJ2M series CPU unit with built-in EtherNet/IP",
    brand: "Omron",
  },
  {
    partNumber: "1606-XLE120E",
    name: "24 V DC 5 A DIN-rail switched-mode power supply",
    brand: "Allen-Bradley",
  },
];

const CONDITIONS: TopSeller["condition"][] = ["New", "Refurbished", "Repair / Exchange"];

// Deterministic reorderings, not the same ranking three times over — a
// rotation offset per period so "This month" and "This year" visibly differ
// from "This week" instead of the toggle appearing to do nothing.
function rankFor(index: number, offset: number): number {
  return ((index + offset) % PARTS.length) + 1;
}

export const topSellers: TopSeller[] = PARTS.map((part, i) => {
  const price = 145 + ((i * 137) % 1850);
  return {
    id: slug(part.partNumber),
    partNumber: part.partNumber,
    name: part.name,
    brand: part.brand,
    image: PIMG[i % PIMG.length],
    price,
    oldPrice: price + 80 + (i % 6) * 45,
    rating: (40 + (i % 11)) / 10,
    reviews: 8 + ((i * 7) % 180),
    condition: CONDITIONS[i % CONDITIONS.length],
    stock: i % 7 === 0 ? 0 : 3 + ((i * 11) % 60),
    weekRank: rankFor(i, 0),
    monthRank: rankFor(i, 3),
    yearRank: rankFor(i, 5),
  };
});

const RANK_KEY: Record<TopSellerPeriod, keyof Pick<TopSeller, "weekRank" | "monthRank" | "yearRank">> = {
  week: "weekRank",
  month: "monthRank",
  year: "yearRank",
};

export function topSellersFor(period: TopSellerPeriod, count = 4): TopSeller[] {
  const key = RANK_KEY[period];
  return [...topSellers].sort((a, b) => a[key] - b[key]).slice(0, count);
}
