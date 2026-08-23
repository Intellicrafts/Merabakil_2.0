"use client";

import type { CallMode, IncomingCallPayload } from "@/lib/appointment-types";
import { playCallRingtone, showBrowserNotification, stopCallRingtone } from "@/lib/room-alerts";

export type ActiveCallState =
  | { phase: "idle" }
  | {
      phase: "incoming_ring" | "outgoing_ring";
      appointmentId: string;
      callId: string;
      mode: CallMode;
      counterpartName: string;
      callerUserId?: string;
    }
  | {
      phase: "in_call";
      appointmentId: string;
      callId: string;
      mode: CallMode;
      counterpartName: string;
    };

type Listener = () => void;

let state: ActiveCallState = { phase: "idle" };
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

function isRinging(phase: ActiveCallState["phase"]) {
  return phase === "incoming_ring" || phase === "outgoing_ring";
}

export const callHub = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getState(): ActiveCallState {
    return state;
  },

  clear() {
    if (isRinging(state.phase)) stopCallRingtone();
    state = { phase: "idle" };
    emit();
  },

  startOutgoing(params: {
    appointmentId: string;
    callId: string;
    mode: CallMode;
    counterpartName: string;
  }) {
    stopCallRingtone();
    state = { phase: "outgoing_ring", ...params };
    emit();
  },

  ingestIncoming(payload: IncomingCallPayload, options?: { inRoom?: boolean }) {
    if (state.phase === "in_call") return;
    const same =
      state.phase !== "idle" &&
      state.callId === payload.call_id &&
      state.appointmentId === payload.appointment_id;
    if (same && state.phase === "incoming_ring") return;

    stopCallRingtone();
    void playCallRingtone();
    state = {
      phase: "incoming_ring",
      appointmentId: payload.appointment_id,
      callId: payload.call_id,
      mode: payload.mode,
      counterpartName: payload.caller_name,
      callerUserId: payload.caller_user_id,
    };
    emit();

    if (!options?.inRoom && typeof document !== "undefined" && document.hidden) {
      const label = payload.mode === "video" ? "Video call" : "Audio call";
      showBrowserNotification(`${label} from ${payload.caller_name}`, "Tap to answer in the consultation room.", payload.appointment_id);
    }
  },

  onAccepted(payload: IncomingCallPayload, counterpartName: string) {
    stopCallRingtone();
    state = {
      phase: "in_call",
      appointmentId: payload.appointment_id,
      callId: payload.call_id,
      mode: payload.mode,
      counterpartName,
    };
    emit();
  },

  onDeclinedOrCancelled() {
    if (isRinging(state.phase)) stopCallRingtone();
    state = { phase: "idle" };
    emit();
  },

  onEnded() {
    if (isRinging(state.phase)) stopCallRingtone();
    state = { phase: "idle" };
    emit();
  },
};
