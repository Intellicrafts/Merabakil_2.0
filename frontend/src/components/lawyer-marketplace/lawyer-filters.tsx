"use client";

import { Search, Sparkles } from "lucide-react";

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

  return (
    <div className="space-y-3 rounded-2xl border border-black/[0.06] bg-white/55 p-3.5 shadow-[0_6px_24px_rgba(15,23,42,0.03)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035] sm:p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.query}
          onChange={(e) => patch({ query: e.target.value })}
          placeholder="Search name, city, practice…"
          className="h-10 rounded-xl border-black/[0.06] bg-white/70 pl-9 pr-24 text-[13px] shadow-inner dark:border-white/10 dark:bg-white/[0.04]"
          aria-label="Search lawyers"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full border border-slate-300/60 bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600 sm:inline-flex dark:border-white/15 dark:bg-white/10 dark:text-zinc-200">
          <Sparkles className="h-2.5 w-2.5" />
          AI
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
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
                "min-h-8 rounded-full border px-2.5 text-[11px] font-medium transition-all duration-200",
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

      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 space-y-1 sm:max-w-[148px]">
          <Label htmlFor="city" className="text-[10px] uppercase tracking-wider text-muted-foreground">
            City
          </Label>
          <Select
            id="city"
            value={value.city}
            onChange={(e) =>
              patch({ city: e.target.value, sort: e.target.value ? "match" : value.sort })
            }
            aria-label="Filter by city"
            className="h-9 rounded-xl text-[13px]"
          >
            <option value="">All cities</option>
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-0 flex-1 space-y-1 sm:max-w-[148px]">
          <Label htmlFor="sort" className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Sort
          </Label>
          <Select
            id="sort"
            value={value.sort}
            onChange={(e) => patch({ sort: e.target.value as LawyerSort })}
            aria-label="Sort lawyers"
            className="h-9 rounded-xl text-[13px]"
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
            "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-all",
            value.verifiedOnly
              ? "border-slate-300 bg-slate-100 text-slate-800 dark:border-white/20 dark:bg-white/12 dark:text-zinc-100"
              : "border-black/[0.06] bg-white/60 text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]",
          )}
          aria-pressed={value.verifiedOnly}
        >
          Verified only
        </button>
      </div>
    </div>
  );
}
