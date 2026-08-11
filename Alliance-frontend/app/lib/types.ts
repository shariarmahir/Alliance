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
  stock: StockStatus; // derived from stockQty via deriveStockStatus — not set directly by admin
  stockQty: number; // admin sets this directly
  warrantyYears: number;
  weekRank?: number; // present + low number = top seller this week
  monthRank?: number;
  yearRank?: number;
};

// One line of a bulk-import numbered product list (see admin bulk import validation).
export type BulkProductRow = {
  lineNumber: number; // the leading "1.", "2." etc — also used for image filename matching
  name: string;
  partNumber: string;
  price: number;
  shortSpecs: string; // free text, comma-separated in the bulk line, split into shortSpecs[] on save
  stock: StockStatus;
};

export type BulkImportError = {
  lineNumber: number | null; // null = an image file with no matching product line
  message: string;
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

export type ContactMethod = "email" | "phone" | "whatsapp";

export type LeadTime = "standard" | "urgent" | "flexible";

// Details collected on the Create Quotation form, submitted alongside the cart.
export type QuotationDetails = {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  companyName: string;
  country: string;
  taxId: string;
  companyWebsite: string;
  preferredContact: ContactMethod;
  leadTime: LeadTime;
  notes: string;
  submittedAt: string; // ISO
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

export type AdminRole = "super" | "sub";

export type AdminSession = {
  role: AdminRole;
  name: string;
  email: string;
};

export type RevenuePoint = { label: string; value: number };
export type OrderRatioSlice = { status: "confirmed" | "pending" | "cancelled"; count: number };
export type CountryBreakdown = { country: string; orders: number };
export type TrafficSource = { source: string; orders: number };

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
