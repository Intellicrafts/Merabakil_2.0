const MAX_SPEECH_CHARS = 4000;

const MD_CODE_BLOCK = /```[\s\S]*?```/gm;
const MD_INLINE_CODE = /`([^`]+)`/g;
const MD_LINK = /\[([^\]]+)\]\([^)]+\)/g;
const MD_IMAGE = /!\[([^\]]*)\]\([^)]+\)/g;
const MD_BOLD = /\*\*([^*]+)\*\*/g;
const MD_ITALIC = /(?<!\*)\*([^*]+)\*(?!\*)/g;
const MD_HEADER = /^#{1,6}\s+/gm;
const MD_LIST = /^[\s]*[-*+]\s+/gm;
const MD_ORDERED = /^[\s]*\d+\.\s+/gm;
const CITATION = /\[\^?\d+\]/g;
const DISCLAIMER =
  /(this (response|information) is (not|for) informational|not a substitute for.*advocate|consult a qualified|seek professional legal advice)/i;

const LEGAL_EXPANSIONS: Array<[RegExp, string]> = [
  [/\bArt\.\s*/gi, "Article "],
  [/\bSec\.\s*/gi, "Section "],
  [/\bvs\.\s*/gi, "versus "],
  [/\bNo\.\s*/gi, "Number "],
  [/\bIPC\b/g, "Indian Penal Code"],
  [/\bCrPC\b/g, "Code of Criminal Procedure"],
  [/\bCPC\b/g, "Code of Civil Procedure"],
];

function stripMarkdown(text: string): string {
  return text
    .replace(MD_CODE_BLOCK, "")
    .replace(MD_IMAGE, "$1")
    .replace(MD_LINK, "$1")
    .replace(MD_INLINE_CODE, "$1")
    .replace(MD_BOLD, "$1")
    .replace(MD_ITALIC, "$1")
    .replace(MD_HEADER, "")
    .replace(MD_LIST, "")
    .replace(MD_ORDERED, "")
    .replace(CITATION, "");
}

function expandLegalShorthand(text: string): string {
  let result = text;
  for (const [pattern, replacement] of LEGAL_EXPANSIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function normalizeWhitespace(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const paragraphs: string[] = [];
  let buffer: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (buffer.length) {
        paragraphs.push(buffer.join(" "));
        buffer = [];
      }
      continue;
    }
    if (DISCLAIMER.test(trimmed)) continue;
    buffer.push(trimmed);
  }
  if (buffer.length) paragraphs.push(buffer.join(" "));
  return paragraphs.join(" ").replace(/\s{2,}/g, " ").trim();
}

export function prepareSpeechText(markdown: string): string {
  let text = stripMarkdown(markdown);
  text = expandLegalShorthand(text);
  text = normalizeWhitespace(text);
  if (text.length > MAX_SPEECH_CHARS) {
    text = `${text.slice(0, MAX_SPEECH_CHARS).replace(/\s+\S*$/, "")}.`;
  }
  return text;
}

export function prepareSpeechChunks(markdown: string): string[] {
  const text = prepareSpeechText(markdown);
  if (!text) return [];

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const candidate = current ? `${current} ${trimmed}` : trimmed;
    if (candidate.length <= 320) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = trimmed.length <= 320 ? trimmed : trimmed.slice(0, 320);
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, 320)];
}
