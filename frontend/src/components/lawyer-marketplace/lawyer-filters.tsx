"use client";

import { Search, SlidersHorizontal, Sparkles } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { LawyerSort } from "@/lib/marketplace-store";
import { CITIES, PRACTICE_AREAS } from "@/lib/mock/lawyers";
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

export function LawyerFilters({ value, onChange }: LawyerFiltersProps) {
  function patch(partial: Partial<LawyerFilterState>) {
    onChange({ ...value, ...partial });
  }

  const hasActiveFilter =
    Boolean(value.query) ||
    Boolean(value.practiceArea) ||
    Boolean(value.city) ||
    !value.verifiedOnly;

  return (
    <div className="space-y-2.5 rounded-2xl border border-black/[0.06] bg-white/55 p-3 shadow-[0_4px_16px_rgba(15,23,42,0.03)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035] sm:p-3.5">
      {/* Search row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.query}
            onChange={(e) => patch({ query: e.target.value })}
            placeholder="Search by name, city, or practice area…"
            className="h-9 rounded-xl border-black/[0.06] bg-white/70 pl-9 pr-3 text-[13px] shadow-inner dark:border-white/10 dark:bg-white/[0.04]"
            aria-label="Search advocates"
          />
        </div>
        <span className="hidden items-center gap-1 rounded-full border border-slate-300/60 bg-slate-100 px-2.5 py-1 text-[9px] font-semibold text-slate-600 sm:inline-flex dark:border-white/15 dark:bg-white/10 dark:text-zinc-200">
          <Sparkles className="h-2.5 w-2.5" />
          AI search
        </span>
      </div>

      {/* Practice area chips — horizontal scroll on mobile */}
      <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 no-scrollbar">
        {PRACTICE_AREAS.map((area) => {
          const active = value.practiceArea === area;
          return (
            <button
              key={area}
              type="button"
              onClick={() =>
                patch({ practiceArea: active ? "" : area, sort: active ? value.sort : "match" })
              }
              className={cn(
                "shrink-0 min-h-7 rounded-full border px-2.5 text-[11px] font-medium transition-all duration-200",
                active
                  ? "border-slate-300 bg-slate-100 text-slate-800 shadow-sm dark:border-white/20 dark:bg-white/12 dark:text-zinc-100"
                  : "border-black/[0.06] bg-white/50 text-muted-foreground hover:border-black/10 hover:text-foreground dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20",
              )}
            >
              {area}
            </button>
          );
        })}
      </div>

      {/* Bottom row — city, sort, verified */}
      <div className="flex flex-wrap items-center gap-2 border-t border-black/[0.04] pt-2.5 dark:border-white/[0.05]">
        <SlidersHorizontal className="h-3 w-3 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />

        <div className="flex items-center gap-1">
          <Label htmlFor="city" className="sr-only">City</Label>
          <Select
            id="city"
            value={value.city}
            onChange={(e) =>
              patch({ city: e.target.value, sort: e.target.value ? "match" : value.sort })
            }
            aria-label="Filter by city"
            className="h-7 rounded-lg border-black/[0.06] bg-white/70 text-[11px] dark:border-white/10 dark:bg-white/[0.04]"
          >
            <option value="">All cities</option>
            {CITIES.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Label htmlFor="sort" className="sr-only">Sort</Label>
          <Select
            id="sort"
            value={value.sort}
            onChange={(e) => patch({ sort: e.target.value as LawyerSort })}
            aria-label="Sort advocates"
            className="h-7 rounded-lg border-black/[0.06] bg-white/70 text-[11px] dark:border-white/10 dark:bg-white/[0.04]"
          >
            <option value="match">AI match</option>
            <option value="rating">Rating</option>
            <option value="experience">Experience</option>
            <option value="rate">Hourly rate</option>
          </Select>
        </div>

        <button
          type="button"
          onClick={() => patch({ verifiedOnly: !value.verifiedOnly })}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-all",
            value.verifiedOnly
              ? "border-slate-300 bg-slate-100 text-slate-800 dark:border-white/20 dark:bg-white/12 dark:text-zinc-100"
              : "border-black/[0.06] bg-white/60 text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]",
          )}
          aria-pressed={value.verifiedOnly}
        >
          Verified only
        </button>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={() =>
              onChange({ query: "", practiceArea: "", city: "", verifiedOnly: true, sort: "match" })
            }
            className="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
