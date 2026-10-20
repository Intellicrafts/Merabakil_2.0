import { expect, test } from "@playwright/test";

import {
  formatConversationReportPlaintext,
  formatCounselReportPlaintext,
} from "../src/lib/counsel-report-model";
import {
  drawConversationReport,
  drawCounselReport,
  type CounselPdfDoc,
} from "../src/lib/counsel-report-pdf";

const PAYLOAD = {
  question: "Can I send a legal notice for deposit?",
  answer: "## Summary\nYes, under the Transfer of Property Act.",
  sources: [{ title: "Transfer of Property Act, 1882", citation: "s.106" }],
  disclaimer: "Informational only. Not legal advice.",
};

const CONVERSATION = {
  turns: [
    {
      question: "Can I send a legal notice for deposit?",
      answer: "## Summary\nYes, under the Transfer of Property Act.",
      sources: [{ title: "Transfer of Property Act, 1882", citation: "s.106" }],
    },
    {
      question: "How long does the tenant get to respond?",
      answer: "- Usually 15 days\n1. Serve the notice\n2. Wait for the reply window",
    },
  ],
  disclaimer: "Informational only. Not legal advice.",
};

function createRecordingPdf(): { pdf: CounselPdfDoc; texts: string[] } {
  const texts: string[] = [];
  let pages = 1;
  const pdf: CounselPdfDoc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    getNumberOfPages: () => pages,
    setPage: () => undefined,
    addPage: () => {
      pages += 1;
    },
    setFont: () => undefined,
    setFontSize: () => undefined,
    setTextColor: () => undefined,
    setDrawColor: () => undefined,
    setFillColor: () => undefined,
    setLineWidth: () => undefined,
    line: () => undefined,
    rect: () => undefined,
    text: (value) => {
      texts.push(Array.isArray(value) ? value.join("\n") : value);
    },
    splitTextToSize: (value) => [value],
  };
  return { pdf, texts };
}

test("counsel report plaintext includes question, answer, source, disclaimer", () => {
  const text = formatCounselReportPlaintext(PAYLOAD);
  expect(text).toContain("MeraBakil");
  expect(text).toContain("Can I send a legal notice for deposit?");
  expect(text).toContain("Transfer of Property Act");
  expect(text).toContain("Not legal advice");
});

test("jsPDF builder writes question, answer, source, and disclaimer", () => {
  const { pdf, texts } = createRecordingPdf();
  drawCounselReport(pdf, PAYLOAD, new Date("2026-09-08T12:00:00+05:30"));
  const drawn = texts.join("\n");
  expect(drawn).toContain("Saarthi Counsel Report");
  expect(drawn).toContain("Can I send a legal notice for deposit?");
  expect(drawn).toContain("Transfer of Property Act");
  expect(drawn).toContain("Yes, under the Transfer of Property Act.");
  expect(drawn).toContain("Informational only. Not legal advice.");
  expect(drawn).toContain("merabakil.in");
});

test("conversation plaintext includes every turn, source, and disclaimer", () => {
  const text = formatConversationReportPlaintext(CONVERSATION);
  expect(text).toContain("Can I send a legal notice for deposit?");
  expect(text).toContain("How long does the tenant get to respond?");
  expect(text).toContain("Transfer of Property Act");
  expect(text).toContain("Not legal advice");
});

test("jsPDF builder writes every conversation turn", () => {
  const { pdf, texts } = createRecordingPdf();
  drawConversationReport(pdf, CONVERSATION, new Date("2026-09-08T12:00:00+05:30"));
  const drawn = texts.join("\n");
  expect(drawn).toContain("Saarthi Counsel Report");
  expect(drawn).toContain("Can I send a legal notice for deposit?");
  expect(drawn).toContain("How long does the tenant get to respond?");
  expect(drawn).toContain("Usually 15 days");
  expect(drawn).toContain("Serve the notice");
  expect(drawn).toContain("Informational only. Not legal advice.");
  expect(drawn).toContain("merabakil.in");
});
