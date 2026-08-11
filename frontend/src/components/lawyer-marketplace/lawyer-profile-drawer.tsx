"use client";

import Image from "next/image";
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

import { Button } from "@/components/ui/button";
import { lawyerAvatarSrc } from "@/lib/lawyer-avatar";
import type { RankedLawyer } from "@/lib/marketplace-store";

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
    <div className="fixed inset-0 z-[70] flex justify-end">
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
        className="relative z-[71] flex h-full w-full max-w-md flex-col border-l border-black/[0.08] bg-white shadow-[0_0_80px_rgba(15,23,42,0.2)] dark:border-white/10 dark:bg-[hsl(220_14%_9%)]"
      >
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
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl shadow-md ring-1 ring-black/[0.06] dark:ring-white/10">
              <Image
                src={lawyerAvatarSrc(lawyer.id)}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
                priority
              />
            </div>
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
                  <Star className="h-3 w-3 fill-current text-amber-500" />
                  <span className="font-semibold">{lawyer.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({lawyer.review_count})</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-300/70 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200">
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

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/[0.05]">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-zinc-100">
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
