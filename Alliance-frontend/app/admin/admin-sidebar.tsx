"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsLeft,
  ChevronsRight,
  ShieldCheck,
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
import { cn } from "@/app/lib/utils";
import type { AdminNavItem, AdminNavIcon } from "./nav-config";

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
};

export function AdminSidebar({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-18" : "w-64"
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/20 ring-1 ring-sidebar-primary/40">
          <ShieldCheck className="size-4 text-sidebar-primary" />
        </div>
        {!collapsed && <span className="truncate font-bold tracking-tight">Alliance Admin</span>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
          const Icon = ICONS[item.icon];

          if (!item.enabled) {
            return (
              <div
                key={item.href}
                title="Coming soon"
                className={cn(
                  "flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/35",
                  collapsed && "justify-center px-0"
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
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4.5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex h-12 items-center justify-center gap-2 border-t border-sidebar-border text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      >
        {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
      </button>
    </aside>
  );
}
