/**
 * Client-side guest (logged-out) trial state for Saarthi. UX-only — the real
 * cap is the server-side per-IP daily limit on /research/stream/guest. This
 * gives instant "X of 5 free chats today" feedback and opens the signup wall.
 */

const CHAT_KEY = "legalos.guest.chat"; // { date: "YYYY-MM-DD", count: number }
const VOICE_KEY = "legalos.guest.voice"; // { date: "YYYY-MM-DD", used: boolean }
const TRANSCRIPT_KEY = "legalos.guest.transcript"; // sessionStorage: carried into the account after sign-up

export const GUEST_DAILY_CHAT_LIMIT = 5;

function today(): string {
  // Local calendar day (not UTC) so the counter resets at the user's midnight.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let pageSessionId: string | null = null;

/** Guest chat session id — fresh per page load, so a reload never resurrects
 *  server-side context the visitor can no longer see on screen. */
export function getGuestSessionId(): string {
  if (!pageSessionId) pageSessionId = `guest-${crypto.randomUUID()}`;
  return pageSessionId;
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

/** Trust the server's per-IP count (it's the real limit). */
export function syncGuestChatsRemaining(remaining: number): void {
  if (typeof window === "undefined") return;
  const count = Math.min(GUEST_DAILY_CHAT_LIMIT, Math.max(0, GUEST_DAILY_CHAT_LIMIT - remaining));
  window.localStorage.setItem(CHAT_KEY, JSON.stringify({ date: today(), count }));
}

export function markGuestChatLimitReached(): void {
  syncGuestChatsRemaining(0);
}

// ── Guest transcript → account (so "sign up to save this chat" is true) ──────

export interface GuestTurn {
  role: "user" | "assistant";
  content: string;
}

export function stashGuestTranscript(turns: GuestTurn[]): void {
  if (typeof window === "undefined") return;
  try {
    if (turns.length) window.sessionStorage.setItem(TRANSCRIPT_KEY, JSON.stringify(turns.slice(-20)));
    else window.sessionStorage.removeItem(TRANSCRIPT_KEY);
  } catch {
    /* storage full / disabled — the chat simply isn't carried over */
  }
}

export function consumeGuestTranscript(): GuestTurn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(TRANSCRIPT_KEY);
    window.sessionStorage.removeItem(TRANSCRIPT_KEY);
    const parsed = raw ? (JSON.parse(raw) as GuestTurn[]) : [];
    return parsed.filter(
      (t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim(),
    );
  } catch {
    return [];
  }
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
