"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { logoutAction } from "./login/actions";
import type { AdminSession } from "@/app/lib/types";
import type { AdminNavItem, AdminNavCounts, ResolvedNavGroup } from "./nav-config";

// The design bundle marks nav rows with small square glyphs rather than an
// icon set: the active row gets a solid tile, inactive rows an outlined one.
function NavGlyph({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "size-4 shrink-0 rounded",
        active ? "bg-[#3ea5e8]" : "border-[1.5px] border-white/50"
      )}
    />
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}

type NavMeta = { count?: string; pill?: string; badge?: string };

// Trailing meta per route, derived from live data (the design's counts,
// "12 LOW" pill and Orders/Quotations badges). Zero renders nothing — an
// empty queue shouldn't wear a badge.
function metaFor(href: string, counts: AdminNavCounts): NavMeta | undefined {
  switch (href) {
    case "/admin/products":
      return counts.products > 0 ? { count: counts.products.toLocaleString() } : undefined;
    case "/admin/stock":
      return counts.lowStock > 0 ? { pill: `${counts.lowStock} LOW` } : undefined;
    case "/admin/orders":
      return counts.pendingOrders > 0 ? { badge: String(counts.pendingOrders) } : undefined;
    case "/admin/quotations":
      return counts.pendingQuotations > 0
        ? { badge: String(counts.pendingQuotations) }
        : undefined;
    case "/admin/contact-requests":
      return counts.openContactRequests > 0
        ? { badge: String(counts.openContactRequests) }
        : undefined;
    default:
      return undefined;
  }
}

function NavLink({
  item,
  counts,
  onNavigate,
}: {
  item: AdminNavItem;
  counts: AdminNavCounts;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const meta = metaFor(item.href, counts);

  if (!item.enabled) {
    return (
      <div
        title="Coming soon"
        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3.5 py-2.5 text-[13px] text-white/30"
      >
        <NavGlyph active={false} />
        {item.label}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg py-2.5 pr-3 text-[13px] transition-colors",
        // Active rows carry a 3px accent rule; the padding compensates so the
        // label doesn't shift by 3px when a row becomes active.
        active
          ? "border-l-[3px] border-accent bg-white/8 pl-2.75 font-semibold text-white"
          : "pl-3.5 font-medium text-white/72 hover:bg-white/5 hover:text-white"
      )}
    >
      <NavGlyph active={active} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {meta?.count && (
        <span className="shrink-0 font-mono text-[10.5px] text-white/35">{meta.count}</span>
      )}
      {meta?.pill && (
        <span className="shrink-0 rounded bg-accent/18 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
          {meta.pill}
        </span>
      )}
      {meta?.badge && (
        <span className="shrink-0 rounded-[10px] bg-accent px-2 py-0.5 font-mono text-[10px] font-bold text-ink">
          {meta.badge}
        </span>
      )}
    </Link>
  );
}

// Groups are static section labels, not toggles — every route is always
// visible. A group header was previously a button that looked identical to a
// nav row but wasn't a destination, which read as a broken link.
function NavGroup({
  group,
  counts,
  onNavigate,
}: {
  group: ResolvedNavGroup;
  counts: AdminNavCounts;
  onNavigate?: () => void;
}) {
  // A single-item group (Overview, Orders, Quotations) is just its own row —
  // a section heading above one identical row is noise.
  if (group.items.length === 1) {
    return <NavLink item={group.items[0]} counts={counts} onNavigate={onNavigate} />;
  }

  return (
    <div className="pt-3 first:pt-0">
      <p className="mono-label px-3.5 pb-1.5 text-[9.5px] text-white/35">{group.label}</p>
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <NavLink key={item.href} item={item} counts={counts} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function AdminSidebar({
  groups,
  session,
  counts,
  mobileOpen,
  onCloseMobile,
  // Super admin: this rail IS the desktop layout, so at lg it becomes a static
  // in-flow column. Sub admin: their desktop nav is the horizontal top bar, so
  // the rail stays a drawer at every width — without this it would un-fix at lg
  // and drop into the page flow at the bottom.
  drawerOnly = false,
}: {
  groups: ResolvedNavGroup[];
  session: AdminSession;
  counts: AdminNavCounts;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  drawerOnly?: boolean;
}) {
  const superAdmin = session.role === "super";

  return (
    <>
      {mobileOpen && (
        <div
          className={cn(
            "fixed inset-0 z-40 bg-ink/60",
            !drawerOnly && "lg:hidden"
          )}
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[300px] max-w-[86vw] shrink-0 -translate-x-full flex-col bg-[#0d1626] transition-transform duration-200",
          !drawerOnly && "lg:static lg:z-auto lg:h-full lg:w-[248px] lg:max-w-none lg:translate-x-0",
          mobileOpen && "translate-x-0"
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-4.5 pb-5 pt-4.5">
          <span className="text-[19px] font-bold leading-none text-white">
            AutoLink<span className="text-accent">.</span>
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className={cn(
              "ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white",
              !drawerOnly && "lg:hidden"
            )}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Identity card belongs to the drawer presentation (design 2e). The
            desktop rail doesn't need it — the topbar already carries the pill. */}
        <div
          className={cn(
            "mx-3 mt-4 flex items-center gap-3 rounded-[10px] border border-white/10 bg-white/[0.06] p-3.5",
            !drawerOnly && "lg:hidden"
          )}
        >
          <span className="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-[#3ea5e8]/20 text-[13px] font-bold text-[#3ea5e8]">
            {initials(session.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold text-white">
              {session.name}
            </span>
            <span className="mono-label text-[10px] text-accent">
              {superAdmin ? "SUPER ADMIN · FULL ACCESS" : "SUB ADMIN"}
            </span>
          </span>
        </div>

        {/* 48px touch targets in drawer presentation per the design; the
            desktop rail keeps its tighter rhythm. */}
        <nav
          className={cn(
            "scrollbar-dark flex-1 space-y-0.5 overflow-y-auto px-3 py-4",
            drawerOnly
              ? "[&_a]:min-h-12 [&_a]:text-sm [&_button]:min-h-12 [&_button]:text-sm"
              : "max-lg:[&_a]:min-h-12 max-lg:[&_a]:text-sm max-lg:[&_button]:min-h-12 max-lg:[&_button]:text-sm"
          )}
        >
          {groups.map((group) => (
            <NavGroup
              key={group.label}
              group={group}
              counts={counts}
              onNavigate={onCloseMobile}
            />
          ))}
        </nav>

        {superAdmin && (
          <div className="mx-3 mb-4 rounded-[9px] border border-white/[0.09] bg-white/5 p-3.5 max-lg:hidden">
            <p className="mono-label mb-1 text-[10px] text-accent">CONTACT REQUESTS</p>
            <p className="mb-2.5 text-[11.5px] leading-[1.55] text-white/60">
              {counts.openContactRequests > 0
                ? `${counts.openContactRequests} unanswered from the storefront`
                : "No unanswered enquiries"}
            </p>
            <Link
              href="/admin/contact-requests"
              onClick={onCloseMobile}
              className="flex items-center justify-center rounded-[7px] border border-white/20 bg-white/[0.12] py-2.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-white/20"
            >
              Open inbox
            </Link>
          </div>
        )}

        <form action={logoutAction} className={cn("mx-3 mb-4", !drawerOnly && "lg:hidden")}>
          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-[9px] border border-white/[0.18] bg-white/10 py-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/20"
          >
            Sign out
          </button>
        </form>
      </aside>
    </>
  );
}
