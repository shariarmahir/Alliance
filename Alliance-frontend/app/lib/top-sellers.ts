// TEMPORARY MOCK DATA — replace with FastAPI backend
// Landing-page-only "Top Selling" showcase, separate from the main catalog
// dataset in mock-data.ts. Uses stock photography for visual variety.

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

// Part number / description / brand triples, matching the parts named in the
// design bundle so cards read the way the spec renders them.
const PARTS: { partNumber: string; name: string; brand: string }[] = [
  {
    partNumber: "1762-L40AWA",
    name: "MicroLogix 1200 controller, 24 discrete inputs, 16 relay outputs, 120/240 V AC",
    brand: "Allen-Bradley",
  },
  {
    partNumber: "FR-E740-095SC",
    name: "FR-E700 inverter, 3.7 kW, 400 V three-phase, built-in EMC filter",
    brand: "Mitsubishi",
  },
  {
    partNumber: "6AV2124-0GC01",
    name: 'SIMATIC HMI TP700 Comfort panel, 7" widescreen TFT, PROFINET',
    brand: "Siemens",
  },
  {
    partNumber: "R88D-KN04H-ECT",
    name: "Accurax G5 servo drive, 400 W, EtherCAT, single-phase 230 V",
    brand: "Omron",
  },
  {
    partNumber: "1756-L83E",
    name: "ControlLogix 5580 processor, 40 MB memory, dual Gigabit EtherNet/IP",
    brand: "Allen-Bradley",
  },
  {
    partNumber: "6ES7214-1AG40-0XB0",
    name: "SIMATIC S7-1200 CPU 1214C, 14 DI / 10 DO / 2 AI, PROFINET",
    brand: "Siemens",
  },
  {
    partNumber: "CJ2M-CPU31",
    name: "CJ2M CPU unit with built-in EtherNet/IP, 20 k steps program capacity",
    brand: "Omron",
  },
  {
    partNumber: "1606-XLE120E",
    name: "24 V DC 5 A DIN-rail switched-mode power supply",
    brand: "Allen-Bradley",
  },
];

const CONDITIONS: TopSeller["condition"][] = ["New", "Refurbished", "Repair / Exchange"];

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
  };
});
