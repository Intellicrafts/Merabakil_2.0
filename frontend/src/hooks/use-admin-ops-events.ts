"use client";

import { useEffect, useRef, useState } from "react";

import { getToken } from "@/lib/api";
import { marketplaceServiceUrl } from "@/lib/service-urls";
import type { AdminOpsEvent } from "@/lib/appointment-types";

function parseBlocks(buffer: string): { events: AdminOpsEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: AdminOpsEvent[] = [];
  for (const block of parts) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!data) continue;
    try {
      const parsed = JSON.parse(data) as AdminOpsEvent;
      if (parsed && typeof parsed.type === "string") events.push(parsed);
    } catch {
      /* ignore malformed frames */
    }
  }
  return { events, rest };
}

export function useAdminOpsEvents(onEvent: (event: AdminOpsEvent) => void): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

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
          const res = await fetch(`${marketplaceServiceUrl()}/api/v1/admin/ops-events`, {
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
              }
              if (event.type !== "join") onEventRef.current(event);
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
