"use client";

import { useEffect, useState } from "react";

import { DashboardActivityRail } from "@/components/dashboard/dashboard-activity-rail";
import { DashboardContinueCard } from "@/components/dashboard/dashboard-continue-card";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardModuleCard } from "@/components/dashboard/dashboard-module-card";
import { DashboardQuickLaunch } from "@/components/dashboard/dashboard-quick-launch";
import { useDashboardSnapshot } from "@/hooks/use-dashboard-snapshot";
import { getStoredUser, syncStoredUser } from "@/lib/api";
import { getDashboardConfig } from "@/lib/dashboard-config";
import type { AuthUser } from "@/lib/types";

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const snapshot = useDashboardSnapshot();

  useEffect(() => {
    setUser(getStoredUser());
    syncStoredUser().then((fresh) => {
      if (fresh) setUser(fresh);
    });
  }, []);

  const config = getDashboardConfig(user);
  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:space-y-6 md:px-0 md:pb-12 md:pt-2">
      <DashboardHero
        firstName={firstName}
        config={config}
        ready={snapshot.ready}
        conversationCount={snapshot.conversations.length}
        openCount={snapshot.openCount}
      />
      <DashboardContinueCard lastCounsel={snapshot.lastCounsel} ready={snapshot.ready} />
      <DashboardQuickLaunch modules={config.modules} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <section className="dash-card-in hidden md:block" aria-labelledby="tools-heading" style={{ animationDelay: "140ms" }}>
          <h2 id="tools-heading" className="mb-3 text-[15px] font-semibold tracking-tight">
            Tools
          </h2>
          {config.modules.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/[0.08] py-16 text-center dark:border-white/[0.10]">
              <p className="text-sm text-muted-foreground">No tools available for your account.</p>
            </div>
          ) : (
            <div className="dash-workspace-grid grid gap-3 sm:grid-cols-2 lg:gap-3.5">
              {config.modules.map((mod) => (
                <DashboardModuleCard key={mod.href} mod={mod} />
              ))}
            </div>
          )}
        </section>

        <DashboardActivityRail
          recent={snapshot.recent}
          upcoming={snapshot.upcoming}
          appointments={snapshot.appointments}
          documents={snapshot.documents}
          ready={snapshot.ready}
        />
      </div>
    </div>
  );
}
