import type { TranscriptEntry, TranscriptLanguage } from "@/lib/courtroom/types";

export function formatTranscriptLine(
  entry: TranscriptEntry,
  language: TranscriptLanguage,
): { primary: string; secondary?: string } {
  const en = entry.text;
  const hi = entry.textHi ?? "";
  if (language === "en") return { primary: en };
  if (language === "hi") return { primary: hi || en };
  if (hi) return { primary: en, secondary: hi };
  return { primary: en };
}

export function languageLabel(language: TranscriptLanguage): string {
  const map: Record<TranscriptLanguage, string> = {
    en: "English",
    hi: "Hindi",
    both: "Both",
  };
  return map[language];
}

/** Attach Hindi companion text for common courtroom phrases. */
export function toHindiCompanion(english: string): string {
  const table: [RegExp, string][] = [
    [/AI simulation/i, "यह एक AI सिमुलेशन है"],
    [/not a real court/i, "यह वास्तविक न्यायालय नहीं है"],
    [/Hon'ble AI Judge/i, "माननीय AI न्यायाधीश"],
    [/Court Clerk/i, "कोर्ट क्लर्क"],
    [/Article 21/i, "धारा 21"],
    [/Article 226/i, "धारा 226"],
    [/Section 73/i, "धारा 73"],
    [/Master Service Agreement/i, "मास्टर सेवा समझौता"],
    [/Objection sustained/i, "आपत्ति स्वीकार"],
    [/Objection overruled/i, "आपत्ति खारिज"],
    [/Sustained/i, "स्वीकार"],
    [/Overruled/i, "खारिज"],
    [/Arguments concluded/i, "तर्क समाप्त"],
    [/Court will deliberate/i, "न्यायालय विचार करेगा"],
    [/Hearing closed/i, "सुनवाई समाप्त"],
    [/Petitioner may open/i, "याचिकाकर्ता प्रारंभ कर सकते हैं"],
    [/My Lords/i, "माननीय न्यायालय"],
  ];
  for (const [pattern, replacement] of table) {
    if (pattern.test(english)) return english.replace(pattern, replacement);
  }
  if (english.length < 80) {
    return `${english} (हिंदी सारांश: इस तर्क को सिमुलेशन में प्रस्तुत किया गया।)`;
  }
  return `इस सिमुलेशन में प्रस्तुत तर्क: ${english.slice(0, 120)}…`;
}
