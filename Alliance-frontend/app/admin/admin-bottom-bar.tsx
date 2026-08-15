"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/app/lib/utils";
import type { AdminNavCounts, ResolvedNavGroup } from "./nav-config";

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

type Slot = { href: string; label: string };

// The four slots each role gets, in order. A sub-admin's /admin is their task
// desk (super-only in nav-config, so it isn't in their groups) — it's named and
// placed explicitly here rather than fished out of the nav.
const PREFERRED: Record<"super" | "sub", Slot[]> = {
  super: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/quotations", label: "Quotes" },
    { href: "/admin/stock", label: "Stock" },
  ],
  sub: [
    { href: "/admin", label: "Task desk" },
    { href: "/admin/products", label: "Products" },
    { href: "/admin/stock", label: "Stock" },
    { href: "/admin/leave", label: "Leave" },
  ],
};

function slotsForRole(groups: ResolvedNavGroup[], role: "super" | "sub"): Slot[] {
  const reachable = new Set(
    groups.flatMap((g) => g.items).filter((i) => i.enabled).map((i) => i.href)
  );
  // /admin is every role's landing page even when it isn't a nav entry.
  return PREFERRED[role].filter((s) => s.href === "/admin" || reachable.has(s.href));
}

function SlotGlyph({ active, badge }: { active: boolean; badge?: string }) {
  return (
    <span className="relative">
      <span
        className={cn(
          "block size-5 rounded-[5px]",
          active ? "bg-primary" : "border-[1.5px] border-[#c8d0da]"
        )}
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
            <SlotGlyph active={active} badge={badgeFor(slot.href, counts)} />
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
        <span className="flex size-5 flex-col justify-center gap-0.75">
          <span className="h-0.5 w-4.5 bg-[#8a94a6]" />
          <span className="h-0.5 w-4.5 bg-[#8a94a6]" />
          <span className="h-0.5 w-4.5 bg-[#8a94a6]" />
        </span>
        More
      </button>
    </nav>
  );
}
