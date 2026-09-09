"use client";

import {
  ArrowUpRight,
  BadgeCheck,
  MapPin,
  RefreshCw,
  Star,
  User,
} from "lucide-react";

import { LawyerAvatar } from "@/components/lawyer-marketplace/lawyer-avatar";
import { lawyerInitials } from "@/lib/lawyer-avatar";
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
        <p className="text-[12px] font-medium text-muted-foreground">Match complete</p>
        <button
          type="button"
          onClick={onEditPreferences}
          className="text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Edit preferences
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)]">
        <div className="mp-surface-card rounded-[1.15rem] p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Your profile
          </p>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.04] text-[12px] font-semibold dark:bg-white/[0.06]">
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

        <div className="mp-surface-card relative overflow-hidden rounded-[1.15rem] p-4 sm:p-5">
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-1 items-start gap-2.5">
              <LawyerAvatar lawyer={lawyer} className="h-12 w-12 shadow-sm" rounded="xl" />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <h3 className="text-[15px] font-semibold tracking-tight">{lawyer.full_name}</h3>
                  {lawyer.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-foreground/70" />}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {lawyer.city} · {lawyer.practice_areas.slice(0, 2).join(", ")}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-current text-foreground/55" />
                    <span className="font-medium text-foreground/80">{lawyer.rating.toFixed(1)}</span>
                    <span>({lawyer.review_count})</span>
                  </span>
                  <span className="font-semibold text-foreground">
                    {lawyer.hourly_rate_inr != null
                      ? `₹${lawyer.hourly_rate_inr.toLocaleString("en-IN")}/hr`
                      : "Available"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]">
              <p className="text-lg font-semibold tabular-nums leading-none">{lawyer.match_score}</p>
              <p className="mt-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                match
              </p>
            </div>
          </div>

          <div className="relative mt-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Why this match
            </p>
            <ul className="space-y-1">
              {reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mt-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              className="mp-btn-accent h-10 items-center rounded-xl px-4 text-[12px] font-semibold sm:h-9"
              onClick={onBook}
            >
              Book
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="mp-btn-primary h-10 rounded-xl px-3 text-[12px] font-semibold sm:h-9"
              onClick={onView}
            >
              Profile
            </button>
            <button
              type="button"
              className="mp-btn-soft h-10 rounded-xl px-3 text-[12px] font-semibold sm:h-9"
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
