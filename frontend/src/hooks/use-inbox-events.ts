"use client";

import { useEffect, useRef, useState } from "react";

import { getToken } from "@/lib/api";
import { marketplaceServiceUrl } from "@/lib/service-urls";
import type { IncomingCallPayload, SummonAlertPayload } from "@/lib/appointment-types";

export interface InboxSummonEvent {
  appointmentId: string;
  fromName: string;
  lastSummonAt: string;
  counterpartName?: string;
}

export interface InboxStreamEvent {
  type: string;
  appointment_id?: string;
  payload?: SummonAlertPayload | IncomingCallPayload | Record<string, unknown>;
}

function parseBlocks(buffer: string): { events: InboxStreamEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: InboxStreamEvent[] = [];
  for (const block of parts) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!data) continue;
    try {
      const parsed = JSON.parse(data) as InboxStreamEvent;
      if (parsed?.type) events.push(parsed);
    } catch {
      /* ignore */
    }
  }
  return { events, rest };
}

export function useInboxEvents(
  onSummon: (event: InboxSummonEvent) => void,
  onEvent?: (event: InboxStreamEvent) => void,
  onIncomingCall?: (payload: IncomingCallPayload) => void,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onSummonRef = useRef(onSummon);
  const onEventRef = useRef(onEvent);
  const onIncomingCallRef = useRef(onIncomingCall);
  onSummonRef.current = onSummon;
  onEventRef.current = onEvent;
  onIncomingCallRef.current = onIncomingCall;

  useEffect(() => {
    let cancelled = false;
    let retry = 0;
    let controller: AbortController | null = null;

    async function connect() {
      while (!cancelled) {
        const token = getToken();
        if (!token) return;
        controller = new AbortController();
        try {
          const res = await fetch(`${marketplaceServiceUrl()}/api/v1/appointments/inbox/events`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
            signal: controller.signal,
            cache: "no-store",
          });
          if (!res.ok || !res.body) throw new Error(`sse ${res.status}`);
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let joined = false;
          while (!cancelled) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parsed = parseBlocks(buffer);
            buffer = parsed.rest;
            for (const event of parsed.events) {
              if (event.type === "join" && !joined) {
                joined = true;
                setConnected(true);
                retry = 0;
                continue;
              }
              if (event.type === "summon" && event.appointment_id && event.payload) {
                const payload = event.payload as SummonAlertPayload;
                const lastSummonAt = payload.last_summon_at;
                if (lastSummonAt) {
                  onSummonRef.current({
                    appointmentId: event.appointment_id,
                    fromName: payload.from_name || "Your counterpart",
                    lastSummonAt,
                    counterpartName: payload.from_name,
                  });
                }
              }
              if (event.type === "incoming_call" && event.payload) {
                onIncomingCallRef.current?.(event.payload as IncomingCallPayload);
              }
              if (event.type !== "join") onEventRef.current?.(event);
            }
          }
        } catch (err) {
          if (cancelled || (err as Error).name === "AbortError") return;
        } finally {
          setConnected(false);
        }
        retry += 1;
        await new Promise((r) => window.setTimeout(r, Math.min(8000, 500 + retry * 400)));
      }
    }

    void connect();
    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, []);

  return { connected };
}
