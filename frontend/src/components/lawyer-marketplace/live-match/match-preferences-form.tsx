"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  History,
  Loader2,
  MapPin,
  Navigation,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  nearestCityFromCoords,
  resolveAutoCity,
  resolveEffectiveCity,
  type MatchPreferences,
  type MatchResult,
} from "@/lib/marketplace-store";
import { CITIES, PRACTICE_AREAS } from "@/lib/mock/lawyers";
import { cn } from "@/lib/utils";

const EXPERIENCE_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 5, label: "5+ years" },
  { value: 10, label: "10+ years" },
  { value: 15, label: "15+ years" },
] as const;

const BUDGET_OPTIONS = [
  { value: 3000, label: "Up to ₹3,000/hr" },
  { value: 4500, label: "Up to ₹4,500/hr" },
  { value: 6000, label: "Up to ₹6,000/hr" },
  { value: 10000, label: "Up to ₹10,000/hr" },
] as const;

interface MatchPreferencesFormProps {
  value: MatchPreferences;
  onChange: (next: MatchPreferences) => void;
  hasPriorMatch: boolean;
  history: MatchResult[];
  onFindMatch: () => void;
  onViewLastMatch: () => void;
  onSelectHistory: (match: MatchResult) => void;
  onBookHistory: (match: MatchResult) => void;
  locationError?: string | null;
  onLocationError?: (msg: string | null) => void;
}

export function MatchPreferencesForm({
  value,
  onChange,
  hasPriorMatch,
  history,
  onFindMatch,
  onViewLastMatch,
  onSelectHistory,
  onBookHistory,
  locationError,
  onLocationError,
}: MatchPreferencesFormProps) {
  const [locating, setLocating] = useState(false);

  function patch(partial: Partial<MatchPreferences>) {
    onChange({ ...value, ...partial });
  }

  function toggleArea(area: string) {
    const has = value.practiceAreas.includes(area);
    const practiceAreas = has
      ? value.practiceAreas.filter((a) => a !== area)
      : [...value.practiceAreas, area];
    if (practiceAreas.length === 0) return;
    patch({ practiceAreas });
  }

  function useCurrentLocation() {
    onLocationError?.(null);
    if (!navigator.geolocation) {
      onLocationError?.("Location is not supported in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const city = nearestCityFromCoords(pos.coords.latitude, pos.coords.longitude);
        patch({ locationMode: "current", city });
        setLocating(false);
      },
      () => {
        onLocationError?.("Could not access location. Enable permission or pick a city.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  const effectiveCity = resolveEffectiveCity(value);
  const canSubmit = value.practiceAreas.length > 0;

  return (
    <div className="space-y-4">
      {/* Practice areas */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Practice areas
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {PRACTICE_AREAS.map((area) => {
            const active = value.practiceAreas.includes(area);
            return (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                className={cn(
                  "min-h-8 rounded-full border px-2.5 text-[11px] font-medium transition-all duration-200",
                  active
                    ? "border-slate-300 bg-slate-100 text-slate-800 shadow-sm dark:border-white/20 dark:bg-white/12 dark:text-zinc-100"
                    : "border-black/[0.06] bg-white/50 text-muted-foreground hover:border-black/10 hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]",
                )}
              >
                {area}
              </button>
            );
          })}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Location
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.06] bg-white/50 px-2.5 text-[12px] dark:border-white/[0.08] dark:bg-white/[0.04]">
            <input
              type="checkbox"
              checked={value.locationMode === "auto"}
              onChange={(e) => {
                if (e.target.checked) {
                  patch({ locationMode: "auto", city: resolveAutoCity() });
                } else {
                  patch({ locationMode: "manual" });
                }
              }}
              className="h-3.5 w-3.5 rounded border-input"
            />
            Auto
          </label>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-[12px]"
            onClick={useCurrentLocation}
            disabled={locating}
          >
            {locating ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Navigation className="mr-1 h-3.5 w-3.5" />
            )}
            Current location
          </Button>

          {value.locationMode !== "auto" && (
            <Select
              value={value.city}
              onChange={(e) => patch({ locationMode: "manual", city: e.target.value })}
              className="h-9 min-w-[120px] rounded-xl text-[13px]"
              aria-label="Select city"
            >
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </Select>
          )}
        </div>
        <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" />
          Matching in{" "}
          <span className="font-medium text-foreground">
            {effectiveCity}
            {value.locationMode === "auto" && " · Auto"}
            {value.locationMode === "current" && " · Current"}
          </span>
        </p>
        {locationError && (
          <p className="text-[11px] text-destructive">{locationError}</p>
        )}
      </div>

      {/* Experience + budget */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Experience
          </Label>
          <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.06] bg-white/50 px-2.5 text-[12px] dark:border-white/[0.08] dark:bg-white/[0.04]">
            <input
              type="checkbox"
              checked={value.experienceAuto}
              onChange={(e) => patch({ experienceAuto: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-input"
            />
            Auto
          </label>
          {!value.experienceAuto && (
            <Select
              value={String(value.minExperience)}
              onChange={(e) => patch({ minExperience: Number(e.target.value) })}
              className="h-9 rounded-xl text-[13px]"
              aria-label="Minimum experience"
            >
              {EXPERIENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Budget
          </Label>
          <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.06] bg-white/50 px-2.5 text-[12px] dark:border-white/[0.08] dark:bg-white/[0.04]">
            <input
              type="checkbox"
              checked={value.budgetAuto}
              onChange={(e) =>
                patch({
                  budgetAuto: e.target.checked,
                  maxRateInr: e.target.checked ? null : value.maxRateInr ?? 4500,
                })
              }
              className="h-3.5 w-3.5 rounded border-input"
            />
            Auto · no cap
          </label>
          {!value.budgetAuto && (
            <Select
              value={String(value.maxRateInr ?? 4500)}
              onChange={(e) => patch({ maxRateInr: Number(e.target.value) })}
              className="h-9 rounded-xl text-[13px]"
              aria-label="Maximum hourly rate"
            >
              {BUDGET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <label className="flex h-8 cursor-pointer items-center gap-1.5 text-[12px]">
        <input
          type="checkbox"
          checked={value.verifiedOnly}
          onChange={(e) => patch({ verifiedOnly: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-input"
        />
        Verified only
      </label>

      <div className="flex flex-col gap-2 border-t border-black/[0.05] pt-3.5 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] text-muted-foreground">Bar-verified · Instant</p>
        <div className="flex flex-col gap-1.5 sm:flex-row">
          {hasPriorMatch && (
            <button
              type="button"
              onClick={onViewLastMatch}
              className="mp-btn-soft h-9 rounded-full px-4 text-[12px] font-semibold"
            >
              <History className="mr-1.5 inline h-3.5 w-3.5" />
              Last match
            </button>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onFindMatch}
            className="mp-btn-accent h-9 rounded-full px-5 text-[12px] font-semibold disabled:opacity-50"
          >
            <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
            {hasPriorMatch ? "Rematch" : "Find my lawyer"}
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="space-y-2 border-t border-black/[0.05] pt-3.5 dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <History className="h-3 w-3 text-muted-foreground" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Previous matches
            </p>
          </div>
          <ul className="space-y-1.5">
            {history.slice(0, 3).map((item) => (
              <li
                key={`${item.lawyer.id}-${item.matched_at ?? item.lawyer.match_score}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-white/50 px-2.5 py-2 dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <button
                  type="button"
                  onClick={() => onSelectHistory(item)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-semibold text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
                    {item.lawyer.full_name
                      .replace(/^Adv\.\s*/i, "")
                      .split(" ")
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-[12px] font-semibold">
                      {item.lawyer.full_name}
                      {item.lawyer.verified && (
                        <BadgeCheck className="h-3 w-3 shrink-0 text-slate-700 dark:text-slate-300" />
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.lawyer.city} · {item.lawyer.match_score}%
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  className="mp-btn-primary h-8 rounded-full px-3 text-[11px] font-semibold"
                  onClick={() => onBookHistory(item)}
                >
                  Book
                  <ArrowUpRight className="ml-0.5 inline h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
