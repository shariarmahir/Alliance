import type { AdminRole } from "@/app/lib/types";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Image as ImageIcon,
  Users,
  ClipboardList,
  FileText,
  Mail,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: AdminRole[];
  enabled: boolean; // false = visible but inert ("coming soon"), later phases enable it
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, roles: ["super"], enabled: true },
  { label: "Products", href: "/admin/products", icon: Package, roles: ["super", "sub"], enabled: true },
  { label: "Stock", href: "/admin/stock", icon: Boxes, roles: ["super", "sub"], enabled: false },
  { label: "Hero Images", href: "/admin/hero-images", icon: ImageIcon, roles: ["super", "sub"], enabled: false },
  { label: "Orders", href: "/admin/orders", icon: ClipboardList, roles: ["super"], enabled: false },
  { label: "Quotations", href: "/admin/quotations", icon: FileText, roles: ["super"], enabled: false },
  { label: "Contact Requests", href: "/admin/contact-requests", icon: MessageSquare, roles: ["super"], enabled: false },
  { label: "Emails", href: "/admin/emails", icon: Mail, roles: ["super"], enabled: false },
  { label: "Employees", href: "/admin/employees", icon: Users, roles: ["super"], enabled: false },
];

export function navItemsForRole(role: AdminRole): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(role));
}
