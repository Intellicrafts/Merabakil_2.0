import type {
  ConfidenceMethodology,
  Exhibit,
  HearingAgendaItem,
  HearingMetrics,
  LegalAuthority,
  ObjectionEvent,
} from "@/lib/courtroom/types";
import { coveragePercent } from "@/lib/courtroom/hearing-agenda";

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function deriveHearingMetrics(opts: {
  agenda: HearingAgendaItem[];
  authorities: LegalAuthority[];
  exhibits: Exhibit[];
  objections: ObjectionEvent[];
}): { metrics: HearingMetrics; methodology: ConfidenceMethodology } {
  const { agenda, authorities, exhibits, objections } = opts;

  const contestedPct = agenda.length ? coveragePercent(agenda) / 100 : 0;

  const verified = authorities.filter((a) => a.verified).length;
  const citesVerifiedPct = authorities.length ? verified / authorities.length : 0.5;

  const usable = exhibits.filter((e) => e.status === "admitted" || e.status === "marked");
  const exhibitsAdmittedPct = exhibits.length
    ? exhibits.filter((e) => e.status === "admitted").length / exhibits.length
    : 0.4;

  const ruled = objections.filter((o) => o.ruling === "sustained" || o.ruling === "overruled");
  const sustained = ruled.filter((o) => o.ruling === "sustained").length;
  const objectionSustainRate = ruled.length ? sustained / ruled.length : 0.5;

  // Argument strength ≈ how much of the agenda was truly contested
  const argumentStrength = clamp01(0.25 + contestedPct * 0.65 + citesVerifiedPct * 0.1);
  // Evidence ≈ admitted/marked exhibits + verified cites
  const evidenceSupport = clamp01(
    0.2 + exhibitsAdmittedPct * 0.45 + (usable.length ? 0.15 : 0) + citesVerifiedPct * 0.2,
  );
  // Procedure ≈ objections handled + phase discipline proxy from contested coverage
  const proceduralCompliance = clamp01(
    0.55 + (ruled.length ? 0.15 : 0.05) + contestedPct * 0.2 + (1 - Math.abs(objectionSustainRate - 0.45)) * 0.05,
  );

  const methodology: ConfidenceMethodology = {
    summary:
      "Scored from observables: % agenda contested/resolved, % citations verified against corpus/docs/web, % exhibits admitted, and objection outcomes — not raw model self-scores.",
    agendaContestedPct: Math.round(contestedPct * 100),
    citesVerifiedPct: Math.round(citesVerifiedPct * 100),
    exhibitsAdmittedPct: Math.round(exhibitsAdmittedPct * 100),
    objectionSustainRate: Math.round(objectionSustainRate * 100),
  };

  return {
    metrics: { argumentStrength, evidenceSupport, proceduralCompliance },
    methodology,
  };
}

export function authoritiesQuality(authorities: LegalAuthority[]) {
  const verifiedCount = authorities.filter((a) => a.verified).length;
  const unverifiedCount = authorities.length - verifiedCount;
  const caveat =
    unverifiedCount > 0
      ? `${unverifiedCount} citation(s) were not matched to retrieved corpus/document/web sources and should be treated with caution.`
      : authorities.length === 0
        ? "No authorities were cited during the hearing."
        : "All listed authorities were matched to retrieved sources for this simulation.";
  return { verifiedCount, unverifiedCount, caveat };
}
