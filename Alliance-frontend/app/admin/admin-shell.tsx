"use client";

import { useState } from "react";
import type { AdminSession } from "@/app/lib/types";
import type { ResolvedNavGroup } from "./nav-config";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";

export function AdminShell({
  groups,
  session,
  children,
}: {
  groups: ResolvedNavGroup[];
  session: AdminSession;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <AdminSidebar groups={groups} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <AdminTopbar session={session} onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
