import type { AdminRole } from "@/app/lib/types";

export type AdminNavIcon =
  | "overview"
  | "products"
  | "stock"
  | "hero-images"
  | "orders"
  | "quotations"
  | "contact-requests"
  | "emails"
  | "employees"
  | "tasks"
  | "leave"
  | "daily-report";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: AdminNavIcon;
  roles: AdminRole[];
  enabled: boolean; // false = visible but inert ("coming soon"), later phases enable it
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Overview", href: "/admin", icon: "overview", roles: ["super"], enabled: true },
  { label: "Products", href: "/admin/products", icon: "products", roles: ["super", "sub"], enabled: true },
  { label: "Stock", href: "/admin/stock", icon: "stock", roles: ["super", "sub"], enabled: true },
  { label: "Hero Images", href: "/admin/hero-images", icon: "hero-images", roles: ["super", "sub"], enabled: true },
  { label: "Orders", href: "/admin/orders", icon: "orders", roles: ["super"], enabled: true },
  { label: "Quotations", href: "/admin/quotations", icon: "quotations", roles: ["super"], enabled: true },
  { label: "Contact Requests", href: "/admin/contact-requests", icon: "contact-requests", roles: ["super"], enabled: true },
  { label: "Emails", href: "/admin/emails", icon: "emails", roles: ["super"], enabled: true },
  { label: "Employees", href: "/admin/employees", icon: "employees", roles: ["super"], enabled: true },
  { label: "Task Desk", href: "/admin/tasks", icon: "tasks", roles: ["super", "sub"], enabled: true },
  { label: "Leave Requests", href: "/admin/leave", icon: "leave", roles: ["super", "sub"], enabled: true },
  { label: "Daily Report", href: "/admin/daily-report", icon: "daily-report", roles: ["super", "sub"], enabled: true },
];

export function navItemsForRole(role: AdminRole): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(role));
}
