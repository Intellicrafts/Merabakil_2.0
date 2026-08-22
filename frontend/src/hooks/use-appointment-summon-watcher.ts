"use client";

import { useCallback, useEffect, useRef } from "react";

import type { AppointmentRecord } from "@/lib/appointment-types";
import { dismissSummonSignal, summonSignalKey } from "@/lib/summon-alerts";

export interface SummonAlertHit {
  id: string;
  counterpart_name: string;
  last_summon_at: string;
}

interface UseAppointmentSummonWatcherOptions {
  appointments: AppointmentRecord[];
  skipAppointmentId?: string;
  inRoomPath?: boolean;
  onSummon?: (hit: SummonAlertHit) => void;
}

/** Poll fallback only — pushes into notification hub via custom event. */
export function useAppointmentSummonWatcher({
  appointments,
  skipAppointmentId,
  inRoomPath = false,
  onSummon,
}: UseAppointmentSummonWatcherOptions): void {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const apt of appointments) {
      if (skipAppointmentId && apt.id === skipAppointmentId) continue;
      if (inRoomPath) continue;
      if (!apt.pending_summon || !apt.last_summon_at) continue;
      const key = `${apt.id}:${apt.last_summon_at}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);

      const hit: SummonAlertHit = {
        id: apt.id,
        counterpart_name: apt.counterpart_name,
        last_summon_at: apt.last_summon_at,
      };
      onSummon?.(hit);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("legalos:summon-alert", { detail: hit }));
      }
    }
  }, [appointments, inRoomPath, onSummon, skipAppointmentId]);
}

export function dismissSummonAlert(appointmentId: string, lastSummonAt: string): void {
  dismissSummonSignal(summonSignalKey(appointmentId, lastSummonAt));
}
