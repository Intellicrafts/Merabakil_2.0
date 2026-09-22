"use client";

import { useCallback, useEffect, useState } from "react";

import { listAppointments, listCasesApi, listUserDocuments } from "@/lib/api";
import type { AppointmentRecord } from "@/lib/appointment-types";
import {
  loadActiveConversationId,
  loadConversations,
  type ChatConversation,
} from "@/lib/conversations";
import type { LegalCase, UserDocument } from "@/lib/types";

const CONV_KEY = "legalos.meravakil.conversations";
const ACTIVE_KEY = "legalos.meravakil.active-id";

export interface DashboardSnapshot {
  ready: boolean;
  conversations: ChatConversation[];
  recent: ChatConversation[];
  pinnedCount: number;
  lastCounsel: ChatConversation | null;
  cases: LegalCase[];
  openCount: number;
  upcoming: LegalCase[];
  appointments: AppointmentRecord[];
  documents: UserDocument[];
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
  appointments: [],
  documents: [],
};

function byUpdatedDesc<T extends { updatedAt?: string; updated_at?: string }>(a: T, b: T): number {
  const ta = new Date(a.updatedAt ?? a.updated_at ?? 0).getTime();
  const tb = new Date(b.updatedAt ?? b.updated_at ?? 0).getTime();
  return tb - ta;
}

function readLocal(): Pick<
  DashboardSnapshot,
  "conversations" | "recent" | "pinnedCount" | "lastCounsel"
> {
  const conversations = loadConversations();
  const sorted = [...conversations].sort(byUpdatedDesc);
  const recent = sorted.slice(0, 5);
  const pinnedCount = conversations.filter((c) => Boolean(c.pinned)).length;

  const activeId = loadActiveConversationId();
  const active = activeId ? conversations.find((c) => c.id === activeId) : undefined;
  const lastWithMessages = sorted.find((c) => c.messages.length > 0) ?? null;
  const lastCounsel = active && active.messages.length > 0 ? active : lastWithMessages;

  return { conversations, recent, pinnedCount, lastCounsel };
}

async function readRemote(): Promise<
  Pick<DashboardSnapshot, "appointments" | "documents" | "cases" | "openCount" | "upcoming">
> {
  const [appointments, docsPage, casesPage] = await Promise.all([
    listAppointments().catch(() => [] as AppointmentRecord[]),
    listUserDocuments(1, 12).catch(() => null),
    listCasesApi(null, 1, 100).catch(() => null),
  ]);

  const cases = casesPage?.items ?? [];
  const live = cases.filter((c) => c.status === "open" || c.status === "in_progress");
  const upcoming = [...live].sort(byUpdatedDesc).slice(0, 3);

  return {
    appointments,
    documents: docsPage?.items ?? [],
    cases,
    openCount: live.length,
    upcoming,
  };
}

export function useDashboardSnapshot(): DashboardSnapshot {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY);

  const refreshLocal = useCallback(() => {
    setSnapshot((prev) => ({
      ...prev,
      ready: true,
      ...readLocal(),
    }));
  }, []);

  useEffect(() => {
    refreshLocal();

    let cancelled = false;
    void readRemote().then((remote) => {
      if (cancelled) return;
      setSnapshot((prev) => ({ ...prev, ready: true, ...remote }));
    });

    function onVisibility() {
      if (document.visibilityState === "visible") {
        refreshLocal();
        void readRemote().then((remote) => {
          if (cancelled) return;
          setSnapshot((prev) => ({ ...prev, ...remote }));
        });
      }
    }

    function onStorage(event: StorageEvent) {
      if (!event.key || event.key === CONV_KEY || event.key === ACTIVE_KEY) {
        refreshLocal();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshLocal);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshLocal);
    };
  }, [refreshLocal]);

  return snapshot;
}
