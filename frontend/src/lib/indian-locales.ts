export interface IndianSpeechLocale {
  code: string;
  label: string;
  bcp47: string;
}

export const INDIAN_SPEECH_LOCALES: IndianSpeechLocale[] = [
  { code: "en-IN", label: "English (Indian)", bcp47: "en-IN" },
  { code: "hi-IN", label: "Hindi", bcp47: "hi-IN" },
  { code: "ta-IN", label: "Tamil", bcp47: "ta-IN" },
  { code: "te-IN", label: "Telugu", bcp47: "te-IN" },
  { code: "bn-IN", label: "Bengali", bcp47: "bn-IN" },
  { code: "mr-IN", label: "Marathi", bcp47: "mr-IN" },
  { code: "gu-IN", label: "Gujarati", bcp47: "gu-IN" },
  { code: "kn-IN", label: "Kannada", bcp47: "kn-IN" },
  { code: "pa-IN", label: "Punjabi", bcp47: "pa-IN" },
];

export const SPEECH_LOCALE_KEY = "legalos.speech.locale";
export const DEFAULT_SPEECH_LOCALE = "en-IN";

export function loadSpeechLocale(): string {
  if (typeof window === "undefined") return DEFAULT_SPEECH_LOCALE;
  const stored = window.localStorage.getItem(SPEECH_LOCALE_KEY);
  return INDIAN_SPEECH_LOCALES.some((l) => l.code === stored)
    ? (stored as string)
    : DEFAULT_SPEECH_LOCALE;
}

export function saveSpeechLocale(code: string): void {
  window.localStorage.setItem(SPEECH_LOCALE_KEY, code);
}

export function getSpeechLocale(code: string): IndianSpeechLocale {
  return INDIAN_SPEECH_LOCALES.find((l) => l.code === code) ?? INDIAN_SPEECH_LOCALES[0];
}
