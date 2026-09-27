/**
 * Saarthi progress line. The UI shows "Searching Indian law…" the moment a
 * question is asked, then follows the server's stages. Labels come from i18n;
 * an unknown stage falls back to the server's own text.
 */
const STAGE_KEYS: Record<string, string> = {
  thinking: "chat.statusSearching",
  research: "chat.statusSearching",
  writing: "chat.statusWriting",
  web: "chat.statusWeb",
  lawyer: "chat.statusLawyer",
  booking: "chat.statusBooking",
};

export const INITIAL_STATUS_KEY = "chat.statusSearching";

export function statusLabel(stage: string, message: string, t: (key: string) => string): string {
  const key = STAGE_KEYS[stage];
  return key ? t(key) : message;
}
