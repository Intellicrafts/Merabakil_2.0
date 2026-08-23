"use client";

import { useSyncExternalStore } from "react";

import { callHub, type ActiveCallState } from "@/lib/call-hub";

export function useCallHubState(): ActiveCallState {
  return useSyncExternalStore(
    (onStoreChange) => callHub.subscribe(onStoreChange),
    () => callHub.getState(),
    () => ({ phase: "idle" }),
  );
}
