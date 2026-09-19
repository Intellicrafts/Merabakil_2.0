"use client";

import { useEffect, useMemo, useState } from "react";

import { AppointmentList } from "@/components/lawyer-marketplace/appointment-list";
import {
  ConsultationFilters,
  type ConsultationDateFilter,
  type ConsultationStatusFilter,
} from "@/components/lawyer-marketplace/consultation-filters";
import { ConsultationsHero } from "@/components/lawyer-marketplace/consultations-hero";
import { Skeleton } from "@/components/ui/skeleton";
import { getAppointmentJoinState, listAppointments } from "@/lib/api";
import type { AppointmentRecord } from "@/lib/appointment-types";

export default function AppointmentsPage() {
  const [version, setVersion] = useState(0);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConsultationStatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<ConsultationDateFilter>("all");

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
    const onChanged = () => setVersion((v) => v + 1);
    window.addEventListener("legalos:appointments-changed", onChanged);
    return () => window.removeEventListener("legalos:appointments-changed", onChanged);
  }, []);

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
    <div className="mx-auto w-full max-w-[1180px] space-y-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:space-y-5 sm:px-0 sm:pb-10">
      {!loading && <ConsultationsHero appointments={appointments} />}

      {!loading && (
        <ConsultationFilters
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
