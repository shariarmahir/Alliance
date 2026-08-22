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

// Areas a sub-admin cannot reach by default (see SUB_ADMIN_ALLOWED_PREFIXES
// in proxy.ts) but can be individually granted per employee. Products,
// stock, tasks, leave etc. are NOT here — those are already open to every
// sub-admin and aren't gated by this list.
export type AccessArea = "quotations" | "orders" | "emails" | "contact-requests";

export type AdminSession = {
  role: AdminRole;
  name: string;
  email: string;
  employeeId?: string; // present for real employee accounts; absent for the 2 original hardcoded mock accounts
  // Granted AccessAreas for this session. Always empty for "super" (which
  // has unconditional access — checked separately, not via this list) and
  // for the 2 hardcoded mock accounts.
  accessOptions?: AccessArea[];
};

export type Designation =
  | "sales-associate"
  | "warehouse-staff"
  | "support-agent"
  | "catalog-manager"
  | "other";

export type Employee = {
  id: string; // crypto.randomUUID(), also used as AdminSession.employeeId
  employeeIdNumber: string; // human-facing ID like "EMP-0042", admin-assigned, unique
  name: string;
  email: string;
  password: string; // bcrypt hash — never plaintext, never returned by any API route
  designation: Designation;
  customDesignation?: string; // free-text label, set only when designation === "other"
  role?: AdminRole; // defaults to "sub" when absent; lets a super admin promote staff
  accessOptions: AccessArea[]; // areas granted beyond the sub-admin default
  disabled?: boolean; // soft-delete: blocks login but keeps tasks/reports resolvable
  createdAt: string; // ISO
};

// Employee with the password field removed — the only shape that may cross an
// API boundary or reach a client component.
export type SafeEmployee = Omit<Employee, "password">;

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
// "quoted" = priced and the PDF produced, but not yet accepted. Still an open
// request, so it stays in the Pending queue alongside "pending".
export type QuotationStatus = "pending" | "quoted" | "confirmed" | "cancelled";
export type PaymentStatus = "pending" | "received";

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

// One priced line on an issued order confirmation. Deliberately a separate
// shape from QuoteItem: the customer's request and the admin's priced offer
// are different documents, so confirming must not overwrite what was asked.
export type ConfirmedLine = {
  productId: string; // auto-generated server-side, e.g. "AIT-PRD-8F3C21"
  slug: string;
  partNumber: string;
  name: string;
  image: string;
  specifications: string; // free text shown in the PDF's Specifications column
  quantity: number;
  unit: string; // "Pcs" / "Set" / etc — admin picks per line
  unitPrice: number; // BDT, admin-editable (catalog price is only the default)
  total: number; // quantity * unitPrice
};

// The terms block reproduced at the bottom of the order-confirmation PDF.
export type QuotationTerms = {
  payment: string;
  delivery: string;
  offerValidity: string;
  vatAit: string;
  stock: string;
  installationCharge: string;
  warranty: string;
};

// Set only once a super admin issues the order confirmation for a quotation.
export type OrderConfirmation = {
  refNumber: string; // e.g. "AIT/MFL/Q-0418/2025" — generated, admin-editable
  subject: string;
  issuedDate: string; // yyyy-mm-dd, admin-editable
  trackingId: string; // one per order, generated server-side
  lines: ConfirmedLine[];
  grandTotal: number;
  terms: QuotationTerms;
  issuedAt: string; // ISO
  // Real delivery progress, advanced by an admin from the Orders screen.
  // Index into DELIVERY_STAGES (app/lib/delivery.ts); absent means stage 0
  // ("Confirmed"). Internal only — there is no customer-facing tracking page.
  deliveryStage?: number;
  deliveryUpdatedAt?: string; // ISO
  // Payment is tracked separately from delivery: an order can be delivered
  // before payment clears, or paid for before it ships.
  paymentStatus?: PaymentStatus;
  paymentReceivedAt?: string; // ISO — when payment was recorded
};

// A submitted quotation, persisted server-side (data/quotations.json) as of
// Phase 3 — previously sessionStorage-only.
export type Quotation = {
  id: string; // crypto.randomUUID()
  items: QuoteItem[];
  total: number;
  details: QuotationDetails;
  status: QuotationStatus; // defaults to "pending"
  confirmation?: OrderConfirmation; // present only while status === "confirmed"
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
