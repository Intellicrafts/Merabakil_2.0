"use client";

import { ArrowDownUp, MapPin, Search, Sparkles } from "lucide-react";

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
    <div className="mp-surface-card space-y-2.5 rounded-[1.15rem] p-3 sm:rounded-2xl sm:p-4">
      {/* Search row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.query}
            onChange={(e) => patch({ query: e.target.value })}
            placeholder="Search advocates…"
            className="h-10 rounded-xl border-black/[0.06] bg-white pl-9 pr-3 text-[13px] shadow-inner dark:border-white/10 dark:bg-white/[0.04] sm:h-9"
            aria-label="Search advocates"
          />
        </div>
        <span className="hidden items-center gap-1 rounded-full border border-black/[0.08] bg-black/[0.03] px-2.5 py-1 text-[9px] font-semibold text-muted-foreground sm:inline-flex dark:border-white/15 dark:bg-white/10">
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
                  ? "border-black/[0.12] bg-black/[0.05] text-foreground dark:border-white/20 dark:bg-white/12 dark:text-zinc-100"
                  : "border-black/[0.06] bg-white text-muted-foreground hover:border-black/10 hover:text-foreground dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20",
              )}
            >
              {area}
            </button>
          );
        })}
      </div>

      {/* Bottom row — city, sort, verified */}
      <div className="grid grid-cols-2 gap-2 border-t border-black/[0.04] pt-2.5 dark:border-white/[0.05] sm:flex sm:flex-wrap sm:items-center">
        <div className="min-w-0">
          <Label htmlFor="city" className="sr-only">City</Label>
          <Select
            id="city"
            value={value.city}
            onChange={(e) =>
              patch({ city: e.target.value, sort: e.target.value ? "match" : value.sort })
            }
            aria-label="Filter by city"
            icon={<MapPin className="h-3.5 w-3.5" />}
            className="h-11 rounded-xl text-[13px] sm:h-9 sm:min-w-[10.5rem]"
          >
            <option value="">All cities</option>
            {CITIES.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </Select>
        </div>

        <div className="min-w-0">
          <Label htmlFor="sort" className="sr-only">Sort</Label>
          <Select
            id="sort"
            value={value.sort}
            onChange={(e) => patch({ sort: e.target.value as LawyerSort })}
            aria-label="Sort advocates"
            icon={<ArrowDownUp className="h-3.5 w-3.5" />}
            className="h-11 rounded-xl text-[13px] sm:h-9 sm:min-w-[10.5rem]"
          >
            <option value="match">AI match</option>
            <option value="rating">Rating</option>
            <option value="experience">Experience</option>
            <option value="rate">Hourly rate</option>
          </Select>
        </div>

        <div className="col-span-2 flex items-center gap-2 sm:ml-auto sm:w-auto">
          <button
            type="button"
            onClick={() => patch({ verifiedOnly: !value.verifiedOnly })}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-all sm:h-9",
              value.verifiedOnly
                ? "border-black/[0.12] bg-black/[0.05] text-foreground dark:border-white/20 dark:bg-white/12 dark:text-zinc-100"
                : "border-black/[0.08] bg-white text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]",
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
              className="ml-auto text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:ml-0"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
