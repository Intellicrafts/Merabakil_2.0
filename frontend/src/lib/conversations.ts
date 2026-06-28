import type { ResearchResponse, ConversationTurn } from "@/lib/types";

export type ChatMessageRole = "user" | "assistant";

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
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "legalos.meravakil.conversations";
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
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_CONVERSATIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function createConversation(
  partial?: Partial<Pick<ChatConversation, "title" | "documentId" | "jurisdiction">>,
): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: partial?.title ?? "New conversation",
    messages: [],
    documentId: partial?.documentId ?? null,
    jurisdiction: partial?.jurisdiction ?? null,
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

export function getConversation(id: string): ChatConversation | null {
  return loadConversations().find((c) => c.id === id) ?? null;
}

export function deleteConversation(id: string): void {
  const all = loadConversations().filter((c) => c.id !== id);
  saveAll(all);
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
