import { SEED_CASES } from "@/lib/mock/cases";
import type { CaseStatus, LegalCase } from "@/lib/types";

const CASES_KEY = "legalos.cases";

function readUserCases(): LegalCase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CASES_KEY);
    return raw ? (JSON.parse(raw) as LegalCase[]) : [];
  } catch {
    return [];
  }
}

function writeUserCases(items: LegalCase[]): void {
  window.localStorage.setItem(CASES_KEY, JSON.stringify(items));
}

function mergeCases(): LegalCase[] {
  const userCases = readUserCases();
  const userIds = new Set(userCases.map((c) => c.id));
  const seeds = SEED_CASES.filter((c) => !userIds.has(c.id));
  return [...userCases, ...seeds].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

function persistCase(updated: LegalCase): LegalCase {
  const userCases = readUserCases();
  const idx = userCases.findIndex((c) => c.id === updated.id);
  if (idx >= 0) {
    userCases[idx] = updated;
  } else {
    const seed = SEED_CASES.find((c) => c.id === updated.id);
    if (seed) {
      userCases.unshift(updated);
    } else {
      userCases.unshift(updated);
    }
  }
  writeUserCases(userCases);
  return updated;
}

export function listCases(status?: CaseStatus | "all"): LegalCase[] {
  const all = mergeCases();
  if (!status || status === "all") return all;
  return all.filter((c) => c.status === status);
}

export function getCase(id: string): LegalCase | null {
  return mergeCases().find((c) => c.id === id) ?? null;
}

export function createCase(input: {
  title: string;
  description: string;
  case_number: string;
  court: string;
  jurisdiction: string;
  practice_area: string;
  linked_appointment_id?: string | null;
}): LegalCase {
  const now = new Date().toISOString();
  const item: LegalCase = {
    id: `case-${crypto.randomUUID()}`,
    title: input.title.trim(),
    description: input.description.trim(),
    case_number: input.case_number.trim(),
    court: input.court.trim(),
    jurisdiction: input.jurisdiction.trim(),
    practice_area: input.practice_area.trim(),
    status: "open",
    created_at: now,
    updated_at: now,
    linked_appointment_id: input.linked_appointment_id ?? null,
    timeline: [
      {
        id: `ev-${crypto.randomUUID()}`,
        label: "Case filed",
        description: "Case created in Case Management.",
        at: now,
      },
    ],
  };
  const userCases = readUserCases();
  userCases.unshift(item);
  writeUserCases(userCases);
  return item;
}

export function updateCaseStatus(id: string, status: CaseStatus): LegalCase {
  const existing = getCase(id);
  if (!existing) throw new Error("Case not found");

  const now = new Date().toISOString();
  const labels: Record<CaseStatus, string> = {
    open: "Status set to open",
    in_progress: "Status set to in progress",
    closed: "Case closed",
  };

  const updated: LegalCase = {
    ...existing,
    status,
    updated_at: now,
    timeline: [
      ...existing.timeline,
      {
        id: `ev-${crypto.randomUUID()}`,
        label: labels[status],
        description: `Case status updated to ${status.replace("_", " ")}.`,
        at: now,
      },
    ],
  };

  return persistCase(updated);
}
