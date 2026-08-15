"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/app/lib/utils";
import type { AdminNavItem, ResolvedNavGroup } from "./nav-config";

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

// Per-route trailing meta from the design (counts, "12 LOW" pills). Values are
// mock, matching the rest of the admin's mock-analytics layer.
const ITEM_META: Record<string, { count?: string; pill?: string }> = {
  "/admin/products": { count: "1,284" },
  "/admin/stock": { pill: "12 LOW" },
};

const GROUP_BADGE: Record<string, string> = {
  Orders: "9",
  Quotations: "37",
};

function NavLink({
  item,
  indent,
  onNavigate,
}: {
  item: AdminNavItem;
  indent?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const meta = ITEM_META[item.href];

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

  // Child rows sit deeper in the rail and drop the glyph, per the design.
  if (indent) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center justify-between rounded-lg py-2.5 pl-10 pr-3.5 text-[12.5px] transition-colors",
          active ? "text-white" : "text-white/60 hover:text-white"
        )}
      >
        {item.label}
        {meta?.count && <span className="font-mono text-[10.5px] text-white/35">{meta.count}</span>}
        {meta?.pill && (
          <span className="rounded bg-accent/[0.18] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
            {meta.pill}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[13px] transition-colors",
        active
          ? "border-l-[3px] border-accent bg-white/[0.08] font-semibold text-white"
          : "font-medium text-white/[0.72] hover:bg-white/5 hover:text-white"
      )}
    >
      <NavGlyph active={active} />
      {item.label}
    </Link>
  );
}

function NavGroup({ group, onNavigate }: { group: ResolvedNavGroup; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groupActive = group.items.some((item) => isActive(pathname, item.href));
  const [open, setOpen] = useState(groupActive);
  const badge = GROUP_BADGE[group.label];

  if (group.items.length === 1) {
    return (
      <div className="relative">
        <NavLink item={group.items[0]} onNavigate={onNavigate} />
        {badge && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded-[10px] bg-accent px-2 py-0.5 font-mono text-[10px] font-bold text-ink">
            {badge}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-[13px] transition-colors",
          groupActive
            ? "font-semibold text-white"
            : "font-medium text-white/[0.72] hover:bg-white/5 hover:text-white"
        )}
      >
        <span className="flex items-center gap-3">
          <NavGlyph active={groupActive} />
          {group.label}
        </span>
        <span className="text-[11px] text-white/40">{open ? "⌄" : "›"}</span>
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} indent onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminSidebar({
  groups,
  mobileOpen,
  onCloseMobile,
}: {
  groups: ResolvedNavGroup[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/60 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 -translate-x-full flex-col bg-[#0d1626] transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:w-[248px] lg:translate-x-0",
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
            className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <NavGroup key={group.label} group={group} onNavigate={onCloseMobile} />
          ))}
        </nav>

        <div className="mx-3 mb-4 rounded-[9px] border border-white/[0.09] bg-white/5 p-3.5">
          <p className="mono-label mb-1 text-[10px] text-accent">CONTACT REQUESTS</p>
          <p className="mb-2.5 text-[11.5px] leading-[1.55] text-white/60">
            Unanswered enquiries from the storefront
          </p>
          <Link
            href="/admin/contact-requests"
            onClick={onCloseMobile}
            className="flex items-center justify-center rounded-[7px] border border-white/20 bg-white/[0.12] py-2.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-white/20"
          >
            Open inbox
          </Link>
        </div>
      </aside>
    </>
  );
}
