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

  const panelActiveCount = useMemo(() => {
    let count = 0;
    if (status !== "all") count += 1;
    if (date !== "all") count += 1;
    return count;
  }, [status, date]);

  const hasAnyFilter = search.trim().length > 0 || panelActiveCount > 0;

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
      {/* Search — always visible */}
      <div className="px-3.5 pb-0 pt-3 sm:px-4 sm:pt-3.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("appointments.searchByName")}
            className="h-11 rounded-xl border-black/[0.06] bg-black/[0.02] pl-9 pr-9 text-[13px] shadow-none dark:border-white/10 dark:bg-white/[0.03] sm:h-10"
            aria-label={t("appointments.searchByName")}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter toggle row */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex min-h-9 flex-1 items-center gap-2 rounded-xl border border-black/[0.06] px-3 py-2 text-left transition-colors hover:bg-black/[0.03] dark:border-white/[0.08] dark:hover:bg-white/[0.04] sm:min-h-8"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.85} />
          <span className="text-[12.5px] font-medium text-muted-foreground">
            {panelActiveCount > 0
              ? `${panelActiveCount} filter${panelActiveCount !== 1 ? "s" : ""} · ${filtered} of ${total}`
              : "Filter consultations"}
          </span>
          {panelActiveCount > 0 && (
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-bold text-background">
              {panelActiveCount}
            </span>
          )}
          {open ? (
            <ChevronUp className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground", panelActiveCount === 0 && "ml-auto")} />
          ) : (
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground", panelActiveCount === 0 && "ml-auto")} />
          )}
        </button>

        {hasAnyFilter && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); clearFilters(); }}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
          >
            <X className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>

      {/* Expandable panel — status + date selects */}
      <div className="mp-filter-panel" data-open={open ? "true" : "false"}>
        <div className="mp-filter-panel-inner">
          <div className="grid grid-cols-1 gap-2 border-t border-black/[0.05] px-3.5 pb-3.5 pt-2.5 dark:border-white/[0.06] sm:grid-cols-2 sm:px-4 sm:pb-4 sm:pt-3">
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
        </div>
      </div>
    </div>
  );
}
