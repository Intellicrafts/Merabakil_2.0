"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { DashboardActivityRail } from "@/components/dashboard/dashboard-activity-rail";
import { DashboardAskBar } from "@/components/dashboard/dashboard-ask-bar";
import { DashboardContinueCard } from "@/components/dashboard/dashboard-continue-card";
import { DashboardFeaturedCard } from "@/components/dashboard/dashboard-featured-card";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardModuleCard } from "@/components/dashboard/dashboard-module-card";
import { DashboardQuickLaunch } from "@/components/dashboard/dashboard-quick-launch";
import { DashboardTrustBar } from "@/components/dashboard/dashboard-trust-bar";
import { Input } from "@/components/ui/input";
import { useDashboardSnapshot } from "@/hooks/use-dashboard-snapshot";
import { getStoredUser, syncStoredUser } from "@/lib/api";
import { getDashboardConfig } from "@/lib/dashboard-config";
import { getModuleMeta } from "@/lib/dashboard-meta";
import type { AuthUser } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [tag, setTag] = useState("all");
  const snapshot = useDashboardSnapshot();

  useEffect(() => {
    setUser(getStoredUser());
    syncStoredUser().then((fresh) => {
      if (fresh) setUser(fresh);
    });
  }, []);

  const config = getDashboardConfig(user);
  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  const tags = useMemo(() => {
    const unique = new Set(config.modules.map((m) => getModuleMeta(m.href).tag));
    return ["all", ...unique];
  }, [config.modules]);

  const filtered = useMemo(() => {
    const q = workspaceQuery.trim().toLowerCase();
    return config.modules.filter((mod) => {
      const meta = getModuleMeta(mod.href);
      if (tag !== "all" && meta.tag !== tag) return false;
      if (!q) return true;
      return (
        mod.title.toLowerCase().includes(q) ||
        mod.description.toLowerCase().includes(q) ||
        meta.tag.toLowerCase().includes(q) ||
        meta.features.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [config.modules, workspaceQuery, tag]);

  const isUnfiltered = tag === "all" && !workspaceQuery.trim();
  const featured = isUnfiltered ? filtered.find((m) => m.href === "/mera-vakil") : undefined;
  const others = featured ? filtered.filter((m) => m.href !== "/mera-vakil") : filtered;

  const kpis = [
    { label: "Counsel sessions", value: String(snapshot.conversations.length) },
    { label: "Open matters", value: String(snapshot.openCount) },
    { label: "Pinned", value: String(snapshot.pinnedCount) },
    { label: "Modules", value: String(config.modules.length) },
  ];

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-0 pb-6 sm:space-y-7 md:pb-10 md:pt-2">
      <DashboardHero firstName={firstName} config={config} kpis={kpis} ready={snapshot.ready} />

      <div className="space-y-6 px-5 sm:space-y-7 md:px-0">
        <DashboardAskBar />
        <DashboardContinueCard lastCounsel={snapshot.lastCounsel} ready={snapshot.ready} />
        <DashboardQuickLaunch modules={config.modules} variant="mobile" />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          <section aria-labelledby="workspaces-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="workspaces-heading"
                  className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Workspaces
                </h2>
                <p className="mt-1 text-[12px] text-muted-foreground/70">
                  {filtered.length} of {config.modules.length} available
                </p>
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={workspaceQuery}
                  onChange={(e) => setWorkspaceQuery(e.target.value)}
                  placeholder="Filter workspaces"
                  aria-label="Filter workspaces"
                  className="h-9 rounded-full border-black/[0.07] bg-white/70 pl-8 text-[13px] dark:border-white/[0.10] dark:bg-white/[0.04]"
                />
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Workspace tags">
              {tags.map((item) => {
                const selected = tag === item;
                return (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTag(item)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35",
                      selected
                        ? "border-slate-900/20 bg-slate-900 text-white dark:border-white/20 dark:bg-white dark:text-slate-900"
                        : "border-black/[0.06] bg-white/60 text-muted-foreground hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.04]",
                    )}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            <DashboardQuickLaunch modules={config.modules} variant="desktop" />

            {config.modules.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-black/[0.08] py-16 text-center dark:border-white/[0.10]">
                <p className="text-sm text-muted-foreground">
                  No workspaces available for your account.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-black/[0.08] py-14 text-center dark:border-white/[0.10]">
                <p className="text-sm text-muted-foreground">No workspaces match.</p>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceQuery("");
                    setTag("all");
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/70 px-3 py-1.5 text-[12px] font-medium hover:bg-white dark:border-white/[0.10] dark:bg-white/[0.05]"
                >
                  <X className="h-3 w-3" />
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="dash-workspace-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 lg:gap-4">
                {featured && <DashboardFeaturedCard mod={featured} />}
                {others.map((mod, index) => (
                  <DashboardModuleCard key={mod.href} mod={mod} index={index} />
                ))}
              </div>
            )}
          </section>

          <DashboardActivityRail
            recent={snapshot.recent}
            upcoming={snapshot.upcoming}
            ready={snapshot.ready}
          />
        </div>

        <DashboardTrustBar />
      </div>
    </div>
  );
}
