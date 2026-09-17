"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Home,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { CITY_SELECT_OPTIONS } from "@/lib/marketplace-cities";
import type { LawyerSort } from "@/lib/marketplace-store";
import { PRACTICE_AREAS } from "@/lib/mock/lawyers";
import { cn } from "@/lib/utils";

export interface LawyerFilterState {
  query: string;
  practiceArea: string;
  city: string;
  verifiedOnly: boolean;
  sort: LawyerSort;
}

interface LawyerFiltersProps {
  value: LawyerFilterState;
  onChange: (next: LawyerFilterState) => void;
}

const PRACTICE_AREA_ICONS: Record<string, typeof Scale> = {
  Criminal: Scale,
  Property: Home,
  Corporate: Briefcase,
  Family: Home,
  Constitutional: Scale,
  Labour: Briefcase,
  Tax: Briefcase,
  "Intellectual Property": Sparkles,
};

export function LawyerFilters({ value, onChange }: LawyerFiltersProps) {
  const [open, setOpen] = useState(false);

  function patch(partial: Partial<LawyerFilterState>) {
    onChange({ ...value, ...partial });
    if (partial.query !== undefined) {
      track(AnalyticsEvents.LAWYER_SEARCH_STARTED, { filter_type: "query" });
    }
    if (partial.practiceArea !== undefined) {
      track(AnalyticsEvents.LAWYER_FILTER_USED, {
        filter_type: "practice_area",
        filter_applied: Boolean(partial.practiceArea),
      });
    }
    if (partial.city !== undefined) {
      track(AnalyticsEvents.LAWYER_FILTER_USED, {
        filter_type: "city",
        filter_applied: Boolean(partial.city),
      });
    }
    if (partial.sort !== undefined) {
      track(AnalyticsEvents.LAWYER_FILTER_USED, { filter_type: "sort", sort_type: partial.sort });
    }
  }

  const activeCount = useMemo(() => {
    let count = 0;
    if (value.query.trim()) count += 1;
    if (value.practiceArea) count += 1;
    if (value.city) count += 1;
    if (!value.verifiedOnly) count += 1;
    if (value.sort !== "match") count += 1;
    return count;
  }, [value]);

  const hasActiveFilter = activeCount > 0;

  function clearFilters() {
    onChange({ query: "", practiceArea: "", city: "", verifiedOnly: true, sort: "match" });
  }

  return (
    <div className="mp-surface-card overflow-hidden rounded-[1.15rem] sm:rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-h-11 items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] sm:min-h-10 sm:px-4"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] dark:bg-white/[0.08]">
          <SlidersHorizontal className="h-4 w-4 text-foreground/70" strokeWidth={1.85} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold tracking-tight">Filters</span>
          <span className="block text-[11px] text-muted-foreground">
            {hasActiveFilter ? `${activeCount} active` : "Tap to refine advocates"}
          </span>
        </span>
        {hasActiveFilter && (
          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-bold text-background">
            {activeCount}
          </span>
        )}
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      <div className="mp-filter-panel" data-open={open ? "true" : "false"}>
        <div className="mp-filter-panel-inner">
          <div className="space-y-2.5 border-t border-black/[0.05] px-3.5 pb-3.5 pt-2.5 dark:border-white/[0.06] sm:px-4 sm:pb-4 sm:pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={value.query}
                onChange={(e) => patch({ query: e.target.value })}
                placeholder="Search advocates…"
                className="h-10 rounded-xl border-black/[0.06] bg-white pl-9 pr-3 text-[13px] shadow-inner dark:border-white/10 dark:bg-white/[0.04] sm:h-9"
                aria-label="Search advocates"
              />
            </div>

            <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 no-scrollbar">
              {PRACTICE_AREAS.map((area) => {
                const active = value.practiceArea === area;
                const Icon = PRACTICE_AREA_ICONS[area] ?? Scale;
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() =>
                      patch({ practiceArea: active ? "" : area, sort: active ? value.sort : "match" })
                    }
                    className={cn(
                      "inline-flex shrink-0 min-h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-all duration-200",
                      active
                        ? "border-black/[0.12] bg-black/[0.05] text-foreground dark:border-white/20 dark:bg-white/12 dark:text-zinc-100"
                        : "border-black/[0.06] bg-white text-muted-foreground hover:border-black/10 hover:text-foreground dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20",
                    )}
                  >
                    <Icon className="h-3 w-3 shrink-0" strokeWidth={1.85} />
                    {area}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor="city" className="sr-only">
                  City
                </Label>
                <Select
                  id="city"
                  value={value.city}
                  options={CITY_SELECT_OPTIONS}
                  onChange={(e) =>
                    patch({ city: e.target.value, sort: e.target.value ? "match" : value.sort })
                  }
                  aria-label="Filter by city"
                  placeholder="All cities"
                  className="h-11 rounded-xl text-[13px] sm:h-9"
                  hideScrollbar
                />
              </div>

              <div className="min-w-0">
                <Label htmlFor="sort" className="sr-only">
                  Sort
                </Label>
                <Select
                  id="sort"
                  value={value.sort}
                  onChange={(e) => patch({ sort: e.target.value as LawyerSort })}
                  aria-label="Sort advocates"
                  icon={<ArrowDownUp className="h-3.5 w-3.5" />}
                  className="h-11 rounded-xl text-[13px] sm:h-9"
                  hideScrollbar
                >
                  <option value="match">AI match</option>
                  <option value="rating">Rating</option>
                  <option value="experience">Experience</option>
                  <option value="rate">Hourly rate</option>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => patch({ verifiedOnly: !value.verifiedOnly })}
                className={cn(
                  "inline-flex h-10 min-h-10 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-all sm:h-9 sm:min-h-9",
                  value.verifiedOnly
                    ? "border-emerald-500/25 bg-emerald-50/80 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-100"
                    : "border-black/[0.08] bg-white text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]",
                )}
                aria-pressed={value.verifiedOnly}
              >
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                Verified
              </button>

              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
