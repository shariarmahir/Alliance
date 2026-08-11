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
  employeeId?: string; // present for real employee accounts; absent for the 2 original hardcoded mock accounts
};

export type Designation = "sales-associate" | "warehouse-staff" | "support-agent" | "catalog-manager";

export type Employee = {
  id: string; // crypto.randomUUID(), also used as AdminSession.employeeId
  employeeIdNumber: string; // human-facing ID like "EMP-0042", admin-assigned, unique
  name: string;
  email: string;
  password: string; // plain text — see mock-security note in Phase 4 design spec
  designation: Designation;
  createdAt: string; // ISO
};

export type TaskStatus = "pending" | "in-progress" | "completed";

export type Task = {
  id: string;
  title: string;
  description: string;
  assigneeEmployeeId: string; // Employee.id
  dueDate: string; // yyyy-mm-dd
  status: TaskStatus; // defaults to "pending"
  createdAt: string; // ISO
};

export type LeaveStatus = "pending" | "approved" | "rejected";

export type LeaveRequest = {
  id: string;
  employeeId: string;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  reason: string;
  status: LeaveStatus; // defaults to "pending"
  submittedAt: string; // ISO
};

export type DailyReport = {
  id: string;
  employeeId: string;
  date: string; // yyyy-mm-dd, defaults to submission day
  hoursWorked: number;
  summary: string; // free text, what they worked on
  submittedAt: string; // ISO
};

export type RevenuePoint = { label: string; value: number };
export type OrderRatioSlice = { status: "confirmed" | "pending" | "cancelled"; count: number };
export type CountryBreakdown = { country: string; orders: number };
export type TrafficSource = { source: string; orders: number };

export type OrderStatus = "pending" | "confirmed" | "cancelled";
export type QuotationStatus = "pending" | "confirmed" | "cancelled";

// A confirmed order. Persisted client-side (localStorage, for the success/
// invoice page) AND, as of Phase 3, mirrored server-side via POST /api/orders
// so admins can review and confirm/cancel it (data/orders.json).
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
  status: OrderStatus; // defaults to "pending" on creation
};

// A submitted quotation, persisted server-side (data/quotations.json) as of
// Phase 3 — previously sessionStorage-only.
export type Quotation = {
  id: string; // crypto.randomUUID()
  items: QuoteItem[];
  total: number;
  details: QuotationDetails;
  status: QuotationStatus; // defaults to "pending"
};

export type ContactRequest = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: string; // ISO
  handled: boolean; // admin marks true once actioned
};

// Mock inbox entry — explicitly NOT a real email integration, UI preview only.
export type MockEmail = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  receivedAt: string; // ISO
  status: "pending" | "received";
};
