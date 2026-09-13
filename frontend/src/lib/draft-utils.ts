import jsPDF from "jspdf";

export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*>]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function downloadPdf(title: string, content: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  const pageH = 297;
  const lineH = 6;
  const maxW = 170;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(title, maxW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const bodyLines = doc.splitTextToSize(stripMarkdown(content), maxW);
  for (const line of bodyLines) {
    if (y + lineH > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineH;
  }

  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

export function downloadTxt(title: string, content: string) {
  const blob = new Blob(
    [`${title}\n${"=".repeat(title.length)}\n\n${stripMarkdown(content)}`],
    { type: "text/plain;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
