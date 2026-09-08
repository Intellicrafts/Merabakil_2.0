import {
  counselReportFilename,
  formatCounselReportPlaintext,
  stripCitationMarkers,
  type CounselReportPayload,
} from "./counsel-report-model";

const MARGIN = 18;
const FOOTER_H = 14;

const AMBER = { r: 154, g: 52, b: 18 };
const SLATE = { r: 51, g: 65, b: 85 };
const INK = { r: 15, g: 23, b: 42 };
const MUTED = { r: 100, g: 116, b: 139 };
const RULE = { r: 226, g: 232, b: 240 };
const CREAM = { r: 255, g: 251, b: 235 };
const DISC_BORDER = { r: 253, g: 230, b: 138 };

/** Minimal surface used by the branded report — easy to mock in tests. */
export interface CounselPdfDoc {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  getNumberOfPages: () => number;
  setPage: (n: number) => void;
  addPage: () => void;
  setFont: (name: string, style?: string) => void;
  setFontSize: (n: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setDrawColor: (r: number, g: number, b: number) => void;
  setFillColor: (r: number, g: number, b: number) => void;
  setLineWidth: (n: number) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => unknown;
  text: (
    text: string | string[],
    x: number,
    y: number,
    opts?: { align?: "left" | "center" | "right" },
  ) => void;
  splitTextToSize: (text: string, width: number) => string[];
}

function formatWhen(date: Date): string {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function blocksFromAnswer(answer: string): Array<{ kind: "h" | "p" | "li"; text: string }> {
  const clean = stripCitationMarkers(answer);
  const out: Array<{ kind: "h" | "p" | "li"; text: string }> = [];
  for (const raw of clean.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) out.push({ kind: "h", text: line.slice(3) });
    else if (/^[-*]\s+/.test(line)) out.push({ kind: "li", text: line.replace(/^[-*]\s+/, "") });
    else out.push({ kind: "p", text: line.replace(/^#+\s+/, "") });
  }
  return out;
}

export function drawCounselReport(
  pdf: CounselPdfDoc,
  payload: CounselReportPayload,
  generatedAt = new Date(),
): void {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const maxW = pageW - MARGIN * 2;
  let y = 0;

  const ensure = (need: number) => {
    if (y + need > pageH - FOOTER_H - 6) {
      pdf.addPage();
      y = MARGIN + 4;
    }
  };

  const writeLines = (
    lines: string[],
    lineH: number,
    color: { r: number; g: number; b: number },
    font: [string, string?],
    size: number,
    indent = 0,
  ) => {
    pdf.setFont(font[0], font[1] ?? "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(color.r, color.g, color.b);
    for (const line of lines) {
      ensure(lineH);
      pdf.text(line, MARGIN + indent, y);
      y += lineH;
    }
  };

  const kicker = (label: string) => {
    ensure(10);
    writeLines([label.toUpperCase()], 6, AMBER, ["helvetica", "bold"], 8);
    y += 1;
  };

  pdf.setFillColor(AMBER.r, AMBER.g, AMBER.b);
  pdf.rect(0, 0, pageW, 4, "F");

  y = 16;
  writeLines(["MERABAKIL  ·  INDIA"], 5, AMBER, ["helvetica", "bold"], 9);
  y += 2;
  writeLines(["Saarthi counsel report"], 8, INK, ["helvetica", "bold"], 18);
  y += 1;
  writeLines(
    [`Confidential  ·  Generated ${formatWhen(generatedAt)} IST`],
    5,
    MUTED,
    ["helvetica", "normal"],
    9,
  );
  y += 3;
  pdf.setDrawColor(AMBER.r, AMBER.g, AMBER.b);
  pdf.setLineWidth(0.45);
  pdf.line(MARGIN, y, pageW - MARGIN, y);
  y += 10;

  kicker("Your question");
  const question = stripCitationMarkers(payload.question || "—");
  writeLines(pdf.splitTextToSize(question, maxW), 6, SLATE, ["helvetica", "normal"], 12);
  y += 6;

  kicker("Counsel note");
  for (const block of blocksFromAnswer(payload.answer || "")) {
    if (block.kind === "h") {
      y += 2;
      writeLines(pdf.splitTextToSize(block.text, maxW), 6, INK, ["helvetica", "bold"], 12);
      y += 1;
    } else if (block.kind === "li") {
      writeLines(
        pdf.splitTextToSize(`•  ${block.text}`, maxW - 4),
        5.4,
        SLATE,
        ["helvetica", "normal"],
        10.5,
        2,
      );
    } else {
      writeLines(pdf.splitTextToSize(block.text, maxW), 5.4, SLATE, ["helvetica", "normal"], 10.5);
      y += 2;
    }
  }

  const sources = (payload.sources ?? []).slice(0, 12);
  if (sources.length) {
    y += 4;
    pdf.setDrawColor(RULE.r, RULE.g, RULE.b);
    pdf.setLineWidth(0.25);
    ensure(8);
    pdf.line(MARGIN, y, pageW - MARGIN, y);
    y += 8;
    kicker("Sources");
    sources.forEach((src, i) => {
      const title = src.title || src.citation || src.url || `Source ${i + 1}`;
      const extra = [src.citation, src.url].filter(Boolean).join("  ·  ");
      const line = extra && extra !== title ? `${i + 1}. ${title} — ${extra}` : `${i + 1}. ${title}`;
      writeLines(pdf.splitTextToSize(line, maxW), 5.2, SLATE, ["helvetica", "normal"], 9.5);
    });
  }

  const disclaimer =
    payload.disclaimer?.trim() ||
    "This response is generated by an AI system for informational purposes only and does not constitute legal advice. Consult a licensed advocate before acting on this information.";

  y += 8;
  const discLines = pdf.splitTextToSize(disclaimer, maxW - 6);
  const boxH = discLines.length * 4.8 + 8;
  ensure(boxH + 2);
  pdf.setFillColor(CREAM.r, CREAM.g, CREAM.b);
  pdf.setDrawColor(DISC_BORDER.r, DISC_BORDER.g, DISC_BORDER.b);
  pdf.rect(MARGIN, y, maxW, boxH, "FD");
  y += 6;
  writeLines(discLines, 4.8, SLATE, ["helvetica", "normal"], 8.5, 3);

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    pdf.setPage(i);
    pdf.setDrawColor(RULE.r, RULE.g, RULE.b);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, pageH - 12, pageW - MARGIN, pageH - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    pdf.text("Confidential  ·  merabakil.in", MARGIN, pageH - 7);
    pdf.text("MeraBakil · Saarthi", pageW / 2, pageH - 7, { align: "center" });
    pdf.text(`${i} / ${pages}`, pageW - MARGIN, pageH - 7, { align: "right" });
  }
}

export async function downloadCounselReportPdf(payload: CounselReportPayload): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  drawCounselReport(pdf, payload);
  pdf.save(counselReportFilename());
}

/** Test hook: same payload is used for download. */
export function counselReportPlaintext(payload: CounselReportPayload): string {
  return formatCounselReportPlaintext(payload);
}
