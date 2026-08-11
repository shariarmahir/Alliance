export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

export type Category = {
  slug: string;
  name: string;
  icon: string; // path under /images/categories
  productCount: number;
};

export type Brand = {
  slug: string;
  name: string;
  logo: string; // path under /images/brands
};

export type Product = {
  slug: string;
  partNumber: string;
  name: string;
  brand: string; // Brand.slug
  categorySlug: string; // Category.slug
  image: string; // path under /images/products
  gallery: string[];
  shortSpecs: string[]; // bullets for cards
  description: string[]; // bullets for detail page
  alternatePartNumbers: string[];
  specifications: Record<string, string>;
  price: number; // USD, unit price
  stock: StockStatus;
  warrantyYears: number;
  weekRank?: number; // present + low number = top seller this week
  monthRank?: number;
  yearRank?: number;
};

export type Review = {
  id: string;
  author: string;
  country: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
};

export type FaqItem = { question: string; answer: string };

// One line item in the persistent multi-item quote cart.
export type QuoteItem = {
  slug: string;
  partNumber: string;
  name: string;
  brand: string;
  image: string;
  price: number; // unit price, USD
  quantity: number;
};

export type DeliveryOptionId = "standard" | "express" | "air";

export type DeliveryOption = {
  id: DeliveryOptionId;
  name: string;
  eta: string;
  cost: number;
};

export type DeliveryAddress = {
  name: string;
  line: string;
  city: string;
  country: string;
  phone: string;
};

// A confirmed order, persisted client-side (no server round-trip).
export type Order = {
  orderNumber: string;
  trackingId: string;
  items: QuoteItem[];
  subtotal: number;
  shippingCost: number;
  grandTotal: number;
  deliveryOption: DeliveryOptionId;
  deliveryOptionName: string;
  deliveryEta: string;
  preferredDate: string; // yyyy-mm-dd
  address: DeliveryAddress;
  placedAt: string; // ISO
};
