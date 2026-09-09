"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { AppointmentList } from "@/components/lawyer-marketplace/appointment-list";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getAppointmentJoinState, listAppointments } from "@/lib/api";
import type { AppointmentRecord } from "@/lib/appointment-types";

type StatusFilter = "all" | "upcoming" | "completed" | "cancelled";
type DateFilter = "all" | "week" | "month" | "3months";

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({
  search,
  onSearch,
  status,
  onStatus,
  date,
  onDate,
  total,
  filtered,
}: {
  search: string;
  onSearch: (v: string) => void;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
  date: DateFilter;
  onDate: (v: DateFilter) => void;
  total: number;
  filtered: number;
}) {
  const isActive = search.trim() !== "" || status !== "all" || date !== "all";

  function clear() {
    onSearch("");
    onStatus("all");
    onDate("all");
  }

  const selectClass =
    "h-9 rounded-xl border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Name search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by name…"
          className="h-9 w-48 rounded-xl pl-8 text-[13px] sm:w-56"
        />
      </div>

      {/* Status */}
      <select
        value={status}
        onChange={(e) => onStatus(e.target.value as StatusFilter)}
        className={selectClass}
        aria-label="Filter by status"
      >
        <option value="all">All statuses</option>
        <option value="upcoming">Upcoming</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>

      {/* Date range */}
      <select
        value={date}
        onChange={(e) => onDate(e.target.value as DateFilter)}
        className={selectClass}
        aria-label="Filter by date"
      >
        <option value="all">All time</option>
        <option value="week">This week</option>
        <option value="month">This month</option>
        <option value="3months">Last 3 months</option>
      </select>

      {/* Active filter indicator + clear */}
      {isActive && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">
            {filtered} of {total}
          </span>
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const [version, setVersion] = useState(0);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAppointments()
      .then((rows) => {
        if (!cancelled) setAppointments(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    if (appointments.length === 0) return undefined;
    const poll = async () => {
      const updates = await Promise.all(
        appointments
          .filter((a) => a.join_state !== "expired" && a.status !== "cancelled")
          .map(async (apt) => {
            try {
              return { id: apt.id, join: await getAppointmentJoinState(apt.id) };
            } catch {
              return null;
            }
          }),
      );
      setAppointments((prev) =>
        prev.map((row) => {
          const hit = updates.find((u) => u && u.id === row.id);
          if (!hit) return row;
          return {
            ...row,
            join_state: hit.join.join_state,
            seconds_until_start: hit.join.seconds_until_start,
            seconds_until_end: hit.join.seconds_until_end,
            opponent_present: hit.join.opponent_present,
            pending_summon: hit.join.pending_summon,
            last_summon_at: hit.join.last_summon_at ?? row.last_summon_at,
            prior_join: hit.join.prior_join ?? row.prior_join,
            priority: hit.join.priority ?? row.priority,
            emergency_status: hit.join.emergency_status ?? row.emergency_status,
            emergency_reason: hit.join.emergency_reason ?? row.emergency_reason,
            status: (hit.join.status as AppointmentRecord["status"]) ?? row.status,
          };
        }),
      );
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 8_000);
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [appointments.map((a) => a.id).join(",")]);

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (a.counterpart_name ?? a.citizen_name ?? "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (statusFilter === "upcoming" && !["requested", "confirmed", "live"].includes(a.status))
        return false;
      if (statusFilter === "completed" && a.status !== "completed") return false;
      if (statusFilter === "cancelled" && !["cancelled", "expired", "no_show"].includes(a.status))
        return false;
      if (dateFilter !== "all" && a.scheduled_at) {
        const days = ({ week: 7, month: 30, "3months": 90 } as const)[dateFilter];
        const cutoff = Date.now() - days * 86_400_000;
        if (new Date(a.scheduled_at).getTime() < cutoff) return false;
      }
      return true;
    });
  }, [appointments, search, statusFilter, dateFilter]);

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5 px-5 pb-8 md:px-0 md:pt-2">
      <div>
        <h1 className="text-[1.4rem] font-semibold tracking-tight">My Consultations</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Your upcoming and past appointments.
        </p>
      </div>

      {!loading && (
        <FilterBar
          search={search}
          onSearch={setSearch}
          status={statusFilter}
          onStatus={setStatusFilter}
          date={dateFilter}
          onDate={setDateFilter}
          total={appointments.length}
          filtered={filtered.length}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <AppointmentList
          appointments={filtered}
          onChanged={() => setVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}
