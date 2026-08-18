import type {
  CaseIntakeBundle,
  CourtroomSessionConfig,
  HearingAgendaItem,
} from "@/lib/courtroom/types";

function splitPoints(raw: string): string[] {
  return raw
    .split(/[\n;•]+|(?<=\.)\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12)
    .slice(0, 8);
}

export function buildCoverageAgenda(
  config: CourtroomSessionConfig,
  intake?: CaseIntakeBundle,
): HearingAgendaItem[] {
  const items: HearingAgendaItem[] = [];
  let n = 0;
  const push = (label: string, source: HearingAgendaItem["source"]) => {
    const clean = label.replace(/\s+/g, " ").trim();
    if (!clean || items.some((i) => i.label.toLowerCase() === clean.toLowerCase())) return;
    n += 1;
    items.push({ id: `pt-${n}`, label: clean.slice(0, 160), source, status: "pending" });
  };

  if (intake?.facts) splitPoints(intake.facts).forEach((p) => push(p, "facts"));
  if (intake?.issues) splitPoints(intake.issues).forEach((p) => push(p, "issues"));
  if (intake?.reliefSought) push(`Relief sought: ${intake.reliefSought}`, "relief");
  if (intake?.brief && items.length < 3) {
    splitPoints(intake.brief).slice(0, 3).forEach((p) => push(p, "matter"));
  }

  config.exhibits.forEach((ex) => {
    push(`Exhibit on record: ${ex.title}`, "exhibit");
  });

  if (items.length === 0) {
    push(`${config.matterType} liability and breach on the pleaded facts`, "matter");
    push("Evidentiary support and documentary proof", "facts");
    push("Relief, interim protection, and alternative remedies", "relief");
  }

  return items.slice(0, 12);
}

export function uncoveredPoints(agenda: HearingAgendaItem[]): HearingAgendaItem[] {
  return agenda.filter((a) => a.status === "pending" || a.status === "raised");
}

export function coveragePercent(agenda: HearingAgendaItem[]): number {
  if (!agenda.length) return 0;
  const done = agenda.filter((a) => a.status === "contested" || a.status === "resolved").length;
  return Math.round((done / agenda.length) * 100);
}

export function markAgendaPoints(
  agenda: HearingAgendaItem[],
  pointIds: string[] | undefined,
  speaker: "petitioner" | "respondent" | "judge" | "clerk",
): HearingAgendaItem[] {
  if (!pointIds?.length) return agenda;
  return agenda.map((item) => {
    if (!pointIds.includes(item.id)) return item;
    if (speaker === "judge") {
      return { ...item, status: item.status === "pending" ? "raised" : item.status };
    }
    if (item.status === "pending") return { ...item, status: "raised" };
    if (item.status === "raised") return { ...item, status: "contested" };
    return item;
  });
}

export function notCoveredPoints(agenda: HearingAgendaItem[]): HearingAgendaItem[] {
  return agenda.filter((a) => a.status === "pending" || a.status === "raised");
}

export function coveredPoints(agenda: HearingAgendaItem[]): HearingAgendaItem[] {
  return agenda.filter((a) => a.status === "contested" || a.status === "resolved");
}

/** @deprecated Do not use for coverage reporting — kept only for mock demos. */
export function forceResolvePending(agenda: HearingAgendaItem[]): HearingAgendaItem[] {
  return agenda.map((a) =>
    a.status === "pending" || a.status === "raised" ? { ...a, status: "contested" } : a,
  );
}
