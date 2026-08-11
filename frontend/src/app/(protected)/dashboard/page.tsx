"use client";

import { useEffect, useState } from "react";

import { DashboardFeaturedCard } from "@/components/dashboard/dashboard-featured-card";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardModuleCard } from "@/components/dashboard/dashboard-module-card";
import { DashboardQuickLaunch } from "@/components/dashboard/dashboard-quick-launch";
import { DashboardTrustBar } from "@/components/dashboard/dashboard-trust-bar";
import { getStoredUser, syncStoredUser } from "@/lib/api";
import { getDashboardConfig } from "@/lib/dashboard-config";
import type { AuthUser } from "@/lib/types";

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
    syncStoredUser().then((fresh) => {
      if (fresh) setUser(fresh);
    });
  }, []);

  const config = getDashboardConfig(user);
  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  const featured = config.modules.find((m) => m.href === "/mera-vakil");
  const others = config.modules.filter((m) => m.href !== "/mera-vakil");

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-7 px-0 pb-6 sm:space-y-8 sm:px-0 md:pb-10 md:pt-2">
      <div className="px-0 sm:px-0">
        <DashboardHero firstName={firstName} config={config} />
      </div>

      <div className="space-y-7 px-5 sm:space-y-8 md:px-0">
        <DashboardQuickLaunch modules={config.modules} />

        <section aria-labelledby="workspaces-heading">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2
              id="workspaces-heading"
              className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Workspaces
            </h2>
            <p className="text-[12px] text-muted-foreground/70">
              {config.modules.length} available
            </p>
          </div>

          {config.modules.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/[0.08] py-16 text-center dark:border-white/[0.10]">
              <p className="text-sm text-muted-foreground">
                No workspaces available for your account.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
              {featured && <DashboardFeaturedCard mod={featured} />}
              {others.map((mod, index) => (
                <DashboardModuleCard key={mod.href} mod={mod} index={index} />
              ))}
            </div>
          )}
        </section>

        <DashboardTrustBar />
      </div>
    </div>
  );
}
