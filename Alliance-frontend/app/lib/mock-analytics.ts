// MOCK DATA — replace with real analytics API before production
// Revenue-dollar figures below are stored already converted to BDT (rate
// USD_TO_BDT_RATE in lib/utils.ts), matching the real price data in
// data/products.json/orders.json/quotations.json — formatPrice() only knows
// how to render BDT, not convert into it.
import type { RevenuePoint, OrderRatioSlice, CountryBreakdown, TrafficSource } from "./types";
import { USD_TO_BDT_RATE } from "./utils";

export const kpiStats = {
  totalRevenue: { value: 486_920 * USD_TO_BDT_RATE, deltaPct: 12.4 },
  ordersThisMonth: { value: 214, deltaPct: 8.1 },
  pendingQuotations: { value: 37, deltaPct: -4.6 },
  activeClients: { value: 152, deltaPct: 15.9 },
};

export const revenueWeekly: RevenuePoint[] = [
  { label: "Mon", value: 8200 * USD_TO_BDT_RATE },
  { label: "Tue", value: 10450 * USD_TO_BDT_RATE },
  { label: "Wed", value: 9100 * USD_TO_BDT_RATE },
  { label: "Thu", value: 12800 * USD_TO_BDT_RATE },
  { label: "Fri", value: 15600 * USD_TO_BDT_RATE },
  { label: "Sat", value: 7300 * USD_TO_BDT_RATE },
  { label: "Sun", value: 5400 * USD_TO_BDT_RATE },
];

export const revenueMonthly: RevenuePoint[] = [
  { label: "Jan", value: 32000 * USD_TO_BDT_RATE },
  { label: "Feb", value: 28500 * USD_TO_BDT_RATE },
  { label: "Mar", value: 41200 * USD_TO_BDT_RATE },
  { label: "Apr", value: 38900 * USD_TO_BDT_RATE },
  { label: "May", value: 45600 * USD_TO_BDT_RATE },
  { label: "Jun", value: 52300 * USD_TO_BDT_RATE },
  { label: "Jul", value: 49800 * USD_TO_BDT_RATE },
  { label: "Aug", value: 58100 * USD_TO_BDT_RATE },
];

export const revenueYearly: RevenuePoint[] = [
  { label: "2022", value: 312_000 * USD_TO_BDT_RATE },
  { label: "2023", value: 398_500 * USD_TO_BDT_RATE },
  { label: "2024", value: 441_200 * USD_TO_BDT_RATE },
  { label: "2025", value: 486_920 * USD_TO_BDT_RATE },
];

export const orderRatio: OrderRatioSlice[] = [
  { status: "confirmed", count: 148 },
  { status: "pending", count: 42 },
  { status: "cancelled", count: 24 },
];

export const orderCountWeekly: RevenuePoint[] = [
  { label: "Mon", value: 12 },
  { label: "Tue", value: 18 },
  { label: "Wed", value: 15 },
  { label: "Thu", value: 22 },
  { label: "Fri", value: 27 },
  { label: "Sat", value: 19 },
  { label: "Sun", value: 8 },
];

// Backs the "Open price requests" stat card's sparkline. Trends down across
// the week to match kpiStats.pendingQuotations.deltaPct (-4.6%) — engineers
// clearing the backlog, not it growing.
export const pendingQuotationsWeekly: RevenuePoint[] = [
  { label: "Mon", value: 44 },
  { label: "Tue", value: 41 },
  { label: "Wed", value: 43 },
  { label: "Thu", value: 39 },
  { label: "Fri", value: 35 },
  { label: "Sat", value: 38 },
  { label: "Sun", value: 37 },
];

// Backs the "Active clients" stat card's sparkline. Trends up across the
// week to match kpiStats.activeClients.deltaPct (+15.9%).
export const activeClientsWeekly: RevenuePoint[] = [
  { label: "Mon", value: 131 },
  { label: "Tue", value: 136 },
  { label: "Wed", value: 134 },
  { label: "Thu", value: 141 },
  { label: "Fri", value: 146 },
  { label: "Sat", value: 148 },
  { label: "Sun", value: 152 },
];

export const orderCountMonthly: RevenuePoint[] = [
  { label: "Jan", value: 142 },
  { label: "Feb", value: 128 },
  { label: "Mar", value: 165 },
  { label: "Apr", value: 151 },
  { label: "May", value: 178 },
  { label: "Jun", value: 196 },
  { label: "Jul", value: 184 },
  { label: "Aug", value: 214 },
];

export const orderCountYearly: RevenuePoint[] = [
  { label: "2022", value: 1180 },
  { label: "2023", value: 1540 },
  { label: "2024", value: 1820 },
  { label: "2025", value: 2140 },
];

export const clientsByCountry: CountryBreakdown[] = [
  { country: "Bangladesh", orders: 86 },
  { country: "United Arab Emirates", orders: 41 },
  { country: "Saudi Arabia", orders: 33 },
  { country: "India", orders: 27 },
  { country: "United Kingdom", orders: 19 },
  { country: "Malaysia", orders: 12 },
];

export const trafficSources: TrafficSource[] = [
  { source: "Direct", orders: 74 },
  { source: "Google", orders: 61 },
  { source: "WhatsApp Referral", orders: 38 },
  { source: "Facebook", orders: 25 },
  { source: "Other", orders: 16 },
];
