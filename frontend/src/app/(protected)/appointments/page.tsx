"use client";

import { useEffect, useState } from "react";

import { AppointmentList } from "@/components/lawyer-marketplace/appointment-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getAppointmentJoinState, listAppointments } from "@/lib/api";
import type { AppointmentRecord } from "@/lib/appointment-types";

export default function AppointmentsPage() {
  const [version, setVersion] = useState(0);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5 px-5 pb-8 md:px-0 md:pt-2">
      <div>
        <h1 className="text-[1.4rem] font-semibold tracking-tight">My Consultations</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Your upcoming and past appointments.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <AppointmentList
          appointments={appointments}
          onChanged={() => setVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}
