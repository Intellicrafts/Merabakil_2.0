import type { ResearchResponse, ConversationTurn } from "@/lib/types";

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

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  research?: ResearchResponse;
  /** For typewriter effect: how many chars of answer are revealed */
  revealedChars?: number;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  documentId: string | null;
  jurisdiction: string | null;
  matterType?: MatterType;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "legalos.meravakil.conversations";
const ACTIVE_ID_KEY = "legalos.meravakil.active-id";
const MAX_CONVERSATIONS = 50;

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadConversations(): ChatConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatConversation[];
  } catch {
    return [];
  }
}

function saveAll(conversations: ChatConversation[]): void {
  const trimmed = conversations
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, MAX_CONVERSATIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function loadActiveConversationId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_ID_KEY);
}

export function saveActiveConversationId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_ID_KEY, id);
  else localStorage.removeItem(ACTIVE_ID_KEY);
}

export function createConversation(
  partial?: Partial<
    Pick<ChatConversation, "title" | "documentId" | "jurisdiction" | "matterType">
  >,
): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: partial?.title ?? "New conversation",
    messages: [],
    documentId: partial?.documentId ?? null,
    jurisdiction: partial?.jurisdiction ?? null,
    matterType: partial?.matterType ?? null,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertConversation(conversation: ChatConversation): ChatConversation {
  const all = loadConversations();
  const idx = all.findIndex((c) => c.id === conversation.id);
  const updated = { ...conversation, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.unshift(updated);
  }
  saveAll(all);
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

export function getConversation(id: string): ChatConversation | null {
  return loadConversations().find((c) => c.id === id) ?? null;
}

export function deleteConversation(id: string): void {
  const all = loadConversations().filter((c) => c.id !== id);
  saveAll(all);
  if (loadActiveConversationId() === id) saveActiveConversationId(null);
}

export function createUserMessage(content: string): ChatMessage {
  return {
    id: generateId(),
    role: "user",
    content,
    createdAt: new Date().toISOString(),
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
