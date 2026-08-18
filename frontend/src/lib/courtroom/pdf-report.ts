/**
 * Courtroom PDF export via HTML → canvas → PDF so Devanagari (Hindi) renders correctly.
 * jsPDF's built-in Helvetica cannot draw Unicode Indic scripts.
 */
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import type { JudgmentReport, ProposedActionPlan } from "@/lib/courtroom/types";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_MM = 14;
const FONT_LINK_ID = "legalos-pdf-noto-devanagari";

function escapeHtml(value: string): string {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function p(text: string): string {
  return `<p>${escapeHtml(text)}</p>`;
}

function bullets(items: string[]): string {
  if (!items?.length) return "";
  return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}

function numbered(items: string[]): string {
  if (!items?.length) return "";
  return `<ol>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ol>`;
}

function section(title: string, body: string): string {
  if (!body.trim()) return "";
  return `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function bilingualBlock(en: string, hi?: string | null, hiLabel = "हिन्दी"): string {
  let html = p(en);
  if (hi?.trim()) {
    html += `<p class="hi-label">${escapeHtml(hiLabel)}</p>${p(hi)}`;
  }
  return html;
}

async function ensureDevanagariFont(): Promise<void> {
  if (typeof document === "undefined") return;
  if (!document.getElementById(FONT_LINK_ID)) {
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&family=Noto+Sans:wght@400;600;700&display=swap";
    document.head.appendChild(link);
  }
  try {
    await document.fonts.ready;
    // Give the stylesheet a moment if it was just injected
    await document.fonts.load("400 14px 'Noto Sans Devanagari'");
    await document.fonts.load("700 14px 'Noto Sans Devanagari'");
  } catch {
    /* proceed with fallbacks */
  }
}

function reportStyles(): string {
  return `
    * { box-sizing: border-box; }
    body, .pdf-root {
      margin: 0;
      padding: 0;
      font-family: "Noto Sans Devanagari", "Noto Sans", "Segoe UI", system-ui, sans-serif;
      color: #1c1917;
      font-size: 12.5px;
      line-height: 1.55;
      background: #fff;
    }
    .pdf-root {
      width: 794px;
      padding: 40px 48px 48px;
      text-align: left;
    }
    .eyebrow {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #78716c;
      margin: 0 0 6px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 4px;
      line-height: 1.25;
      color: #0c0a09;
    }
    .matter {
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 16px;
      color: #292524;
    }
    .banner {
      border: 1px solid #f59e0b55;
      background: #fffbeb;
      color: #92400e;
      font-size: 11px;
      padding: 8px 12px;
      border-radius: 8px;
      margin: 0 0 20px;
    }
    h2 {
      font-size: 13px;
      font-weight: 700;
      margin: 18px 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e7e5e4;
      color: #1c1917;
    }
    p { margin: 0 0 8px; }
    .hi-label {
      font-size: 10px;
      font-weight: 700;
      color: #78716c;
      margin: 6px 0 2px;
      letter-spacing: 0.04em;
    }
    ul, ol { margin: 0 0 8px; padding-left: 1.25rem; }
    li { margin-bottom: 4px; }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      font-size: 11px;
      color: #57534e;
      margin-bottom: 12px;
    }
    .action-card {
      border: 1px solid #e7e5e4;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 8px;
      background: #fafaf9;
    }
    .action-card strong { font-weight: 700; }
    .priority {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 1px 6px;
      border-radius: 4px;
      background: #44403c;
      color: #fff;
      margin-right: 6px;
    }
    .footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #e7e5e4;
      font-size: 10px;
      color: #78716c;
    }
  `;
}

function actionPlanHtml(plan: ProposedActionPlan): string {
  const parts: string[] = [];
  parts.push(section("Post-hearing Action Plan", `<p><strong>${escapeHtml(plan.headline)}</strong></p>${p(plan.summary)}`));

  if (plan.mandatoryFacts?.length) {
    parts.push(
      section(
        "Mandatory facts to prove",
        plan.mandatoryFacts
          .map(
            (mf, i) =>
              `<div class="action-card"><strong>${i + 1}. ${escapeHtml(mf.fact)}</strong>` +
              (mf.whyMandatory ? `<p>Why mandatory: ${escapeHtml(mf.whyMandatory)}</p>` : "") +
              (mf.howToProve ? `<p>How to prove: ${escapeHtml(mf.howToProve)}</p>` : "") +
              `<p>Side: ${escapeHtml(mf.side)}</p></div>`,
          )
          .join(""),
      ),
    );
  }

  if (plan.opponentFactDefenses?.length) {
    parts.push(
      section(
        "Defend opponent facts",
        plan.opponentFactDefenses
          .map(
            (od, i) =>
              `<div class="action-card"><strong>${i + 1}. Opponent: ${escapeHtml(od.opponentFact)}</strong>` +
              `<p>Defense: ${escapeHtml(od.defenseStrategy)}</p>` +
              (od.evidenceNeeded ? `<p>Evidence needed: ${escapeHtml(od.evidenceNeeded)}</p>` : "") +
              `<p>Side: ${escapeHtml(od.side)}</p></div>`,
          )
          .join(""),
      ),
    );
  }

  if (plan.actions?.length) {
    parts.push(
      section(
        "Counsel actions",
        plan.actions
          .map(
            (a, i) =>
              `<div class="action-card"><span class="priority">${escapeHtml(a.priority)}</span>` +
              `<strong>${i + 1}. ${escapeHtml(a.title)}</strong>` +
              `<p>Side: ${escapeHtml(a.side)} · Timeframe: ${escapeHtml(a.timeframe)} · Category: ${escapeHtml(a.category)}</p>` +
              p(a.description) +
              (a.rationale ? `<p>Why: ${escapeHtml(a.rationale)}</p>` : "") +
              `</div>`,
          )
          .join(""),
      ),
    );
  }

  if (plan.documentsToGather?.length) {
    parts.push(section("Documents to gather", bullets(plan.documentsToGather)));
  }
  if (plan.limitationFlags?.length) {
    parts.push(section("Limitation flags", bullets(plan.limitationFlags)));
  }
  if (plan.settlementLevers?.length) {
    parts.push(section("Settlement levers", bullets(plan.settlementLevers)));
  }
  if (plan.researchAngles?.length) {
    parts.push(
      section(
        "Research angles",
        bullets(plan.researchAngles.map((a) => `${a.title}: ${a.query}`)),
      ),
    );
  }
  if (plan.disclaimer) {
    parts.push(`<p class="footer">${escapeHtml(plan.disclaimer)}</p>`);
  }
  return parts.join("");
}

function judgmentHtml(report: JudgmentReport, actionPlan?: ProposedActionPlan | null): string {
  const parts: string[] = [];
  parts.push(`<p class="eyebrow">Simulated Indian court order</p>`);
  parts.push(`<h1>Simulated Indian Court Order</h1>`);
  parts.push(`<p class="matter">${escapeHtml(report.matterTitle)}</p>`);
  parts.push(
    `<div class="banner">AI Courtroom Simulation — not a real court order or legal advice.</div>`,
  );

  parts.push(
    section(
      "Operative portion",
      bilingualBlock(report.disposition, report.dispositionHi, "Operative portion (हिन्दी)"),
    ),
  );

  if (report.oralVerdict) {
    parts.push(
      section(
        "Oral Pronouncement",
        bilingualBlock(report.oralVerdict, report.oralVerdictHi),
      ),
    );
  }

  if (report.issuesFramed?.length) {
    parts.push(section("Issues Framed", numbered(report.issuesFramed)));
  }
  if (report.intakeSummary) {
    parts.push(section("Intake Summary", p(report.intakeSummary)));
  }
  if (report.coverageSummary) {
    parts.push(
      section(
        `Coverage (${report.coveragePercent ?? "—"}%)`,
        p(report.coverageSummary),
      ),
    );
  }
  if (report.notCovered?.length) {
    parts.push(section("Issues Not Fully Argued", bullets(report.notCovered)));
  }
  if (report.authoritiesQuality) {
    parts.push(
      section(
        "Authorities Quality",
        p(
          `Verified: ${report.authoritiesQuality.verifiedCount}; Unverified: ${report.authoritiesQuality.unverifiedCount}. ${report.authoritiesQuality.caveat}`,
        ),
      ),
    );
  }
  if (report.strongestPetitioner?.length) {
    parts.push(section("Strongest Petitioner Points", bullets(report.strongestPetitioner)));
  }
  if (report.strongestRespondent?.length) {
    parts.push(section("Strongest Respondent Points", bullets(report.strongestRespondent)));
  }
  if (report.weaknessesExposed?.length) {
    parts.push(section("Weaknesses Exposed", bullets(report.weaknessesExposed)));
  }

  let findings = bullets(report.findingsOfFact);
  if (report.findingsOfFactHi?.length) {
    findings += `<p class="hi-label">हिन्दी</p>${bullets(report.findingsOfFactHi)}`;
  }
  parts.push(section("Findings of Fact", findings));

  parts.push(
    section(
      "Legal Reasoning",
      bilingualBlock(report.legalReasoning, report.legalReasoningHi),
    ),
  );

  parts.push(
    section(
      "Confidence Scores",
      bullets([
        `Argument strength: ${Math.round(report.confidence.argumentStrength * 100)}%`,
        `Evidence support: ${Math.round(report.confidence.evidenceSupport * 100)}%`,
        `Procedural compliance: ${Math.round(report.confidence.proceduralCompliance * 100)}%`,
        ...(report.confidenceMethodology
          ? [`How scored: ${report.confidenceMethodology.summary}`]
          : []),
      ]),
    ),
  );

  const pdfAuthorities = (report.authorities ?? []).filter(
    (a) => a.verified !== false || !report.authoritiesQuality,
  );
  const preferred =
    report.authorities?.filter((a) => a.verified) ?? [];
  const authoritiesForPdf = preferred.length ? preferred : pdfAuthorities;

  if (authoritiesForPdf.length) {
    parts.push(
      section(
        "Cited Authorities (verified preferred)",
        bullets(
          authoritiesForPdf.map(
            (a) =>
              `[${a.marker}] ${a.title} — ${a.citation} (${a.verified ? "Verified" : "Unverified"}${a.sourceKind ? `, ${a.sourceKind}` : ""})`,
          ),
        ),
      ),
    );
  }

  let next = numbered(report.nextSteps);
  if (report.nextStepsHi?.length) {
    next += `<p class="hi-label">हिन्दी</p>${numbered(report.nextStepsHi)}`;
  }
  parts.push(section("Recommended Next Steps", next));

  if (actionPlan) {
    parts.push(actionPlanHtml(actionPlan));
  }

  parts.push(
    `<p class="footer">Generated ${escapeHtml(report.generatedAt)} — AI Courtroom Simulation (not a real court)</p>`,
  );

  return parts.join("");
}

async function renderHtmlToPdf(htmlBody: string, filename: string): Promise<void> {
  await ensureDevanagariFont();

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;pointer-events:none;";
  host.innerHTML = `<style>${reportStyles()}</style><div class="pdf-root">${htmlBody}</div>`;
  document.body.appendChild(host);

  try {
    const root = host.querySelector(".pdf-root") as HTMLElement;
    const canvas = await html2canvas(root, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 794,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const usableW = PAGE_W - MARGIN_MM * 2;
    const usableH = PAGE_H - MARGIN_MM * 2;
    const imgW = usableW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const pageCanvasH = (usableH * canvas.width) / imgW;

    let rendered = 0;
    let pageIndex = 0;
    while (rendered < canvas.height) {
      const sliceH = Math.min(pageCanvasH, canvas.height - rendered);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.ceil(sliceH);
      const ctx = pageCanvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        rendered,
        canvas.width,
        sliceH,
        0,
        0,
        canvas.width,
        sliceH,
      );

      const pageData = pageCanvas.toDataURL("image/jpeg", 0.92);
      const sliceMm = (sliceH * imgW) / canvas.width;
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(pageData, "JPEG", MARGIN_MM, MARGIN_MM, imgW, sliceMm);

      // page number
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`Page ${pageIndex + 1}`, PAGE_W / 2, PAGE_H - 8, { align: "center" });

      rendered += sliceH;
      pageIndex += 1;
    }

    pdf.save(filename);
  } finally {
    host.remove();
  }
}

export async function buildJudgmentPdf(
  report: JudgmentReport,
  actionPlan?: ProposedActionPlan | null,
): Promise<void> {
  await renderHtmlToPdf(
    judgmentHtml(report, actionPlan),
    `courtroom-judgment-${Date.now()}.pdf`,
  );
}

export async function buildActionPlanPdf(plan: ProposedActionPlan): Promise<void> {
  const body =
    `<p class="eyebrow">Post-hearing plan</p><h1>Courtroom Action Plan</h1>` +
    actionPlanHtml(plan);
  await renderHtmlToPdf(body, `courtroom-action-plan-${Date.now()}.pdf`);
}

/** @deprecated Prefer buildJudgmentPdf / buildActionPlanPdf which save directly. */
export function downloadPdf(_doc: unknown, _filename: string) {
  /* no-op kept for import compatibility during transition */
}
