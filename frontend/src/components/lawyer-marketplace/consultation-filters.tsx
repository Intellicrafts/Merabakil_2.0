"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ListFilter,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ConsultationStatusFilter = "all" | "upcoming" | "completed" | "cancelled";
export type ConsultationDateFilter = "all" | "week" | "month" | "3months";

interface ConsultationFiltersProps {
  search: string;
  onSearch: (value: string) => void;
  status: ConsultationStatusFilter;
  onStatus: (value: ConsultationStatusFilter) => void;
  date: ConsultationDateFilter;
  onDate: (value: ConsultationDateFilter) => void;
  total: number;
  filtered: number;
}

export function ConsultationFilters({
  search,
  onSearch,
  status,
  onStatus,
  date,
  onDate,
  total,
  filtered,
}: ConsultationFiltersProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const activeCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count += 1;
    if (status !== "all") count += 1;
    if (date !== "all") count += 1;
    return count;
  }, [search, status, date]);

  const hasActiveFilter = activeCount > 0;

  function clearFilters() {
    onSearch("");
    onStatus("all");
    onDate("all");
  }

  const statusOptions = [
    {
      value: "all",
      label: t("appointments.allStatuses"),
      icon: <ListFilter className="h-3.5 w-3.5" strokeWidth={1.85} />,
    },
    {
      value: "upcoming",
      label: t("appointments.upcoming"),
      icon: <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.85} />,
    },
    {
      value: "completed",
      label: t("appointments.completed"),
      icon: <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.85} />,
    },
    {
      value: "cancelled",
      label: t("appointments.cancelled"),
      icon: <XCircle className="h-3.5 w-3.5" strokeWidth={1.85} />,
    },
  ];

  const dateOptions = [
    {
      value: "all",
      label: t("appointments.allTime"),
      icon: <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.85} />,
    },
    {
      value: "week",
      label: t("appointments.thisWeek"),
      icon: <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.85} />,
    },
    {
      value: "month",
      label: t("appointments.thisMonth"),
      icon: <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.85} />,
    },
    {
      value: "3months",
      label: t("appointments.lastThreeMonths"),
      icon: <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.85} />,
    },
  ];

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
            {hasActiveFilter
              ? `${activeCount} active · ${filtered} of ${total}`
              : "Tap to refine consultations"}
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
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={t("appointments.searchByName")}
                className="h-10 rounded-xl border-black/[0.06] bg-white pl-9 pr-3 text-[13px] shadow-inner dark:border-white/10 dark:bg-white/[0.04] sm:h-9"
                aria-label={t("appointments.searchByName")}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor="apt-status" className="sr-only">
                  {t("appointments.filterByStatus")}
                </Label>
                <Select
                  id="apt-status"
                  value={status}
                  options={statusOptions}
                  onChange={(e) => onStatus(e.target.value as ConsultationStatusFilter)}
                  aria-label={t("appointments.filterByStatus")}
                  placeholder={t("appointments.allStatuses")}
                  className="h-11 rounded-xl text-[13px] sm:h-9"
                  hideScrollbar
                />
              </div>

              <div className="min-w-0">
                <Label htmlFor="apt-date" className="sr-only">
                  {t("appointments.filterByDate")}
                </Label>
                <Select
                  id="apt-date"
                  value={date}
                  options={dateOptions}
                  onChange={(e) => onDate(e.target.value as ConsultationDateFilter)}
                  aria-label={t("appointments.filterByDate")}
                  placeholder={t("appointments.allTime")}
                  className="h-11 rounded-xl text-[13px] sm:h-9"
                  hideScrollbar
                />
              </div>
            </div>

            {hasActiveFilter && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]",
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                  {t("common.clear")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
