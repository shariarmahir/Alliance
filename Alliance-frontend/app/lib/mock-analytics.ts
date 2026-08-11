// MOCK DATA — replace with real analytics API before production
import type { RevenuePoint, OrderRatioSlice, CountryBreakdown, TrafficSource } from "./types";

export const kpiStats = {
  totalRevenue: { value: 486_920, deltaPct: 12.4 },
  ordersThisMonth: { value: 214, deltaPct: 8.1 },
  pendingQuotations: { value: 37, deltaPct: -4.6 },
  activeClients: { value: 152, deltaPct: 15.9 },
};

export const revenueWeekly: RevenuePoint[] = [
  { label: "Mon", value: 8200 },
  { label: "Tue", value: 10450 },
  { label: "Wed", value: 9100 },
  { label: "Thu", value: 12800 },
  { label: "Fri", value: 15600 },
  { label: "Sat", value: 7300 },
  { label: "Sun", value: 5400 },
];

export const revenueMonthly: RevenuePoint[] = [
  { label: "Jan", value: 32000 },
  { label: "Feb", value: 28500 },
  { label: "Mar", value: 41200 },
  { label: "Apr", value: 38900 },
  { label: "May", value: 45600 },
  { label: "Jun", value: 52300 },
  { label: "Jul", value: 49800 },
  { label: "Aug", value: 58100 },
];

export const revenueYearly: RevenuePoint[] = [
  { label: "2022", value: 312_000 },
  { label: "2023", value: 398_500 },
  { label: "2024", value: 441_200 },
  { label: "2025", value: 486_920 },
];

export const orderRatio: OrderRatioSlice[] = [
  { status: "confirmed", count: 148 },
  { status: "pending", count: 42 },
  { status: "cancelled", count: 24 },
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
