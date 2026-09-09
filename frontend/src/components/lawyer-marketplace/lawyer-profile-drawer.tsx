"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BadgeCheck,
  Clock,
  Languages,
  MapPin,
  Scale,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import { LawyerAvatar } from "@/components/lawyer-marketplace/lawyer-avatar";
import { Button } from "@/components/ui/button";
import type { RankedLawyer } from "@/lib/marketplace-store";
import { cn } from "@/lib/utils";

interface LawyerProfileDrawerProps {
  lawyer: RankedLawyer | null;
  open: boolean;
  onClose: () => void;
  onBook: (lawyer: RankedLawyer) => void;
}

export function LawyerProfileDrawer({
  lawyer,
  open,
  onClose,
  onBook,
}: LawyerProfileDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !lawyer || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        type="button"
        className="mp-modal-veil absolute inset-0"
        aria-label="Close profile"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="lawyer-profile-title"
        className={cn(
          "relative z-[71] flex w-full flex-col bg-white",
          "max-h-[92vh] rounded-t-[1.6rem] border border-black/[0.08] shadow-[0_-12px_60px_rgba(15,23,42,0.18)]",
          "dark:border-white/10 dark:bg-[hsl(220_14%_9%)]",
          "sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:border-l sm:shadow-[0_0_80px_rgba(15,23,42,0.2)]",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/15 sm:hidden dark:bg-white/20" />
        <div className="relative overflow-hidden border-b border-black/[0.06] px-4 pb-4 pt-3 dark:border-white/[0.08]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-500/[0.06] via-transparent to-transparent" />
          <div className="relative flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Counsel profile
            </p>
            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative mt-3.5 flex items-start gap-3">
            <LawyerAvatar lawyer={lawyer} className="h-14 w-14 shadow-md" rounded="2xl" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 id="lawyer-profile-title" className="text-lg font-semibold tracking-tight">
                  {lawyer.full_name}
                </h2>
                {lawyer.verified && (
                  <BadgeCheck className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />
                )}
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Bar · {lawyer.bar_council_id}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[12px]">
                  <Star className="h-3 w-3 fill-current text-foreground/55" />
                  <span className="font-semibold">{lawyer.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({lawyer.review_count})</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:bg-white/10">
                  <Sparkles className="h-2.5 w-2.5" />
                  {lawyer.match_score}% match
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-[13px] leading-relaxed text-muted-foreground">{lawyer.bio}</p>

          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Scale, label: "Experience", value: `${lawyer.years_experience} years` },
              { icon: Clock, label: "Response", value: "Usually < 2 hrs" },
              { icon: MapPin, label: "City", value: lawyer.city },
              {
                icon: Languages,
                label: "Languages",
                value: lawyer.languages.slice(0, 2).join(", "),
              },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-black/[0.05] bg-white/50 p-2.5 dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  {label}
                </div>
                <p className="text-[13px] font-medium">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Practice areas
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lawyer.practice_areas.map((area) => (
                <span
                  key={area}
                  className="rounded-lg border border-black/[0.05] bg-black/[0.03] px-2.5 py-1 text-[11px] font-medium dark:border-white/[0.08] dark:bg-white/[0.05]"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Jurisdictions
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{lawyer.jurisdictions.join(" · ")}</p>
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-black/[0.025] p-3.5 dark:border-white/10 dark:bg-white/[0.05]">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              AI fit
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
              Strong fit for {lawyer.practice_areas[0]?.toLowerCase()} in {lawyer.city}. Verified
              credentials and high client satisfaction.
            </p>
          </div>
        </div>

        <div className="border-t border-black/[0.06] p-4 dark:border-white/[0.08]">
          <div className="mb-2.5 flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">Consultation</span>
            <span className="font-semibold">
              {lawyer.hourly_rate_inr != null
                ? `₹${lawyer.hourly_rate_inr.toLocaleString("en-IN")}/hr`
                : "Available"}
            </span>
          </div>
          <button
            type="button"
            className="mp-btn-accent h-10 w-full rounded-xl text-[13px] font-semibold"
            onClick={() => {
              onBook(lawyer);
              onClose();
            }}
          >
            Book consultation
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
