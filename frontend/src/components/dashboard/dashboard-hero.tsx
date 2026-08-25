"use client";

import Image from "next/image";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

import { DashboardAskBar } from "@/components/dashboard/dashboard-ask-bar";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardConfig } from "@/lib/dashboard-config";
import type { ChatConversation } from "@/lib/conversations";
import { cn } from "@/lib/utils";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function contextLine(openCount: number, appointmentCount: number): string {
  const parts: string[] = [];
  if (openCount > 0) {
    parts.push(`${openCount} open ${openCount === 1 ? "matter" : "matters"}`);
  }
  if (appointmentCount > 0) {
    parts.push(`${appointmentCount} ${appointmentCount === 1 ? "appointment" : "appointments"}`);
  }
  return parts.join(" · ");
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
  const context = ready ? contextLine(openCount, appointmentCount) : "";

  return (
    <header
      className={cn(
        "relative overflow-hidden",
        "px-0 pb-1 pt-2 sm:rounded-[1.75rem] sm:border sm:border-black/[0.06] sm:bg-white/50 sm:px-7 sm:pb-7 sm:pt-7 sm:backdrop-blur-xl",
        "dark:sm:border-white/[0.08] dark:sm:bg-white/[0.03]",
        "dash-card-in",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-px dash-shimmer-line sm:block" />
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full dash-hero-orb dash-hero-glow" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-52 w-52 rounded-full dash-hero-orb dash-hero-glow opacity-70" />

      <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,380px)] lg:gap-10">
        <div className="space-y-5 sm:space-y-6">
          <div className="space-y-2.5">
            <p className="text-[13px] text-muted-foreground">{formatDate()}</p>
            <h1 className="text-[1.85rem] font-semibold leading-[1.12] tracking-tight sm:text-[2.2rem] md:text-[2.4rem]">
              {getGreeting()}, <span className="gradient-text">{firstName}</span>
            </h1>
            <p className="max-w-lg text-[13px] leading-relaxed text-muted-foreground sm:text-[15px]">
              <span className="font-medium text-foreground/90">{config.headline}</span>
              {" — "}
              {config.subtitle}
            </p>
            {ready ? (
              context ? (
                <p className="text-[13px] text-muted-foreground/80">{context}</p>
              ) : null
            ) : (
              <Skeleton className="h-4 w-48" />
            )}
          </div>

          <DashboardAskBar />

          {lastCounsel && (
            <Link
              href={`/mera-vakil?c=${lastCounsel.id}`}
              className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-black/[0.08] bg-black/[0.04] px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-black/[0.07] hover:text-foreground dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/[0.10] dark:hover:text-white/90"
            >
              <MessageSquare className="h-3 w-3" />
              Continue last chat
            </Link>
          )}
        </div>

        <div
          className={cn(
            "relative hidden min-h-[220px] overflow-hidden rounded-2xl lg:block",
            "ring-1 ring-black/[0.06] shadow-[0_18px_48px_rgba(80,40,10,0.14)]",
            "dark:ring-white/[0.10] dark:shadow-[0_18px_48px_rgba(0,0,0,0.35)]",
          )}
          aria-hidden
        >
          <Image
            src="/dashboard/hero-legal.png"
            alt=""
            fill
            priority
            className="object-cover object-[center_40%] dark:brightness-[0.92]"
            sizes="(max-width: 1024px) 0px, 380px"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10" />
        </div>
      </div>
    </header>
  );
}
