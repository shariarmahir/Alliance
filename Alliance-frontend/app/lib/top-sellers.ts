// TEMPORARY MOCK DATA — replace with FastAPI backend
// Landing-page-only "Top Selling" showcase, separate from the main catalog
// dataset in mock-data.ts. Uses stock photography for visual variety.

export type TopSeller = {
  id: string;
  name: string;
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

const NAMES = [
  "1762-L40AWA MicroLogix 1200 PLC",
  "PowerFlex 525 AC Drive 5HP",
  "Kinetix 5500 Servo Drive",
  "WEG W22 IE3 Electric Motor 7.5kW",
  "1606-XLP95E Power Supply",
  "E3Z-D61 Photoelectric Sensor",
  "PanelView Plus 7 Standard HMI",
  "1756-L71 ControlLogix Processor",
];

const BRANDS = ["Allen Bradley", "Siemens", "ABB", "Schneider Electric", "Mitsubishi", "Omron", "Fanuc", "Yaskawa"];
const CONDITIONS: TopSeller["condition"][] = ["New", "Refurbished", "Repair / Exchange"];

export const topSellers: TopSeller[] = NAMES.map((name, i) => {
  const price = 145 + ((i * 137) % 1850);
  return {
    id: slug(name),
    name,
    brand: BRANDS[i % BRANDS.length],
    image: PIMG[i % PIMG.length],
    price,
    oldPrice: price + 80 + (i % 6) * 45,
    rating: (40 + (i % 11)) / 10,
    reviews: 8 + ((i * 7) % 180),
    condition: CONDITIONS[i % CONDITIONS.length],
    stock: i % 7 === 0 ? 0 : 3 + ((i * 11) % 60),
  };
});
