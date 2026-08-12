"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  LayoutDashboard,
  Package,
  Boxes,
  Image as ImageIcon,
  Users,
  ClipboardList,
  FileText,
  Mail,
  MessageSquare,
  ListChecks,
  CalendarDays,
  NotebookPen,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import type { AdminNavItem, AdminNavIcon, ResolvedNavGroup } from "./nav-config";

const ICONS: Record<AdminNavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  products: Package,
  stock: Boxes,
  "hero-images": ImageIcon,
  orders: ClipboardList,
  quotations: FileText,
  "contact-requests": MessageSquare,
  emails: Mail,
  employees: Users,
  tasks: ListChecks,
  leave: CalendarDays,
  "daily-report": NotebookPen,
};

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}

function NavLink({
  item,
  collapsed,
  indent,
  onNavigate,
}: {
  item: AdminNavItem;
  collapsed: boolean;
  indent?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = ICONS[item.icon];

  if (!item.enabled) {
    return (
      <div
        title="Coming soon"
        className={cn(
          "flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/35",
          collapsed && "justify-center px-0",
          indent && !collapsed && "pl-4"
        )}
      >
        <Icon className="size-4.5 shrink-0" />
        {!collapsed && (
          <span className="flex flex-1 items-center justify-between">
            {item.label}
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              Soon
            </span>
          </span>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        collapsed && "justify-center px-0",
        indent && !collapsed && "pl-4",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-sidebar-foreground/70 hover:translate-x-0.5 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      {active && (
        <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-linear-to-b from-sidebar-primary to-primary" />
      )}
      <Icon className={cn("size-4.5 shrink-0 transition-transform duration-200", active && "text-sidebar-primary")} />
      {!collapsed && item.label}
    </Link>
  );
}

function NavGroup({
  group,
  collapsed,
  onNavigate,
}: {
  group: ResolvedNavGroup;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groupActive = group.items.some((item) => isActive(pathname, item.href));
  const [open, setOpen] = useState(groupActive);

  // Single-item groups (e.g. Overview, Orders, Quotations) render as a
  // direct link — no expand/collapse chrome needed.
  if (group.items.length === 1) {
    return <NavLink item={group.items[0]} collapsed={collapsed} onNavigate={onNavigate} />;
  }

  const Icon = ICONS[group.icon];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
          collapsed && "justify-center px-0",
          groupActive
            ? "text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className={cn("size-4.5 shrink-0", groupActive && "text-sidebar-primary")} />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{group.label}</span>
            <ChevronDown className={cn("size-3.5 shrink-0 transition-transform duration-200", open && "rotate-180")} />
          </>
        )}
      </button>
      {!collapsed && (
        <div
          className={cn(
            "grid overflow-hidden transition-all duration-200 ease-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="min-h-0 space-y-1 pt-1">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} indent onNavigate={onNavigate} />
            ))}
          </div>
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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:translate-x-0 lg:transition-[width]",
          mobileOpen && "translate-x-0",
          collapsed ? "lg:w-18" : "lg:w-64"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <Image
            src="/logo-mark.png"
            alt="AutoLink"
            width={32}
            height={32}
            className="size-8 shrink-0 object-contain"
          />
          {!collapsed && (
            <div className="flex-1 truncate leading-none">
              <div className="truncate text-base font-extrabold tracking-tight text-primary">
                AutoLink<span className="text-sidebar-primary">.</span>
              </div>
              <div className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/60">
                Integrated Technologies
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <NavGroup key={group.label} group={group} collapsed={collapsed} onNavigate={onCloseMobile} />
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="hidden h-12 items-center justify-center gap-2 border-t border-sidebar-border text-sm text-sidebar-foreground/60 transition-colors duration-200 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground lg:flex"
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
      </aside>
    </>
  );
}
