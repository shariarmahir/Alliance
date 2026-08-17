"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Image as ImageIcon,
  ClipboardList,
  FileText,
  Mail,
  MessageSquare,
  Users,
  CheckSquare,
  CalendarDays,
  NotebookPen,
  Menu,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import type { AdminNavCounts, AdminNavIcon, ResolvedNavGroup } from "./nav-config";

// Same AdminNavIcon keys nav-config.ts already assigns per route — this is
// the one place they're actually rendered as icons rather than just a
// bookkeeping string.
const ICON: Record<AdminNavIcon, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  products: Package,
  stock: Boxes,
  "hero-images": ImageIcon,
  orders: ClipboardList,
  quotations: FileText,
  "contact-requests": MessageSquare,
  emails: Mail,
  employees: Users,
  tasks: CheckSquare,
  leave: CalendarDays,
  "daily-report": NotebookPen,
};

// Design bundle 2e: on phones the 44px icon rail is replaced by a five-slot
// bottom bar plus the full-height drawer. Slots are the four routes this role
// actually reaches most, plus "More" which opens the drawer — so no navigation
// depends on a cramped rail.
function badgeFor(href: string, counts: AdminNavCounts): string | undefined {
  const n =
    href === "/admin/quotations"
      ? counts.pendingQuotations
      : href === "/admin/orders"
        ? counts.pendingOrders
        : href === "/admin/stock"
          ? counts.lowStock
          : 0;
  return n > 0 ? String(n) : undefined;
}

type Slot = { href: string; label: string; icon: AdminNavIcon };

// The four slots each role gets, in order. A sub-admin's /admin is their task
// desk (super-only in nav-config, so it isn't in their groups) — it's named and
// placed explicitly here rather than fished out of the nav.
const PREFERRED: Record<"super" | "sub", Slot[]> = {
  super: [
    { href: "/admin", label: "Overview", icon: "overview" },
    { href: "/admin/orders", label: "Orders", icon: "orders" },
    { href: "/admin/quotations", label: "Quotes", icon: "quotations" },
    { href: "/admin/stock", label: "Stock", icon: "stock" },
  ],
  sub: [
    { href: "/admin", label: "Task desk", icon: "tasks" },
    { href: "/admin/products", label: "Products", icon: "products" },
    { href: "/admin/stock", label: "Stock", icon: "stock" },
    { href: "/admin/leave", label: "Leave", icon: "leave" },
  ],
};

function slotsForRole(groups: ResolvedNavGroup[], role: "super" | "sub"): Slot[] {
  const reachable = new Set(
    groups.flatMap((g) => g.items).filter((i) => i.enabled).map((i) => i.href)
  );
  // /admin is every role's landing page even when it isn't a nav entry.
  return PREFERRED[role].filter((s) => s.href === "/admin" || reachable.has(s.href));
}

function SlotGlyph({
  icon,
  active,
  badge,
}: {
  icon: AdminNavIcon;
  active: boolean;
  badge?: string;
}) {
  const Icon = ICON[icon];
  return (
    <span className="relative">
      <Icon
        className={cn("size-5", active ? "text-primary" : "text-[#8a94a6]")}
        strokeWidth={active ? 2.25 : 2}
      />
      {badge && (
        <span className="absolute -right-1.5 -top-1 flex h-3.75 min-w-3.75 items-center justify-center rounded-lg bg-accent px-1 font-mono text-[9px] font-bold text-ink">
          {badge}
        </span>
      )}
    </span>
  );
}

export function AdminBottomBar({
  groups,
  role,
  counts,
  onOpenMore,
}: {
  groups: ResolvedNavGroup[];
  role: "super" | "sub";
  counts: AdminNavCounts;
  onOpenMore: () => void;
}) {
  const pathname = usePathname();
  const slots = slotsForRole(groups, role);

  return (
    <nav
      aria-label="Admin sections"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-line bg-white px-1.5 pb-3 pt-2.5 shadow-[0_-6px_20px_rgba(16,25,45,.07)] lg:hidden"
    >
      {slots.map((slot) => {
        const active =
          pathname === slot.href ||
          (slot.href !== "/admin" && pathname.startsWith(`${slot.href}/`));
        return (
          <Link
            key={slot.href}
            href={slot.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1.5 py-1.5 text-[10px]",
              active ? "font-semibold text-primary" : "font-medium text-[#8a94a6]"
            )}
          >
            <SlotGlyph icon={slot.icon} active={active} badge={badgeFor(slot.href, counts)} />
            <span className="max-w-full truncate px-0.5">{slot.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onOpenMore}
        aria-label="Open all sections"
        className="flex flex-col items-center gap-1.5 py-1.5 text-[10px] font-medium text-[#8a94a6]"
      >
        <Menu className="size-5" strokeWidth={2} />
        More
      </button>
    </nav>
  );
}
