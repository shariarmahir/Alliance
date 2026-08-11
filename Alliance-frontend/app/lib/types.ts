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

export type QuoteRequest = {
  id: string;
  productSlug: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  createdAt: string; // ISO
};

export type DeliveryOption = "standard" | "express";

export type Order = {
  id: string;
  orderNumber: string;
  quoteId: string;
  deliveryOption: DeliveryOption;
  estimatedDeliveryDate: string; // ISO date
  trackingId: string;
  createdAt: string; // ISO
};
