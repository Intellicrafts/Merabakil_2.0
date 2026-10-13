"use client";

import { AlertTriangle, BadgeCheck, CircleDashed, Clock3, XCircle } from "lucide-react";

import type { RankedMarketplaceLawyer } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

import { describeRequired, listingState } from "./listing-form";

const TONES = {
  live: "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200",
  attention: "bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200",
  waiting: "bg-sky-50 text-sky-900 dark:bg-sky-900/20 dark:text-sky-200",
  blocked: "bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-200",
} as const;

/** One line at the top of the edit page: is the listing live, and if not, why. */
export function ListingStatusPanel({ row, adminMode }: { row: RankedMarketplaceLawyer | null; adminMode?: boolean }) {
  const state = listingState(row);
  const missing = describeRequired(row?.missing_required);
  const you = adminMode ? "this advocate" : "you";
  const copy = {
    live: { tone: "live", Icon: BadgeCheck, title: "Live", body: `Clients can find and book ${you}.` },
    live_incomplete: {
      tone: "attention",
      Icon: AlertTriangle,
      title: "Live — some details are missing",
      body: `Add ${missing}. They're required now, so they're needed to save any change.`,
    },
    under_review: {
      tone: "waiting",
      Icon: Clock3,
      title: "Waiting for verification",
      body: "Our team is checking the enrolment. The listing goes live once it's confirmed.",
    },
    not_verified: {
      tone: "blocked",
      Icon: XCircle,
      title: "Not live — enrolment not confirmed",
      body: adminMode
        ? "Verify or approve the enrolment from User management."
        : "Verify your enrolment number below, or request a manual review.",
    },
    incomplete: { tone: "attention", Icon: CircleDashed, title: "Not live yet", body: `Add ${missing} to go live.` },
  }[state];
  const needsBio = state === "live" && (row?.missing_for_matching ?? []).includes("bio");

  return (
    <div role="status" className={cn("rounded-2xl px-4 py-3", TONES[copy.tone as keyof typeof TONES])}>
      <p className="flex items-center gap-2 text-[13px] font-semibold">
        <copy.Icon className="h-4 w-4 shrink-0" aria-hidden />
        {copy.title}
      </p>
      <p className="mt-0.5 pl-6 text-[12px] opacity-90">{copy.body}</p>
      {needsBio && (
        <p className="mt-1 pl-6 text-[12px] opacity-90">
          Add a short bio (50+ characters) so Saarthi can recommend {you} to clients with matching cases.
        </p>
      )}
    </div>
  );
}
