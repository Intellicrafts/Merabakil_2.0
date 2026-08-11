"use client";

import Image from "next/image";
import {
  ArrowUpRight,
  BadgeCheck,
  MapPin,
  RefreshCw,
  Sparkles,
  Star,
  User,
} from "lucide-react";

import { lawyerAvatarSrc, lawyerInitials } from "@/lib/lawyer-avatar";
import type { MatchResult } from "@/lib/marketplace-store";
import type { AuthUser } from "@/lib/types";

interface MatchResultCardProps {
  user: AuthUser | null;
  result: MatchResult;
  onBook: () => void;
  onView: () => void;
  onRematch: () => void;
  onEditPreferences: () => void;
}

export function MatchResultCard({
  user,
  result,
  onBook,
  onView,
  onRematch,
  onEditPreferences,
}: MatchResultCardProps) {
  const { lawyer, reasons, preferences, effectiveCity } = result;
  const userName = user?.full_name ?? "You";
  const userRole = user?.roles?.[0]?.replace("_", " ") ?? "Member";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
          <span className="mp-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Match complete
        </div>
        <button
          type="button"
          onClick={onEditPreferences}
          className="text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Edit preferences
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)]">
        <div className="rounded-2xl border border-black/[0.06] bg-white/50 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Your profile
          </p>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.06] bg-black/[0.03] text-[12px] font-semibold dark:border-white/10 dark:bg-white/[0.06]">
              {user ? lawyerInitials(userName) : <User className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-[13px] font-semibold tracking-tight">{userName}</p>
              <p className="text-[11px] capitalize text-muted-foreground">{userRole}</p>
            </div>
          </div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Preferences
          </p>
          <div className="flex flex-wrap gap-1">
            {preferences.practiceAreas.map((a) => (
              <span
                key={a}
                className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/[0.06]"
              >
                {a}
              </span>
            ))}
            <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/[0.06]">
              {effectiveCity}
              {preferences.locationMode === "auto" ? " · Auto" : ""}
            </span>
            <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/[0.06]">
              {preferences.experienceAuto
                ? "Exp · Auto"
                : `${preferences.minExperience}+ yrs`}
            </span>
            {preferences.verifiedOnly && (
              <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/[0.06]">
                Verified
              </span>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-black/[0.08] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] dark:border-white/10 dark:from-zinc-100 dark:via-zinc-200 dark:to-zinc-300 dark:text-zinc-900 sm:p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-3xl dark:bg-black/5" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-1 items-start gap-2.5">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/20 dark:ring-black/10">
                <Image
                  src={lawyerAvatarSrc(lawyer.id)}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <h3 className="text-[15px] font-semibold tracking-tight">{lawyer.full_name}</h3>
                  {lawyer.verified && <BadgeCheck className="h-4 w-4 shrink-0" />}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-[12px] text-white/70 dark:text-zinc-600">
                  <MapPin className="h-3 w-3" />
                  {lawyer.city} · {lawyer.practice_areas.slice(0, 2).join(", ")}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-current text-amber-300 dark:text-amber-600" />
                    {lawyer.rating.toFixed(1)} ({lawyer.review_count})
                  </span>
                  <span className="font-medium">
                    {lawyer.hourly_rate_inr != null
                      ? `₹${lawyer.hourly_rate_inr.toLocaleString("en-IN")}/hr`
                      : "Available"}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative mx-auto flex h-16 w-16 shrink-0 items-center justify-center sm:mx-0">
              <div className="mp-match-ring absolute inset-0 rounded-full opacity-90" />
              <div className="absolute inset-[2px] rounded-full bg-slate-900 dark:bg-zinc-200" />
              <div className="relative text-center">
                <p className="text-lg font-bold tabular-nums">{lawyer.match_score}</p>
                <p className="text-[8px] font-medium uppercase tracking-wider text-white/50 dark:text-zinc-600">
                  match
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-4">
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60 dark:text-zinc-600">
              <Sparkles className="h-3 w-3" />
              Why this match
            </p>
            <ul className="space-y-1">
              {reasons.map((reason) => (
                <li
                  key={reason}
                  className="flex items-start gap-1.5 text-[12px] text-white/85 dark:text-zinc-700"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400 dark:bg-emerald-600" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mt-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              className="mp-btn-accent h-9 items-center rounded-full px-4 text-[12px] font-semibold"
              onClick={onBook}
            >
              Book
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="mp-btn-soft h-9 rounded-full border-white/20 bg-white/10 px-3 text-[12px] font-semibold text-white hover:bg-white/15 dark:border-black/10 dark:bg-black/5 dark:text-zinc-900"
              onClick={onView}
            >
              Profile
            </button>
            <button
              type="button"
              className="mp-btn-soft h-9 rounded-full border-white/20 bg-white/10 px-3 text-[12px] font-semibold text-white hover:bg-white/15 dark:border-black/10 dark:bg-black/5 dark:text-zinc-900"
              onClick={onRematch}
            >
              <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
              Rematch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
