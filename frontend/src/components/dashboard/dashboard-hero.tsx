"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";

import { DashboardAskBar } from "@/components/dashboard/dashboard-ask-bar";
import { DashboardHeroVisual } from "@/components/dashboard/dashboard-hero-visual";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardConfig } from "@/lib/dashboard-config";
import { getHeroTheme } from "@/lib/dashboard-config";
import type { ChatConversation } from "@/lib/conversations";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function getGreetingKey(): "dashboard.goodMorning" | "dashboard.goodAfternoon" | "dashboard.goodEvening" {
  const h = new Date().getHours();
  if (h < 12) return "dashboard.goodMorning";
  if (h < 17) return "dashboard.goodAfternoon";
  return "dashboard.goodEvening";
}

function formatDate(): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function formatDateShort(): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date());
}

function contextLine(openCount: number, appointmentCount: number, t: (key: string) => string): string {
  const parts: string[] = [];
  if (openCount > 0) {
    parts.push(`${openCount} ${openCount === 1 ? t("dashboard.openMatter") : t("dashboard.openMatters")}`);
  }
  if (appointmentCount > 0) {
    parts.push(`${appointmentCount} ${appointmentCount === 1 ? t("dashboard.appointment") : t("dashboard.appointments")}`);
  }
  return parts.join(" · ");
}

function roleBadgeKey(role: DashboardConfig["role"]): string {
  switch (role) {
    case "advocate":
      return "dashboard.roleAdvocate";
    case "citizen":
      return "dashboard.roleCitizen";
    case "admin":
      return "dashboard.roleAdmin";
    case "enterprise":
      return "dashboard.roleEnterprise";
    case "law_firm":
      return "dashboard.roleLawFirm";
    default:
      return "dashboard.roleCitizen";
  }
}

export function DashboardHero({
  firstName,
  config,
  ready,
  appointmentCount,
  openCount,
  lastCounsel,
}: {
  firstName: string;
  config: DashboardConfig;
  ready: boolean;
  appointmentCount: number;
  openCount: number;
  lastCounsel: ChatConversation | null;
}) {
  const { t } = useTranslation();
  const theme = getHeroTheme(config.role);
  const context = ready ? contextLine(openCount, appointmentCount, t) : "";
  const accentClass =
    theme.accent === "citizen"
      ? "dash-hero--citizen"
      : theme.accent === "advocate"
        ? "dash-hero--advocate"
        : "dash-hero--default";

  return (
    <header
      className={cn(
        "dash-hero-shell dash-card-in relative min-w-0 overflow-hidden",
        accentClass,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px dash-shimmer-line" />
      <div className="pointer-events-none absolute -right-16 -top-24 hidden h-64 w-64 rounded-full dash-hero-orb dash-hero-glow sm:block" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 hidden h-52 w-52 rounded-full dash-hero-orb dash-hero-glow opacity-70 sm:block" />

      <div className="relative grid min-w-0 items-center gap-5 overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,380px)] lg:gap-10">
        <DashboardHeroVisual className="order-1 min-w-0 dash-hero-stagger-2 lg:order-2 lg:col-start-2 lg:row-start-1" />

        <div className="order-2 min-w-0 space-y-4 sm:space-y-5 lg:order-1 lg:col-start-1">
          <div className="dash-hero-stagger-1 space-y-1.5 sm:space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] text-muted-foreground sm:text-[13px]">
                <span className="sm:hidden">{formatDateShort()}</span>
                <span className="hidden sm:inline">{formatDate()}</span>
              </p>
              <span className="hidden items-center rounded-full border border-black/[0.08] bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground dark:border-white/[0.10] dark:bg-white/[0.05] sm:inline-flex">
                {t("dashboard.openBeta")}
              </span>
              <span className="dash-hero-role-badge">{t(roleBadgeKey(config.role))}</span>
            </div>

            <h1 className="text-[1.55rem] font-semibold leading-[1.12] tracking-tight sm:text-[2.2rem] md:text-[2.4rem]">
              {t(getGreetingKey())},{" "}
              <span className="dash-hero-name">{firstName}</span>
            </h1>
            <p className="max-w-lg text-[13px] leading-relaxed text-muted-foreground sm:hidden">
              {theme.mobileTagline}
            </p>
            <p className="hidden max-w-lg text-[13px] leading-relaxed text-muted-foreground sm:block sm:text-[15px]">
              <span className="font-medium text-foreground/90">{config.headline}</span>
              {" — "}
              {config.subtitle}
            </p>

            {ready ? (
              context ? (
                <p className="text-[12px] text-muted-foreground/90 sm:text-[13px]">
                  <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2.5 py-1 font-medium dark:bg-white/[0.06]">
                    {context}
                  </span>
                </p>
              ) : null
            ) : (
              <Skeleton className="h-4 w-48" />
            )}
          </div>

          <div className="dash-hero-stagger-3">
            <DashboardAskBar accent={theme.accent} />
          </div>

          {lastCounsel ? (
            <Link
              href={`/mera-vakil?c=${lastCounsel.id}`}
              className="dash-hero-stagger-4 hidden h-8 w-fit items-center gap-1.5 rounded-full border border-black/[0.08] bg-black/[0.04] px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-black/[0.07] hover:text-foreground dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/[0.10] dark:hover:text-white/90 sm:inline-flex"
            >
              <MessageSquare className="h-3 w-3" />
              {t("dashboard.continueLastChat")}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
