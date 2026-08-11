"use client";

import { Download, FileJson, Scale } from "lucide-react";

import { ValidationMeters } from "@/components/courtroom/validation-meters";
import { CitationsPanel } from "@/components/courtroom/citations-panel";
import type { JudgmentReport } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface JudgmentScreenProps {
  report: JudgmentReport;
  onDownload: () => void;
  onDownloadJson?: () => void;
  onNewSession: () => void;
  showBilingual?: boolean;
}

export function JudgmentScreen({
  report,
  onDownload,
  onDownloadJson,
  onNewSession,
  showBilingual = true,
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
      className={cn(
        "space-y-5 rounded-2xl border border-stone-300/40 bg-gradient-to-b from-stone-50/90 to-white/70 p-5 backdrop-blur-xl sm:p-6",
        "dark:border-white/12 dark:from-white/[0.06] dark:to-white/[0.02]",
        "cs-bench-elevated cs-card-in",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-stone-300/50 bg-stone-800 text-stone-50 dark:bg-stone-200 dark:text-stone-900">
            <Scale className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Simulated judgment
            </p>
            <h2 className="mt-0.5 text-[1.2rem] font-semibold tracking-tight sm:text-[1.35rem]">
              {report.matterTitle}
            </h2>
            <p className="mt-1 text-[12px] font-medium text-stone-700 dark:text-stone-300">
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
            Download report
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

      <p className="text-center text-[11px] text-muted-foreground">
        Generated {new Date(report.generatedAt).toLocaleString()} · AI Courtroom Simulation — not binding
        legal advice
      </p>
    </div>
  );
}

export function buildJudgmentMarkdown(report: JudgmentReport): string {
  const lines = [
    `# Simulated Judgment: ${report.matterTitle}`,
    "",
    `**Disposition:** ${report.disposition}`,
    report.dispositionHi ? `**Disposition (HI):** ${report.dispositionHi}` : "",
    "",
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
    `*Generated ${report.generatedAt} — AI Courtroom Simulation*`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function downloadJudgmentReport(report: JudgmentReport) {
  const md = buildJudgmentMarkdown(report);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `courtroom-judgment-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
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
