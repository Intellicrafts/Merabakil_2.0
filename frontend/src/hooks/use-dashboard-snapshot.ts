"use client";

import { useCallback, useEffect, useState } from "react";

import { listCases } from "@/lib/cases-store";
import {
  loadActiveConversationId,
  loadConversations,
  type ChatConversation,
} from "@/lib/conversations";
import type { LegalCase } from "@/lib/types";

const CONV_KEY = "legalos.meravakil.conversations";
const ACTIVE_KEY = "legalos.meravakil.active-id";
const CASES_KEY = "legalos.cases";

export interface DashboardSnapshot {
  ready: boolean;
  conversations: ChatConversation[];
  recent: ChatConversation[];
  pinnedCount: number;
  lastCounsel: ChatConversation | null;
  cases: LegalCase[];
  openCount: number;
  upcoming: LegalCase[];
}

const EMPTY: DashboardSnapshot = {
  ready: false,
  conversations: [],
  recent: [],
  pinnedCount: 0,
  lastCounsel: null,
  cases: [],
  openCount: 0,
  upcoming: [],
};

function byUpdatedDesc<T extends { updatedAt?: string; updated_at?: string }>(a: T, b: T): number {
  const ta = new Date(a.updatedAt ?? a.updated_at ?? 0).getTime();
  const tb = new Date(b.updatedAt ?? b.updated_at ?? 0).getTime();
  return tb - ta;
}

function readSnapshot(): Omit<DashboardSnapshot, "ready"> {
  const conversations = loadConversations();
  const sorted = [...conversations].sort(byUpdatedDesc);
  const recent = sorted.slice(0, 5);
  const pinnedCount = conversations.filter((c) => Boolean(c.pinned)).length;

  const activeId = loadActiveConversationId();
  const active = activeId ? conversations.find((c) => c.id === activeId) : undefined;
  const lastWithMessages = sorted.find((c) => c.messages.length > 0) ?? null;
  const lastCounsel =
    active && active.messages.length > 0 ? active : lastWithMessages;

  const cases = listCases();
  const live = cases.filter((c) => c.status === "open" || c.status === "in_progress");
  const upcoming = [...live].sort(byUpdatedDesc).slice(0, 3);

  return {
    conversations,
    recent,
    pinnedCount,
    lastCounsel,
    cases,
    openCount: live.length,
    upcoming,
  };
}

export function useDashboardSnapshot(): DashboardSnapshot {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY);

  const refresh = useCallback(() => {
    setSnapshot({ ready: true, ...readSnapshot() });
  }, []);

  useEffect(() => {
    refresh();

    function onVisibility() {
      if (document.visibilityState === "visible") refresh();
    }

    function onStorage(event: StorageEvent) {
      if (!event.key || event.key === CONV_KEY || event.key === ACTIVE_KEY || event.key === CASES_KEY) {
        refresh();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return snapshot;
}
