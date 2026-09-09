"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardActivityRail } from "@/components/dashboard/dashboard-activity-rail";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardHomeFeed } from "@/components/dashboard/dashboard-home-feed";
import { DashboardModuleCard } from "@/components/dashboard/dashboard-module-card";
import { DashboardQuickLaunch } from "@/components/dashboard/dashboard-quick-launch";
import { useDashboardSnapshot } from "@/hooks/use-dashboard-snapshot";
import { getStoredUser, syncStoredUser } from "@/lib/api";
import { getDashboardConfig } from "@/lib/dashboard-config";
import type { AuthUser } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const snapshot = useDashboardSnapshot();

  const config = getDashboardConfig(user);
  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  useEffect(() => {
    setUser(getStoredUser());
    syncStoredUser().then((fresh) => {
      if (fresh) setUser(fresh);
    });
  }, []);

  useEffect(() => {
    for (const mod of config.modules) {
      router.prefetch(mod.href);
    }
  }, [config.modules, router]);

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:space-y-6 md:px-0 md:pb-12 md:pt-2">
      <DashboardHero
        firstName={firstName}
        config={config}
        ready={snapshot.ready}
        appointmentCount={snapshot.appointments.filter((a) => a.status === "confirmed" || a.status === "live" || a.status === "requested").length}
        openCount={snapshot.openCount}
        lastCounsel={snapshot.lastCounsel}
      />
      <DashboardQuickLaunch modules={config.modules} />
      <DashboardHomeFeed snapshot={snapshot} />

      <div className="hidden gap-5 sm:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
        <section className="dash-card-in" aria-labelledby="workspace-heading">
          <div className="mb-4">
            <h2 id="workspace-heading" className="text-[15px] font-semibold tracking-tight">
              Available in this release
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Closed beta ·{" "}
              {config.modules.length}{" "}
              {config.modules.length === 1 ? "feature" : "features"} available in your account
            </p>
          </div>
          {config.modules.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/[0.08] py-16 text-center dark:border-white/[0.10]">
              <p className="text-sm text-muted-foreground">No services available for your account.</p>
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
