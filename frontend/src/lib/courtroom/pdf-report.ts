import { jsPDF } from "jspdf";

import type { JudgmentReport, ProposedActionPlan } from "@/lib/courtroom/types";

const MARGIN = 18;
const PAGE_H = 297;
const PAGE_W = 210;
const MAX_Y = PAGE_H - 18;
const LINE = 5.2;

type PdfDoc = InstanceType<typeof jsPDF>;

function ensureSpace(doc: PdfDoc, y: number, need = LINE): number {
  if (y + need <= MAX_Y) return y;
  doc.addPage();
  return MARGIN;
}

function writeWrapped(
  doc: PdfDoc,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = LINE,
): number {
  const lines = doc.splitTextToSize(text || "—", maxWidth) as string[];
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function sectionTitle(doc: PdfDoc, title: string, y: number): number {
  y = ensureSpace(doc, y, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(title, MARGIN, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  return y;
}

function bulletList(doc: PdfDoc, items: string[], y: number, maxWidth: number): number {
  for (const item of items) {
    y = writeWrapped(doc, `• ${item}`, MARGIN, y, maxWidth);
    y += 1;
  }
  return y;
}

function numberedList(doc: PdfDoc, items: string[], y: number, maxWidth: number): number {
  items.forEach((item, i) => {
    y = writeWrapped(doc, `${i + 1}. ${item}`, MARGIN, y, maxWidth);
    y += 1;
  });
  return y;
}

function appendActionPlan(doc: PdfDoc, plan: ProposedActionPlan, y: number, maxWidth: number): number {
  y = sectionTitle(doc, "Post-hearing Action Plan", y);
  doc.setFont("helvetica", "bold");
  y = writeWrapped(doc, plan.headline, MARGIN, y, maxWidth);
  doc.setFont("helvetica", "normal");
  y = writeWrapped(doc, plan.summary, MARGIN, y, maxWidth);
  y += 2;

  if (plan.mandatoryFacts?.length) {
    y = sectionTitle(doc, "Mandatory facts to prove", y);
    for (const [i, mf] of plan.mandatoryFacts.entries()) {
      doc.setFont("helvetica", "bold");
      y = writeWrapped(doc, `${i + 1}. ${mf.fact}`, MARGIN, y, maxWidth);
      doc.setFont("helvetica", "normal");
      if (mf.whyMandatory) y = writeWrapped(doc, `Why mandatory: ${mf.whyMandatory}`, MARGIN + 3, y, maxWidth - 3);
      if (mf.howToProve) y = writeWrapped(doc, `How to prove: ${mf.howToProve}`, MARGIN + 3, y, maxWidth - 3);
      y = writeWrapped(doc, `Side: ${mf.side}`, MARGIN + 3, y, maxWidth - 3);
      y += 2;
    }
  }

  if (plan.opponentFactDefenses?.length) {
    y = sectionTitle(doc, "Defend opponent facts", y);
    for (const [i, od] of plan.opponentFactDefenses.entries()) {
      doc.setFont("helvetica", "bold");
      y = writeWrapped(doc, `${i + 1}. Opponent: ${od.opponentFact}`, MARGIN, y, maxWidth);
      doc.setFont("helvetica", "normal");
      y = writeWrapped(doc, `Defense: ${od.defenseStrategy}`, MARGIN + 3, y, maxWidth - 3);
      if (od.evidenceNeeded) {
        y = writeWrapped(doc, `Evidence needed: ${od.evidenceNeeded}`, MARGIN + 3, y, maxWidth - 3);
      }
      y = writeWrapped(doc, `Side: ${od.side}`, MARGIN + 3, y, maxWidth - 3);
      y += 2;
    }
  }

  if (plan.actions?.length) {
    y = sectionTitle(doc, "Counsel actions", y);
    for (const [i, a] of plan.actions.entries()) {
      doc.setFont("helvetica", "bold");
      y = writeWrapped(
        doc,
        `${i + 1}. [${a.priority.toUpperCase()}] ${a.title}`,
        MARGIN,
        y,
        maxWidth,
      );
      doc.setFont("helvetica", "normal");
      y = writeWrapped(
        doc,
        `Side: ${a.side} · Timeframe: ${a.timeframe} · Category: ${a.category}`,
        MARGIN + 3,
        y,
        maxWidth - 3,
      );
      y = writeWrapped(doc, a.description, MARGIN + 3, y, maxWidth - 3);
      if (a.rationale) y = writeWrapped(doc, `Why: ${a.rationale}`, MARGIN + 3, y, maxWidth - 3);
      y += 2;
    }
  }

  if (plan.documentsToGather?.length) {
    y = sectionTitle(doc, "Documents to gather", y);
    y = bulletList(doc, plan.documentsToGather, y, maxWidth);
  }
  if (plan.limitationFlags?.length) {
    y = sectionTitle(doc, "Limitation flags", y);
    y = bulletList(doc, plan.limitationFlags, y, maxWidth);
  }
  if (plan.settlementLevers?.length) {
    y = sectionTitle(doc, "Settlement levers", y);
    y = bulletList(doc, plan.settlementLevers, y, maxWidth);
  }
  if (plan.researchAngles?.length) {
    y = sectionTitle(doc, "Research angles", y);
    y = bulletList(
      doc,
      plan.researchAngles.map((a) => `${a.title}: ${a.query}`),
      y,
      maxWidth,
    );
  }
  if (plan.disclaimer) {
    y += 2;
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    y = writeWrapped(doc, plan.disclaimer, MARGIN, y, maxWidth, 4.2);
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
  }
  return y;
}

export function buildJudgmentPdf(
  report: JudgmentReport,
  actionPlan?: ProposedActionPlan | null,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const maxWidth = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  y = writeWrapped(doc, "Simulated Indian Court Order", MARGIN, y, maxWidth, 6.5);
  doc.setFontSize(12);
  y = writeWrapped(doc, report.matterTitle, MARGIN, y, maxWidth, 6);
  y += 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y = writeWrapped(doc, `Operative portion: ${report.disposition}`, MARGIN, y, maxWidth);
  if (report.dispositionHi) {
    y = writeWrapped(doc, `Operative portion (HI): ${report.dispositionHi}`, MARGIN, y, maxWidth);
  }
  y += 3;

  if (report.oralVerdict) {
    y = sectionTitle(doc, "Oral Pronouncement", y);
    y = writeWrapped(doc, report.oralVerdict, MARGIN, y, maxWidth);
    if (report.oralVerdictHi) {
      y += 1;
      y = writeWrapped(doc, `Hindi: ${report.oralVerdictHi}`, MARGIN, y, maxWidth);
    }
    y += 2;
  }

  if (report.issuesFramed?.length) {
    y = sectionTitle(doc, "Issues Framed", y);
    y = numberedList(doc, report.issuesFramed, y, maxWidth);
    y += 2;
  }

  if (report.intakeSummary) {
    y = sectionTitle(doc, "Intake Summary", y);
    y = writeWrapped(doc, report.intakeSummary, MARGIN, y, maxWidth);
    y += 2;
  }

  if (report.coverageSummary) {
    y = sectionTitle(doc, `Coverage (${report.coveragePercent ?? "—"}%)`, y);
    y = writeWrapped(doc, report.coverageSummary, MARGIN, y, maxWidth);
    y += 2;
  }

  if (report.strongestPetitioner?.length) {
    y = sectionTitle(doc, "Strongest Petitioner Points", y);
    y = bulletList(doc, report.strongestPetitioner, y, maxWidth);
    y += 2;
  }

  if (report.strongestRespondent?.length) {
    y = sectionTitle(doc, "Strongest Respondent Points", y);
    y = bulletList(doc, report.strongestRespondent, y, maxWidth);
    y += 2;
  }

  if (report.weaknessesExposed?.length) {
    y = sectionTitle(doc, "Weaknesses Exposed", y);
    y = bulletList(doc, report.weaknessesExposed, y, maxWidth);
    y += 2;
  }

  y = sectionTitle(doc, "Findings of Fact", y);
  y = bulletList(doc, report.findingsOfFact, y, maxWidth);
  if (report.findingsOfFactHi?.length) {
    y = bulletList(
      doc,
      report.findingsOfFactHi.map((f) => `(HI) ${f}`),
      y,
      maxWidth,
    );
  }
  y += 2;

  y = sectionTitle(doc, "Legal Reasoning", y);
  y = writeWrapped(doc, report.legalReasoning, MARGIN, y, maxWidth);
  if (report.legalReasoningHi) {
    y += 1;
    y = writeWrapped(doc, `Hindi: ${report.legalReasoningHi}`, MARGIN, y, maxWidth);
  }
  y += 2;

  y = sectionTitle(doc, "Confidence Scores", y);
  y = bulletList(
    doc,
    [
      `Argument strength: ${Math.round(report.confidence.argumentStrength * 100)}%`,
      `Evidence support: ${Math.round(report.confidence.evidenceSupport * 100)}%`,
      `Procedural compliance: ${Math.round(report.confidence.proceduralCompliance * 100)}%`,
    ],
    y,
    maxWidth,
  );
  y += 2;

  y = sectionTitle(doc, "Cited Authorities", y);
  y = bulletList(
    doc,
    report.authorities.map((a) => `[${a.marker}] ${a.title} — ${a.citation}`),
    y,
    maxWidth,
  );
  y += 2;

  y = sectionTitle(doc, "Recommended Next Steps", y);
  y = numberedList(doc, report.nextSteps, y, maxWidth);
  if (report.nextStepsHi?.length) {
    y = numberedList(
      doc,
      report.nextStepsHi.map((s) => `(HI) ${s}`),
      y,
      maxWidth,
    );
  }
  y += 3;

  if (actionPlan) {
    y = appendActionPlan(doc, actionPlan, y, maxWidth);
    y += 2;
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  y = ensureSpace(doc, y, 8);
  doc.text(
    `Generated ${report.generatedAt} — AI Courtroom Simulation (not a real court)`,
    MARGIN,
    y,
  );

  return doc;
}

export function buildActionPlanPdf(plan: ProposedActionPlan): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const maxWidth = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  y = writeWrapped(doc, "Courtroom Action Plan", MARGIN, y, maxWidth, 6.5);
  y += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  appendActionPlan(doc, plan, y, maxWidth);
  return doc;
}

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}
