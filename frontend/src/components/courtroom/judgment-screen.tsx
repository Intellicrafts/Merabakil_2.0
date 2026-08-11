"use client";

import { Download, FileJson, History, Scale } from "lucide-react";

import {
  ActionPlanPanel,
  downloadActionPlan,
} from "@/components/courtroom/action-plan-panel";
import { ValidationMeters } from "@/components/courtroom/validation-meters";
import { CitationsPanel } from "@/components/courtroom/citations-panel";
import { buildJudgmentPdf, downloadPdf } from "@/lib/courtroom/pdf-report";
import type {
  ActionPlanStatus,
  JudgmentReport,
  ProposedActionPlan,
} from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface JudgmentScreenProps {
  report: JudgmentReport;
  onDownload: () => void;
  onDownloadJson?: () => void;
  onNewSession: () => void;
  showBilingual?: boolean;
  actionPlanStatus?: ActionPlanStatus;
  actionPlan?: ProposedActionPlan | null;
  checkedActionIds?: string[];
  onToggleActionChecked?: (id: string) => void;
  onRetryActions?: () => void;
  onCopyActionPlan?: () => void;
  /** Viewing a run loaded from local archive (not a live hearing). */
  isReviewMode?: boolean;
  savedAt?: string | null;
}

export function JudgmentScreen({
  report,
  onDownload,
  onDownloadJson,
  onNewSession,
  showBilingual = true,
  actionPlanStatus = "idle",
  actionPlan = null,
  checkedActionIds = [],
  onToggleActionChecked,
  onRetryActions,
  onCopyActionPlan,
  isReviewMode = false,
  savedAt = null,
}: JudgmentScreenProps) {
  const hasHi =
    showBilingual &&
    Boolean(
      report.findingsOfFactHi?.length ||
        report.legalReasoningHi ||
        report.dispositionHi,
    );

  return (
    <div
      id="courtroom-judgment"
      className={cn(
        "space-y-5 rounded-2xl border border-stone-300/40 bg-gradient-to-b from-stone-50/90 to-white/70 p-5 backdrop-blur-xl sm:p-6",
        "dark:border-white/12 dark:from-white/[0.06] dark:to-white/[0.02]",
        "cs-bench-elevated cs-card-in",
      )}
    >
      {isReviewMode && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-700/15 bg-amber-500/[0.07] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-200/15 dark:bg-amber-400/[0.08]">
          <div className="flex items-start gap-2">
            <History className="mt-0.5 h-4 w-4 shrink-0 text-amber-800/80 dark:text-amber-200/80" />
            <div>
              <p className="text-[12px] font-semibold text-amber-950/90 dark:text-amber-50/90">
                Saved simulation
              </p>
              <p className="text-[11px] text-amber-900/70 dark:text-amber-100/65">
                {savedAt
                  ? `Stored on this device · ${new Date(savedAt).toLocaleString()}`
                  : "Stored on this device — not a live hearing."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNewSession}
            className="cs-btn-soft h-9 shrink-0 rounded-xl px-3 text-[12px] font-semibold"
          >
            Back to prepare
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-stone-300/50 bg-stone-800 text-stone-50 dark:bg-stone-200 dark:text-stone-900">
            <Scale className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Simulated Indian court order
            </p>
            <h2 className="mt-0.5 text-[1.2rem] font-semibold tracking-tight sm:text-[1.35rem]">
              {report.matterTitle}
            </h2>
            <p className="mt-1 text-[12px] font-medium text-stone-700 dark:text-stone-300">
              <span className="text-muted-foreground">Operative portion — </span>
              {report.disposition}
            </p>
            {hasHi && report.dispositionHi && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">{report.dispositionHi}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDownload}
            className="cs-btn-accent h-10 rounded-xl px-4 text-[13px] font-semibold"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
          {onDownloadJson && (
            <button
              type="button"
              onClick={onDownloadJson}
              className="cs-btn-soft h-10 rounded-xl px-4 text-[13px] font-semibold"
            >
              <FileJson className="h-4 w-4" />
              Export JSON
            </button>
          )}
          <button
            type="button"
            onClick={onNewSession}
            className="cs-btn-soft h-10 rounded-xl px-4 text-[13px] font-semibold"
          >
            New session
          </button>
        </div>
      </div>

      {(actionPlanStatus === "loading" ||
        actionPlanStatus === "ready" ||
        actionPlanStatus === "error") &&
        onToggleActionChecked && (
          <ActionPlanPanel
            status={actionPlanStatus}
            plan={actionPlan}
            fallbackNextSteps={report.nextSteps}
            checkedIds={checkedActionIds}
            onToggleChecked={onToggleActionChecked}
            onRetry={onRetryActions}
            onDownload={actionPlan ? () => downloadActionPlan(actionPlan) : undefined}
            onCopyAll={onCopyActionPlan}
          />
        )}

      {(report.oralVerdict || report.issuesFramed?.length) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {report.oralVerdict && (
            <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Oral pronouncement in open court
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{report.oralVerdict}</p>
              {showBilingual && report.oralVerdictHi && (
                <p className="mt-2 text-[12px] text-muted-foreground">{report.oralVerdictHi}</p>
              )}
            </section>
          )}
          {report.issuesFramed && report.issuesFramed.length > 0 && (
            <section className="rounded-xl border border-black/[0.05] bg-white/60 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Issues framed
              </h3>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-[12px]">
                {report.issuesFramed.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}

      {report.coverageSummary && (
        <section className="rounded-xl border border-black/[0.05] bg-white/60 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Coverage summary{typeof report.coveragePercent === "number" ? ` · ${report.coveragePercent}%` : ""}
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{report.coverageSummary}</p>
        </section>
      )}

      {(report.strongestPetitioner?.length ||
        report.strongestRespondent?.length ||
        report.weaknessesExposed?.length) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {report.strongestPetitioner && report.strongestPetitioner.length > 0 && (
            <section className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Strongest petitioner points
              </h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-[12px]">
                {report.strongestPetitioner.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}
          {report.strongestRespondent && report.strongestRespondent.length > 0 && (
            <section className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Strongest respondent points
              </h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-[12px]">
                {report.strongestRespondent.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}
          {report.weaknessesExposed && report.weaknessesExposed.length > 0 && (
            <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Weaknesses exposed
              </h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-[12px]">
                {report.weaknessesExposed.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {report.intakeSummary && (
        <section className="rounded-xl border border-black/[0.05] bg-white/60 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Intake appendix
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{report.intakeSummary}</p>
        </section>
      )}

      {report.agentSummaries && report.agentSummaries.length > 0 && (
        <section className="rounded-xl border border-black/[0.05] bg-white/60 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Agent personas used
          </h3>
          <ul className="space-y-1">
            {report.agentSummaries.map((s, i) => (
              <li key={i} className="text-[12px] text-foreground/85">
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.timelineSteps && (
        <div className="flex flex-wrap gap-1.5">
          {report.timelineSteps.map((step) => (
            <span
              key={step}
              className="rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-0.5 text-[10px] font-medium capitalize dark:border-white/10 dark:bg-white/[0.04]"
            >
              {step}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2 rounded-xl border border-black/[0.05] bg-white/60 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Findings of fact
          </h3>
          <ul className="list-inside list-disc space-y-1.5 text-[13px] leading-relaxed">
            {report.findingsOfFact.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          {hasHi && report.findingsOfFactHi && (
            <ul className="mt-3 list-inside list-disc space-y-1.5 border-t border-black/[0.04] pt-3 text-[13px] leading-relaxed text-muted-foreground dark:border-white/[0.06]">
              {report.findingsOfFactHi.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-2 rounded-xl border border-black/[0.05] bg-white/60 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Legal reasoning
          </h3>
          <p className="text-[13px] leading-relaxed text-foreground/90">{report.legalReasoning}</p>
          {hasHi && report.legalReasoningHi && (
            <p className="mt-3 border-t border-black/[0.04] pt-3 text-[13px] leading-relaxed text-muted-foreground dark:border-white/[0.06]">
              {report.legalReasoningHi}
            </p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <ValidationMeters metrics={report.confidence} />
        <CitationsPanel authorities={report.authorities} />
      </div>

      {!actionPlan && report.nextSteps.length > 0 && (
        <section className="rounded-xl border border-black/[0.05] bg-white/60 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Recommended next steps
          </h3>
          <ul className="space-y-1.5">
            {report.nextSteps.map((step, i) => (
              <li key={i} className="flex gap-2 text-[13px]">
                <span className="font-semibold tabular-nums text-muted-foreground">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
          {hasHi && report.nextStepsHi && (
            <ul className="mt-3 space-y-1.5 border-t border-black/[0.04] pt-3 dark:border-white/[0.06]">
              {report.nextStepsHi.map((step, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-muted-foreground">
                  <span className="font-semibold tabular-nums">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Generated {new Date(report.generatedAt).toLocaleString()} · AI Courtroom Simulation — not binding
        legal advice
      </p>
    </div>
  );
}

export function buildJudgmentMarkdown(
  report: JudgmentReport,
  actionPlan?: ProposedActionPlan | null,
): string {
  const lines = [
    `# Simulated Indian Court Order: ${report.matterTitle}`,
    "",
    `**Operative portion:** ${report.disposition}`,
    report.dispositionHi ? `**Operative portion (HI):** ${report.dispositionHi}` : "",
    "",
    report.oralVerdict ? `## Oral Pronouncement\n${report.oralVerdict}\n` : "",
    report.oralVerdictHi ? `### Hindi\n${report.oralVerdictHi}\n` : "",
    report.issuesFramed?.length
      ? `## Issues Framed\n${report.issuesFramed.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n`
      : "",
    report.intakeSummary ? `## Intake Summary\n${report.intakeSummary}\n` : "",
    report.coverageSummary
      ? `## Coverage (${report.coveragePercent ?? "—"}%)\n${report.coverageSummary}\n`
      : "",
    report.strongestPetitioner?.length
      ? `## Strongest Petitioner Points\n${report.strongestPetitioner.map((s) => `- ${s}`).join("\n")}\n`
      : "",
    report.strongestRespondent?.length
      ? `## Strongest Respondent Points\n${report.strongestRespondent.map((s) => `- ${s}`).join("\n")}\n`
      : "",
    report.weaknessesExposed?.length
      ? `## Weaknesses Exposed\n${report.weaknessesExposed.map((s) => `- ${s}`).join("\n")}\n`
      : "",
    "## Findings of Fact",
    ...report.findingsOfFact.map((f) => `- ${f}`),
    ...(report.findingsOfFactHi?.map((f) => `- (HI) ${f}`) ?? []),
    "",
    "## Legal Reasoning",
    report.legalReasoning,
    report.legalReasoningHi ? `\n### Hindi\n${report.legalReasoningHi}` : "",
    "",
    "## Confidence Scores",
    `- Argument strength: ${Math.round(report.confidence.argumentStrength * 100)}%`,
    `- Evidence support: ${Math.round(report.confidence.evidenceSupport * 100)}%`,
    `- Procedural compliance: ${Math.round(report.confidence.proceduralCompliance * 100)}%`,
    "",
    "## Cited Authorities",
    ...report.authorities.map((a) => `- [${a.marker}] ${a.title} — ${a.citation}`),
    "",
    "## Recommended Next Steps",
    ...report.nextSteps.map((s, i) => `${i + 1}. ${s}`),
    ...(report.nextStepsHi?.map((s, i) => `${i + 1}. (HI) ${s}`) ?? []),
    "",
    actionPlan
      ? [
          "## Post-hearing Action Plan",
          actionPlan.headline,
          actionPlan.summary,
          "",
          ...actionPlan.actions.map(
            (a, i) =>
              `${i + 1}. [${a.priority}] ${a.title} (${a.timeframe}, ${a.side})\n   ${a.description}`,
          ),
          "",
        ].join("\n")
      : "",
    `*Generated ${report.generatedAt} — AI Courtroom Simulation (not a real court)*`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function downloadJudgmentReport(
  report: JudgmentReport,
  actionPlan?: ProposedActionPlan | null,
) {
  const doc = buildJudgmentPdf(report, actionPlan);
  downloadPdf(doc, `courtroom-judgment-${Date.now()}.pdf`);
}

export function downloadJudgmentJson(report: JudgmentReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `courtroom-judgment-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
