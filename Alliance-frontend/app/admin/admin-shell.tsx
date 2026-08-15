"use client";

import { useState } from "react";
import type { AdminSession } from "@/app/lib/types";
import type { AdminNavCounts, ResolvedNavGroup } from "./nav-config";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";
import { AdminBottomBar } from "./admin-bottom-bar";
import { SubAdminTopnav } from "./sub-admin-topnav";

export function AdminShell({
  groups,
  session,
  counts,
  children,
}: {
  groups: ResolvedNavGroup[];
  session: AdminSession;
  counts: AdminNavCounts;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Design bundle 2d gives the sub-admin a horizontal dark bar instead of the
  // super admin's sidebar rail — their shell is narrow enough that a rail is
  // wasted width. Same role-filtered routes either way.
  if (session.role === "sub") {
    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <SubAdminTopnav groups={groups} session={session} />
        <main className="flex-1 p-4 pb-24 sm:p-6.5 lg:pb-6.5">{children}</main>
        <AdminBottomBar
          groups={groups}
          role={session.role}
          counts={counts}
          onOpenMore={() => setMobileOpen(true)}
        />
        {/* Sub-admin's desktop nav is the top bar, so the rail is only ever a
            drawer here — it must stay fixed at every width. */}
        <AdminSidebar
          groups={groups}
          session={session}
          counts={counts}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          drawerOnly
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <AdminSidebar
        groups={groups}
        session={session}
        counts={counts}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="scrollbar-slim flex min-w-0 flex-1 flex-col overflow-y-auto">
        <AdminTopbar session={session} onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 pb-24 sm:p-6.5 lg:pb-6.5">{children}</main>
      </div>
      <AdminBottomBar
        groups={groups}
        role={session.role}
        counts={counts}
        onOpenMore={() => setMobileOpen(true)}
      />
    </div>
  );
}
