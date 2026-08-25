import type { AccessArea, AdminRole } from "@/app/lib/types";

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
  // Present only for items a "sub" role can't see by default — visible to a
  // sub-admin only once this AccessArea is granted on their employee record.
  // "super" always sees these regardless of this field.
  requiresArea?: AccessArea;
};

// Flat source of truth for every route + its RBAC roles. Unchanged from
// Phase 1-4 — DO NOT rename/remove hrefs here without also updating
// proxy.ts's SUB_ADMIN_ALLOWED_PREFIXES/EXACT to match.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Overview", href: "/admin", icon: "overview", roles: ["super"], enabled: true },
  { label: "Products", href: "/admin/products", icon: "products", roles: ["super", "sub"], enabled: true },
  { label: "Stock", href: "/admin/stock", icon: "stock", roles: ["super", "sub"], enabled: true },
  { label: "Hero Images", href: "/admin/hero-images", icon: "hero-images", roles: ["super", "sub"], enabled: true },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: "orders",
    roles: ["super", "sub"],
    enabled: true,
    requiresArea: "orders",
  },
  {
    label: "Quotations",
    href: "/admin/quotations",
    icon: "quotations",
    roles: ["super", "sub"],
    enabled: true,
    requiresArea: "quotations",
  },
  // Both are raised against a confirmed order, so they sit behind the same
  // grant as Orders rather than needing one of their own.
  {
    label: "Invoices",
    href: "/admin/invoices",
    icon: "orders",
    roles: ["super", "sub"],
    enabled: true,
    requiresArea: "orders",
  },
  {
    label: "Challans",
    href: "/admin/challans",
    icon: "orders",
    roles: ["super", "sub"],
    enabled: true,
    requiresArea: "orders",
  },
  {
    label: "Contact Requests",
    href: "/admin/contact-requests",
    icon: "contact-requests",
    roles: ["super", "sub"],
    enabled: true,
    requiresArea: "contact-requests",
  },
  {
    label: "Emails",
    href: "/admin/emails",
    icon: "emails",
    roles: ["super", "sub"],
    enabled: true,
    requiresArea: "emails",
  },
  { label: "Employees", href: "/admin/employees", icon: "employees", roles: ["super"], enabled: true },
  { label: "Task Desk", href: "/admin/tasks", icon: "tasks", roles: ["super", "sub"], enabled: true },
  { label: "Leave Requests", href: "/admin/leave", icon: "leave", roles: ["super", "sub"], enabled: true },
  { label: "Daily Report", href: "/admin/daily-report", icon: "daily-report", roles: ["super", "sub"], enabled: true },
];

export function navItemsForRole(role: AdminRole, accessOptions: AccessArea[] = []): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (role === "super") return true;
    if (item.requiresArea && !accessOptions.includes(item.requiresArea)) return false;
    return true;
  });
}

// Presentation layer only: groups the flat ADMIN_NAV_ITEMS (by href) into the
// fewer top-level sidebar sections from the redesign. No route paths change —
// this only changes how existing items are visually organized/collapsed.
// A group with a single href behaves as a direct link (no expand/collapse);
// a group with multiple hrefs renders as a collapsible section whose visible
// children are still filtered by the same per-item `roles` as before, so
// RBAC is enforced identically to the old flat list.
export type AdminNavGroup = {
  label: string;
  icon: AdminNavIcon;
  hrefs: string[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { label: "Overview", icon: "overview", hrefs: ["/admin"] },
  { label: "Products & Stock", icon: "products", hrefs: ["/admin/products", "/admin/stock"] },
  {
    label: "Orders & Documents",
    icon: "orders",
    hrefs: ["/admin/orders", "/admin/invoices", "/admin/challans"],
  },
  { label: "Quotations", icon: "quotations", hrefs: ["/admin/quotations"] },
  {
    label: "Employees & Leave",
    icon: "employees",
    hrefs: ["/admin/employees", "/admin/tasks", "/admin/leave", "/admin/daily-report"],
  },
  {
    label: "Hero & Settings",
    icon: "hero-images",
    hrefs: ["/admin/hero-images", "/admin/contact-requests", "/admin/emails"],
  },
];

export type ResolvedNavGroup = {
  label: string;
  icon: AdminNavIcon;
  items: AdminNavItem[];
};

// Live counts rendered beside nav rows. Read server-side in the dashboard
// layout so the rail agrees with the screens instead of showing mock figures.
export type AdminNavCounts = {
  products: number;
  lowStock: number;
  pendingOrders: number;
  pendingQuotations: number;
  openContactRequests: number;
};

// Resolves the presentation groups against the role-filtered flat item list,
// dropping any group that ends up with zero visible items for this role (a
// role can never see an empty section) and preserving ADMIN_NAV_ITEMS order
// within each group.
export function navGroupsForRole(role: AdminRole, accessOptions: AccessArea[] = []): ResolvedNavGroup[] {
  const visible = navItemsForRole(role, accessOptions);
  const byHref = new Map(visible.map((item) => [item.href, item]));

  return ADMIN_NAV_GROUPS.map((group) => ({
    label: group.label,
    icon: group.icon,
    items: group.hrefs.map((href) => byHref.get(href)).filter((item): item is AdminNavItem => Boolean(item)),
  })).filter((group) => group.items.length > 0);
}
