import type { ResearchResponse, ConversationTurn } from "@/lib/types";
import { authorizedFetch, forgetSession, type ChatErrorCode } from "@/lib/api";
import { authServiceUrl } from "@/lib/service-urls";

export type ChatMessageRole = "user" | "assistant";

export type MatterType =
  | "fir"
  | "bail"
  | "contract"
  | "property"
  | "family"
  | "constitutional"
  | null;

export const MATTER_TYPES: { id: Exclude<MatterType, null>; label: string }[] = [
  { id: "fir", label: "FIR" },
  { id: "bail", label: "Bail" },
  { id: "contract", label: "Contract" },
  { id: "property", label: "Property" },
  { id: "family", label: "Family" },
  { id: "constitutional", label: "Constitutional" },
];

export const JURISDICTION_OPTIONS = [
  "India",
  "Delhi",
  "Maharashtra",
  "Karnataka",
  "Tamil Nadu",
  "Uttar Pradesh",
  "West Bengal",
  "Rajasthan",
  "Gujarat",
] as const;

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  contentType: string;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  research?: ResearchResponse;
  attachments?: ChatAttachment[];
  /** For typewriter effect: how many chars of answer are revealed */
  revealedChars?: number;
  /** Set when this answer failed; the bubble shows a friendly error and Retry. */
  error?: ChatErrorCode;
}

export interface AttachedDocument {
  id: string;
  name: string;
  size?: number;
  contentType?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  documentId: string | null;
  attachedDocuments: AttachedDocument[];
  draftCaseId?: string | null;
  jurisdiction: string | null;
  matterType?: MatterType;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

const MAX_CONVERSATIONS = 50;
const ACTIVE_ID_KEY = "legalos.meravakil.active-id";

// In-memory conversation cache. Populated by initConversations() on page load.
let _cache: ChatConversation[] = [];
// Chats deleted in this session — a late save must never bring them back.
const _deleted = new Set<string>();
// Latest unsaved payload per conversation + which ones have a save in flight.
const _pendingWrites = new Map<string, Record<string, unknown>>();
const _inflight = new Set<string>();

/** The conversation list couldn't be loaded (as opposed to the user having none). */
export class ConversationsLoadError extends Error {
  constructor() {
    super("conversations_unavailable");
    this.name = "ConversationsLoadError";
  }
}

// ── Low-level API helper ───────────────────────────────────────────────────────

async function _callApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  // authorizedFetch refreshes an expired access token and retries once.
  const res = await authorizedFetch(`${authServiceUrl()}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Conversations API error ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Save one conversation; writes to the same id are serialised, latest wins. */
function _queueSave(id: string, payload: Record<string, unknown>): void {
  _pendingWrites.set(id, payload);
  if (_inflight.has(id)) return;
  _inflight.add(id);
  void (async () => {
    try {
      while (_pendingWrites.has(id)) {
        const next = _pendingWrites.get(id)!;
        _pendingWrites.delete(id);
        if (_deleted.has(id)) break;
        try {
          await _callApi("POST", "/api/v1/conversations", next);
        } catch {
          /* best effort — the next save carries the full conversation again */
        }
      }
    } finally {
      _inflight.delete(id);
    }
  })();
}

function toApiPayload(conv: ChatConversation): Record<string, unknown> {
  return {
    id: conv.id,
    title: conv.title,
    messages: conv.messages,
    document_id: conv.documentId ?? null,
    attached_documents: conv.attachedDocuments ?? [],
    draft_case_id: conv.draftCaseId ?? null,
    jurisdiction: conv.jurisdiction ?? null,
    matter_type: conv.matterType ?? null,
    pinned: conv.pinned ?? false,
  };
}

// ── Public initialisation ─────────────────────────────────────────────────────

/** Fetch conversations from server and populate the in-memory cache. Call on mount. */
export async function initConversations(): Promise<ChatConversation[]> {
  let data: ChatConversation[];
  try {
    data = await _callApi<ChatConversation[]>("GET", "/api/v1/conversations");
  } catch {
    throw new ConversationsLoadError();
  }
  _cache = (Array.isArray(data) ? data : []).filter((c) => !_deleted.has(c.id));
  return _cache;
}

// ── Sync reads (use in-memory cache) ─────────────────────────────────────────

export function loadConversations(): ChatConversation[] {
  return _cache;
}

export function getConversation(id: string): ChatConversation | null {
  return _cache.find((c) => c.id === id) ?? null;
}

// ── Active conversation ID — stays in localStorage (ephemeral UI state) ───────

export function loadActiveConversationId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_ID_KEY);
}

export function saveActiveConversationId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_ID_KEY, id);
  else localStorage.removeItem(ACTIVE_ID_KEY);
}

// ── Cache management ──────────────────────────────────────────────────────────

function syncCache(conversations: ChatConversation[]): void {
  _cache = conversations
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, MAX_CONVERSATIONS);
}

// ── Generators ────────────────────────────────────────────────────────────────

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createConversation(
  partial?: Partial<
    Pick<ChatConversation, "title" | "documentId" | "attachedDocuments" | "jurisdiction" | "matterType">
  >,
): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: partial?.title ?? "New conversation",
    messages: [],
    documentId: partial?.documentId ?? null,
    attachedDocuments: partial?.attachedDocuments ?? [],
    jurisdiction: partial?.jurisdiction ?? null,
    matterType: partial?.matterType ?? null,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Mutations (sync cache update + fire-and-forget server write) ──────────────

export function upsertConversation(conversation: ChatConversation): ChatConversation {
  if (_deleted.has(conversation.id)) return conversation;
  const all = [..._cache];
  const idx = all.findIndex((c) => c.id === conversation.id);
  const updated = { ...conversation, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.unshift(updated);
  }
  syncCache(all);
  _queueSave(updated.id, toApiPayload(updated));
  return updated;
}

export function renameConversation(id: string, title: string): ChatConversation | null {
  const conv = getConversation(id);
  if (!conv) return null;
  return upsertConversation({ ...conv, title: title.trim() || conv.title });
}

export function togglePinConversation(id: string): ChatConversation | null {
  const conv = getConversation(id);
  if (!conv) return null;
  return upsertConversation({ ...conv, pinned: !conv.pinned });
}

export function deleteConversation(id: string): void {
  _deleted.add(id);
  _pendingWrites.delete(id);
  syncCache(_cache.filter((c) => c.id !== id));
  if (loadActiveConversationId() === id) saveActiveConversationId(null);
  void _callApi("DELETE", `/api/v1/conversations/${id}`).catch(() => {});
  // Also drop Saarthi's server memory of this chat (history, attachments, learned facts).
  void forgetSession(id).catch(() => {});
}

// ── Message builders ──────────────────────────────────────────────────────────

export function createUserMessage(content: string, attachments?: ChatAttachment[]): ChatMessage {
  return {
    id: generateId(),
    role: "user",
    content,
    createdAt: new Date().toISOString(),
    attachments: attachments?.length ? attachments : undefined,
  };
}

export function createAssistantMessage(research: ResearchResponse): ChatMessage {
  return {
    id: generateId(),
    role: "assistant",
    content: research.answer,
    createdAt: new Date().toISOString(),
    research: {
      ...research,
      web_sources: research.web_sources ?? [],
      web_images: research.web_images ?? [],
      suggestions: research.suggestions ?? [],
    },
    revealedChars: 0,
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Truncate by user-perceived characters so Devanagari never splits mid-letter. */
export function truncateGraphemes(text: string, max: number): string {
  const segmenter =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
      : null;
  const graphemes = segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
  return graphemes.length <= max ? text : `${graphemes.slice(0, max).join("")}…`;
}

export function deriveTitleFromQuery(query: string): string {
  return truncateGraphemes(query.trim(), 48);
}

const MAX_HISTORY_TURNS = 20;
const MAX_HISTORY_CHARS = 4000;

export function toResearchHistory(messages: ChatMessage[]): ConversationTurn[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-MAX_HISTORY_TURNS)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, MAX_HISTORY_CHARS),
    }));
}

export function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function lastMessagePreview(conv: ChatConversation): string {
  const last = conv.messages.at(-1);
  if (!last) return "No messages yet";
  return truncateGraphemes(last.content.replace(/\s+/g, " ").trim(), 72);
}
