/**
 * Client-side guest (logged-out) trial state for Saarthi. UX-only — the real
 * cap is the server-side per-IP daily limit on /research/stream/guest. This
 * gives instant "X of 5 free chats today" feedback and opens the signup wall.
 */

const SESSION_KEY = "legalos.guest.session_id";
const CHAT_KEY = "legalos.guest.chat"; // { date: "YYYY-MM-DD", count: number }
const VOICE_KEY = "legalos.guest.voice"; // { date: "YYYY-MM-DD", used: boolean }

export const GUEST_DAILY_CHAT_LIMIT = 5;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Stable per-device id sent as the guest chat session id (multi-turn context). */
export function getGuestSessionId(): string {
  if (typeof window === "undefined") return "guest";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `guest-${crypto.randomUUID()}`;
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function readChat(): { date: string; count: number } {
  if (typeof window === "undefined") return { date: today(), count: 0 };
  try {
    const raw = window.localStorage.getItem(CHAT_KEY);
    const parsed = raw ? (JSON.parse(raw) as { date: string; count: number }) : null;
    if (parsed && parsed.date === today()) return parsed;
  } catch {
    /* ignore */
  }
  return { date: today(), count: 0 };
}

export function guestChatsUsedToday(): number {
  return readChat().count;
}

export function guestChatsRemaining(): number {
  return Math.max(0, GUEST_DAILY_CHAT_LIMIT - guestChatsUsedToday());
}

export function canGuestChat(): boolean {
  return guestChatsUsedToday() < GUEST_DAILY_CHAT_LIMIT;
}

/** Count a sent guest message; returns the new used count. */
export function recordGuestChat(): number {
  if (typeof window === "undefined") return 0;
  const next = { date: today(), count: readChat().count + 1 };
  window.localStorage.setItem(CHAT_KEY, JSON.stringify(next));
  return next.count;
}

// ── Voice (one session per day) ──────────────────────────────────────────────

export function canGuestVoice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(VOICE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { date: string; used: boolean }) : null;
    if (parsed && parsed.date === today()) return !parsed.used;
  } catch {
    /* ignore */
  }
  return true;
}

export function recordGuestVoiceUsed(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VOICE_KEY, JSON.stringify({ date: today(), used: true }));
}
