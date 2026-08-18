"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ClipboardList,
  Copy,
  FileText,
  Gavel,
  Handshake,
  Loader2,
  Scale,
  Search,
  Shield,
} from "lucide-react";
import { useRouter } from "next/navigation";

import type {
  ActionPlanStatus,
  ProposedAction,
  ProposedActionPlan,
} from "@/lib/courtroom/types";
import { buildActionPlanPdf } from "@/lib/courtroom/pdf-report";
import { setMeraVakilPrefill, setResearchPrefill } from "@/lib/courtroom/session-store";
import { cn } from "@/lib/utils";

const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;

const PRIORITY_STYLE: Record<string, string> = {
  critical: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  high: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300",
  medium: "border-sky-500/25 bg-sky-500/10 text-sky-900 dark:text-sky-300",
  low: "border-stone-400/30 bg-stone-500/10 text-stone-700 dark:text-stone-300",
};

const CATEGORY_ICON: Record<string, typeof Scale> = {
  evidence: FileText,
  filing: Gavel,
  research: Search,
  settlement: Handshake,
  compliance: Shield,
  procedure: ClipboardList,
  defense: Shield,
  fact_proof: Scale,
};

function timeframeLabel(tf: string): string {
  switch (tf) {
    case "immediate":
      return "Immediate";
    case "7d":
      return "Within 7 days";
    case "30d":
      return "Within 30 days";
    case "before_next_listing":
      return "Before next listing";
    default:
      return tf;
  }
}

function sideLabel(side: string): string {
  if (side === "petitioner") return "Petitioner";
  if (side === "respondent") return "Respondent";
  return "Both sides";
}

interface ActionPlanPanelProps {
  status: ActionPlanStatus;
  plan: ProposedActionPlan | null;
  fallbackNextSteps?: string[];
  checkedIds: string[];
  onToggleChecked: (id: string) => void;
  onRetry?: () => void;
  onDownload?: () => void;
  onCopyAll?: () => void;
}

export function ActionPlanPanel({
  status,
  plan,
  fallbackNextSteps,
  checkedIds,
  onToggleChecked,
  onRetry,
  onDownload,
  onCopyAll,
}: ActionPlanPanelProps) {
  const router = useRouter();
  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);

  const grouped = useMemo(() => {
    if (!plan?.actions.length) return [];
    return PRIORITY_ORDER.map((p) => ({
      priority: p,
      items: plan.actions.filter((a) => a.priority === p),
    })).filter((g) => g.items.length > 0);
  }, [plan]);

  const runCta = (action: ProposedAction) => {
    const kind = action.cta?.kind ?? "copy";
    const query =
      action.cta?.query?.trim() ||
      `${action.title}. ${action.description}`.slice(0, 400);

    if (kind === "research") {
      setResearchPrefill(query);
      router.push(`/research?q=${encodeURIComponent(query)}`);
      return;
    }
    if (kind === "mera_vakil") {
      setMeraVakilPrefill(query);
      router.push("/mera-vakil");
      return;
    }
    void navigator.clipboard?.writeText(query);
  };

  return (
    <section
      className={cn(
        "space-y-4 rounded-2xl border border-stone-300/45 bg-gradient-to-b from-amber-50/40 to-white/70 p-4 sm:p-5",
        "dark:border-white/12 dark:from-amber-500/[0.06] dark:to-white/[0.02]",
        "cs-card-in",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Starting brief · what to file / prove next
          </p>
          <h3 className="mt-0.5 text-[1.05rem] font-semibold tracking-tight sm:text-[1.15rem]">
            {plan?.headline ?? "Counsel action plan"}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Simulation checklist for case strength — not a court order or legal advice.
          </p>
          {status === "loading" && (
            <p className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Building counsel action plan from the hearing…
            </p>
          )}
          {status === "ready" && plan?.summary && (
            <p className="mt-1 text-[13px] leading-relaxed text-foreground/85">{plan.summary}</p>
          )}
          {status === "error" && (
            <p className="mt-1 text-[12px] text-amber-800 dark:text-amber-300">
              Could not refresh the live plan. Showing fallback steps.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              disabled={!plan}
              className="cs-btn-soft h-9 rounded-xl px-3 text-[12px] font-semibold"
            >
              <FileText className="h-3.5 w-3.5" />
              Download PDF
            </button>
          )}
          {onCopyAll && (
            <button
              type="button"
              onClick={onCopyAll}
              disabled={!plan}
              className="cs-btn-soft h-9 rounded-xl px-3 text-[12px] font-semibold"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy all
            </button>
          )}
          {onRetry && (status === "error" || status === "ready") && (
            <button
              type="button"
              onClick={onRetry}
              className="cs-btn-soft h-9 rounded-xl px-3 text-[12px] font-semibold"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {status === "loading" && (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[88px] animate-pulse rounded-xl border border-black/[0.05] bg-white/50 dark:border-white/[0.06] dark:bg-white/[0.03]"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      )}

      {(status === "ready" || status === "error") && plan && (
        <div className="space-y-4">
          {(plan.mandatoryFacts.length > 0 || plan.opponentFactDefenses.length > 0) && (
            <div className="grid gap-3 lg:grid-cols-2">
              {plan.mandatoryFacts.length > 0 && (
                <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4 cs-card-in">
                  <h4 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <Scale className="h-3.5 w-3.5" />
                    Mandatory facts to prove
                  </h4>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    These facts are treated as essential on the hearing record.
                  </p>
                  <ul className="mt-3 space-y-3">
                    {plan.mandatoryFacts.map((mf) => (
                      <li
                        key={mf.id}
                        className="rounded-lg border border-black/[0.05] bg-white/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]"
                      >
                        <p className="text-[13px] font-semibold leading-snug">{mf.fact}</p>
                        {mf.whyMandatory && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Why mandatory: {mf.whyMandatory}
                          </p>
                        )}
                        {mf.howToProve && (
                          <p className="mt-1 text-[12px] leading-relaxed text-foreground/85">
                            How to prove: {mf.howToProve}
                          </p>
                        )}
                        <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {sideLabel(mf.side)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.opponentFactDefenses.length > 0 && (
                <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 cs-card-in">
                  <h4 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" />
                    Defend opponent facts
                  </h4>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    How to rebut or neutralize facts advanced by the other side.
                  </p>
                  <ul className="mt-3 space-y-3">
                    {plan.opponentFactDefenses.map((od) => (
                      <li
                        key={od.id}
                        className="rounded-lg border border-black/[0.05] bg-white/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]"
                      >
                        <p className="text-[12px] font-medium text-violet-900 dark:text-violet-200">
                          Opponent says: {od.opponentFact}
                        </p>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">
                          Defense: {od.defenseStrategy}
                        </p>
                        {od.evidenceNeeded && (
                          <p className="mt-1 text-[12px] text-muted-foreground">
                            Evidence needed: {od.evidenceNeeded}
                          </p>
                        )}
                        <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {sideLabel(od.side)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.8fr)]">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Counsel actions
            </p>
            {grouped.map((group, gi) => (
              <div key={group.priority} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.priority}
                </p>
                <ul className="space-y-2.5">
                  {group.items.map((action, ai) => {
                    const Icon = CATEGORY_ICON[action.category] ?? ClipboardList;
                    const done = checkedSet.has(action.id);
                    return (
                      <li
                        key={action.id}
                        className={cn(
                          "rounded-xl border border-black/[0.06] bg-white/70 p-3.5 transition-all dark:border-white/[0.08] dark:bg-white/[0.03]",
                          "cs-card-in",
                          done && "opacity-70",
                        )}
                        style={{ animationDelay: `${(gi * 3 + ai) * 40}ms` }}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            aria-label={done ? "Mark incomplete" : "Mark complete"}
                            onClick={() => onToggleChecked(action.id)}
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                              done
                                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700"
                                : "border-stone-300/60 bg-white dark:border-white/15 dark:bg-transparent",
                            )}
                          >
                            {done && <Check className="h-3 w-3" strokeWidth={3} />}
                          </button>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                                  PRIORITY_STYLE[action.priority],
                                )}
                              >
                                {action.priority}
                              </span>
                              <span className="rounded-full border border-black/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/10">
                                {timeframeLabel(action.timeframe)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.06] px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground dark:border-white/10">
                                <Icon className="h-3 w-3" />
                                {action.category}
                              </span>
                              <span className="rounded-full border border-black/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/10">
                                {sideLabel(action.side)}
                              </span>
                            </div>
                            <p
                              className={cn(
                                "text-[13px] font-semibold leading-snug",
                                done && "line-through",
                              )}
                            >
                              {action.title}
                            </p>
                            <p className="text-[12px] leading-relaxed text-foreground/80">
                              {action.description}
                            </p>
                            {action.rationale && (
                              <p className="text-[11px] leading-relaxed text-muted-foreground">
                                Why: {action.rationale}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 pt-0.5">
                              {(action.cta?.kind === "research" || !action.cta) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    runCta({
                                      ...action,
                                      cta: { kind: "research", query: action.cta?.query },
                                    })
                                  }
                                  className="cs-btn-soft h-8 rounded-lg px-2.5 text-[11px] font-semibold"
                                >
                                  <Search className="h-3 w-3" />
                                  Research this
                                </button>
                              )}
                              {(action.cta?.kind === "mera_vakil" ||
                                action.cta?.kind === "research" ||
                                !action.cta) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    runCta({
                                      ...action,
                                      cta: {
                                        kind: "mera_vakil",
                                        query: action.cta?.query,
                                      },
                                    })
                                  }
                                  className="cs-btn-soft h-8 rounded-lg px-2.5 text-[11px] font-semibold"
                                >
                                  <BookOpen className="h-3 w-3" />
                                  Ask Mera Vakil
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  runCta({
                                    ...action,
                                    cta: { kind: "copy", query: action.cta?.query },
                                  })
                                }
                                className="cs-btn-soft h-8 rounded-lg px-2.5 text-[11px] font-semibold"
                              >
                                <Copy className="h-3 w-3" />
                                Copy
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <aside className="space-y-3">
            {plan.limitationFlags.length > 0 && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5">
                <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Limitation flags
                </h4>
                <ul className="mt-2 list-inside list-disc space-y-1 text-[12px]">
                  {plan.limitationFlags.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {plan.documentsToGather.length > 0 && (
              <div className="rounded-xl border border-black/[0.05] bg-white/60 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Documents to gather
                </h4>
                <ul className="mt-2 list-inside list-disc space-y-1 text-[12px]">
                  {plan.documentsToGather.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
            {plan.settlementLevers.length > 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Settlement levers
                </h4>
                <ul className="mt-2 list-inside list-disc space-y-1 text-[12px]">
                  {plan.settlementLevers.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {plan.researchAngles.length > 0 && (
              <div className="rounded-xl border border-black/[0.05] bg-white/60 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Research angles
                </h4>
                <ul className="mt-2 space-y-2">
                  {plan.researchAngles.map((a, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        className="text-left text-[12px] font-medium text-sky-800 underline-offset-2 hover:underline dark:text-sky-300"
                        onClick={() => {
                          setResearchPrefill(a.query);
                          router.push(`/research?q=${encodeURIComponent(a.query)}`);
                        }}
                      >
                        {a.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
        </div>
      )}

      {status === "error" && !plan && fallbackNextSteps && fallbackNextSteps.length > 0 && (
        <ul className="space-y-1.5 rounded-xl border border-black/[0.05] bg-white/60 p-4 dark:border-white/[0.06]">
          {fallbackNextSteps.map((step, i) => (
            <li key={i} className="flex gap-2 text-[13px]">
              <span className="font-semibold tabular-nums text-muted-foreground">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      )}

      {plan?.disclaimer && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{plan.disclaimer}</p>
      )}
    </section>
  );
}

export function buildActionPlanMarkdown(plan: ProposedActionPlan): string {
  const lines = [
    `# ${plan.headline}`,
    "",
    plan.summary,
    "",
    "## Mandatory facts to prove",
    ...plan.mandatoryFacts.flatMap((mf, i) => [
      `### ${i + 1}. ${mf.fact}`,
      mf.whyMandatory ? `Why mandatory: ${mf.whyMandatory}` : "",
      mf.howToProve ? `How to prove: ${mf.howToProve}` : "",
      `Side: ${mf.side}`,
      "",
    ]),
    "## Defend opponent facts",
    ...plan.opponentFactDefenses.flatMap((od, i) => [
      `### ${i + 1}. Opponent: ${od.opponentFact}`,
      `Defense: ${od.defenseStrategy}`,
      od.evidenceNeeded ? `Evidence needed: ${od.evidenceNeeded}` : "",
      `Side: ${od.side}`,
      "",
    ]),
    "## Counsel actions",
    ...plan.actions.flatMap((a, i) => [
      `### ${i + 1}. [${a.priority.toUpperCase()}] ${a.title}`,
      `- Side: ${a.side} · Timeframe: ${a.timeframe} · Category: ${a.category}`,
      a.description,
      a.rationale ? `Why: ${a.rationale}` : "",
      "",
    ]),
    "## Documents to gather",
    ...plan.documentsToGather.map((d) => `- ${d}`),
    "",
    "## Limitation flags",
    ...plan.limitationFlags.map((f) => `- ${f}`),
    "",
    "## Settlement levers",
    ...plan.settlementLevers.map((s) => `- ${s}`),
    "",
    "## Research angles",
    ...plan.researchAngles.map((a) => `- **${a.title}**: ${a.query}`),
    "",
    plan.disclaimer,
  ].filter(Boolean);
  return lines.join("\n");
}

export async function downloadActionPlan(plan: ProposedActionPlan) {
  await buildActionPlanPdf(plan);
}
