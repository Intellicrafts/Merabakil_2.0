import type { ResearchResponse, ConversationTurn } from "@/lib/types";
import { getToken } from "@/lib/api";
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

// ── Low-level API helper ───────────────────────────────────────────────────────

async function _callApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${authServiceUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Conversations API error ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
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
  try {
    const data = await _callApi<ChatConversation[]>("GET", "/api/v1/conversations");
    _cache = Array.isArray(data) ? data : [];
  } catch {
    _cache = [];
  }
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
  const all = [..._cache];
  const idx = all.findIndex((c) => c.id === conversation.id);
  const updated = { ...conversation, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.unshift(updated);
  }
  syncCache(all);
  void _callApi("POST", "/api/v1/conversations", toApiPayload(updated)).catch(() => {});
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
  syncCache(_cache.filter((c) => c.id !== id));
  if (loadActiveConversationId() === id) saveActiveConversationId(null);
  void _callApi("DELETE", `/api/v1/conversations/${id}`).catch(() => {});
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

export function deriveTitleFromQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length <= 48) return trimmed;
  return `${trimmed.slice(0, 48)}…`;
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
  return last.content.replace(/\s+/g, " ").trim().slice(0, 72);
}
