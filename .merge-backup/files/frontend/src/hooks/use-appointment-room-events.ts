"use client";

import { useEffect, useRef, useState } from "react";

import { getToken } from "@/lib/api";
import { marketplaceServiceUrl } from "@/lib/service-urls";
import type { RoomStreamEvent } from "@/lib/appointment-types";

function parseBlocks(buffer: string): { events: RoomStreamEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: RoomStreamEvent[] = [];
  for (const block of parts) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!data) continue;
    try {
      const parsed = JSON.parse(data) as RoomStreamEvent;
      if (parsed && typeof parsed.type === "string") events.push(parsed);
    } catch {
      /* ignore malformed frames */
    }
  }
  return { events, rest };
}

export function useAppointmentRoomEvents(
  appointmentId: string,
  onEvent: (event: RoomStreamEvent) => void,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!appointmentId) return;
    let cancelled = false;
    let retry = 0;
    let controller: AbortController | null = null;

    async function connect() {
      while (!cancelled) {
        const token = getToken();
        if (!token) return;
        controller = new AbortController();
        try {
          const res = await fetch(`${marketplaceServiceUrl()}/api/v1/appointments/${appointmentId}/events`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
            signal: controller.signal,
            cache: "no-store",
          });
          if (!res.ok || !res.body) {
            throw new Error(`sse ${res.status}`);
          }
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
              }
              onEventRef.current(event);
            }
          }
        } catch (err) {
          if (cancelled || (err as Error).name === "AbortError") return;
        } finally {
          setConnected(false);
        }
        if (cancelled) return;
        const wait = Math.min(8000, 400 * 2 ** retry);
        retry += 1;
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }

    void connect();
    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [appointmentId]);

  return { connected };
}
