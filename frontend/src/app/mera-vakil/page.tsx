"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Moon, PanelLeft, PanelRight, Sun, X } from "lucide-react";

import { ChatSidebar } from "@/components/mera-vakil/chat-sidebar";
import { ContextPanel } from "@/components/mera-vakil/context-panel";
import { EmptyState } from "@/components/mera-vakil/empty-state";
import { InputDock } from "@/components/mera-vakil/input-dock";
import { MeraVakilShell } from "@/components/mera-vakil/mera-vakil-shell";
import { MessageList } from "@/components/mera-vakil/message-list";
import { PremiumModal } from "@/components/mera-vakil/premium-modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useReadAloud } from "@/hooks/use-read-aloud";
import { runDocumentResearch, runResearch, uploadUserDocument, getUserDocument } from "@/lib/api";
import {
  createAssistantMessage,
  createConversation,
  createUserMessage,
  deleteConversation,
  deriveTitleFromQuery,
  loadConversations,
  upsertConversation,
  toResearchHistory,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/conversations";
import type { ResearchResponse } from "@/lib/types";

const THEME_KEY = "legalos.theme";
const TYPEWRITER_CHARS_PER_TICK = 4;
const TYPEWRITER_INTERVAL_MS = 16;

export default function MeraVakilPage() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null);
  const [input, setInput] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readAloud = useReadAloud();

  useEffect(() => {
    setConversations(loadConversations());
    const stored = localStorage.getItem(THEME_KEY);
    const prefersDark = stored === "dark";
    setDark(prefersDark);
    document.documentElement.classList.toggle("dark", prefersDark);
  }, []);

  const documentId = activeConversation?.documentId ?? null;
  const jurisdiction = activeConversation?.jurisdiction ?? "";

  const mutation = useMutation<
    ResearchResponse,
    Error,
    { query: string; history: ReturnType<typeof toResearchHistory> }
  >({
    mutationFn: async ({ query, history }) => {
      if (documentId) {
        return runDocumentResearch(documentId, query, jurisdiction || undefined, history);
      }
      return runResearch(query, jurisdiction || undefined, history);
    },
    onError: (err) => {
      toast({ title: "Research failed", description: err.message, variant: "destructive" });
    },
  });

  const latestResearch =
    activeConversation?.messages
      .filter((m) => m.role === "assistant" && m.research)
      .at(-1)?.research ?? null;

  const startTypewriter = useCallback(
    (conv: ChatConversation, assistantMsg: ChatMessage) => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      setTypingMessageId(assistantMsg.id);

      const total = assistantMsg.content.length;
      let revealed = 0;

      typewriterRef.current = setInterval(() => {
        revealed = Math.min(revealed + TYPEWRITER_CHARS_PER_TICK, total);
        setActiveConversation((prev) => {
          if (!prev) return prev;
          const updated: ChatConversation = {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === assistantMsg.id ? { ...m, revealedChars: revealed } : m,
            ),
          };
          if (revealed >= total) {
            if (typewriterRef.current) clearInterval(typewriterRef.current);
            typewriterRef.current = null;
            setTypingMessageId(null);
            upsertConversation(updated);
            setConversations(loadConversations());
          }
          return updated;
        });
      }, TYPEWRITER_INTERVAL_MS);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, []);

  function handleNewChat() {
    const conv = createConversation({ documentId, jurisdiction: jurisdiction || null });
    setActiveConversation(conv);
    setInput("");
    setTypingMessageId(null);
    setEditingMessageId(null);
  }

  function handleSelectConversation(id: string) {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setActiveConversation(conv);
      setInput("");
      setTypingMessageId(null);
      setEditingMessageId(null);
    }
  }

  function handleDeleteConversation(id: string) {
    deleteConversation(id);
    const updated = loadConversations();
    setConversations(updated);
    if (activeConversation?.id === id) {
      setActiveConversation(null);
    }
  }

  function handleDocumentChange(id: string | null) {
    setActiveConversation((prev) => {
      if (!prev) {
        const conv = createConversation({ documentId: id, jurisdiction: jurisdiction || null });
        upsertConversation(conv);
        setConversations(loadConversations());
        return conv;
      }
      const updated = { ...prev, documentId: id };
      upsertConversation(updated);
      setConversations(loadConversations());
      return updated;
    });
  }

  function handleJurisdictionChange(value: string) {
    setActiveConversation((prev) => {
      if (!prev) {
        const conv = createConversation({ jurisdiction: value || null });
        upsertConversation(conv);
        setConversations(loadConversations());
        return conv;
      }
      const updated = { ...prev, jurisdiction: value || null };
      upsertConversation(updated);
      setConversations(loadConversations());
      return updated;
    });
  }

  async function handleFileUpload(file: File) {
    if (isUploading || mutation.isPending) return;
    setIsUploading(true);
    try {
      const uploaded = await uploadUserDocument(file, {
        title: file.name.replace(/\.[^.]+$/, "") || file.name,
        doc_type: "user_upload",
      });
      const documentIdValue = uploaded.document_id;
      handleDocumentChange(documentIdValue);

      let status = uploaded.status;
      for (let attempt = 0; attempt < 20 && status !== "indexed"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const doc = await getUserDocument(documentIdValue);
        status = doc.status;
        if (status === "failed") break;
      }

      toast({
        title: status === "indexed" ? "Document ready" : "Document uploaded",
        description:
          status === "indexed"
            ? `"${file.name}" is indexed. You can now ask questions about it.`
            : `"${file.name}" is processing. Questions may take a moment to ground.`,
      });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not upload document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function sendMessage(
    queryText?: string,
    options?: { editMessageId?: string },
  ) {
    const query = (queryText ?? input).trim();
    if (query.length < 3 || mutation.isPending) return;

    let conv = activeConversation;
    if (!conv) {
      conv = createConversation({
        title: deriveTitleFromQuery(query),
        documentId,
        jurisdiction: jurisdiction || null,
      });
    }

    let baseMessages = conv.messages;
    if (options?.editMessageId) {
      const editIndex = baseMessages.findIndex((m) => m.id === options.editMessageId);
      if (editIndex === -1) return;
      baseMessages = baseMessages.slice(0, editIndex);
    }

    const userMsg = createUserMessage(query);
    const priorHistory = toResearchHistory(baseMessages);
    const withUser: ChatConversation = {
      ...conv,
      title: baseMessages.length === 0 ? deriveTitleFromQuery(query) : conv.title,
      messages: [...baseMessages, userMsg],
    };
    setActiveConversation(withUser);
    upsertConversation(withUser);
    setConversations(loadConversations());
    setInput("");
    setEditingMessageId(null);

    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
      typewriterRef.current = null;
    }
    setTypingMessageId(null);

    try {
      const result = await mutation.mutateAsync({ query, history: priorHistory });
      const assistantMsg = createAssistantMessage(result);
      const withAssistant: ChatConversation = {
        ...withUser,
        messages: [...withUser.messages, assistantMsg],
      };
      setActiveConversation(withAssistant);
      startTypewriter(withAssistant, assistantMsg);
    } catch {
      // error handled by mutation onError
    }
  }

  function handleResendEdit(messageId: string, newContent: string) {
    void sendMessage(newContent, { editMessageId: messageId });
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  }

  function handleCitationClick(marker: string) {
    const num = marker.replace(/[[\]]/g, "");
    const el = document.getElementById(`source-${num}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const hasMessages = (activeConversation?.messages.length ?? 0) > 0;

  return (
    <>
      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Conversation history">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close history"
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw]">
            <ChatSidebar
              conversations={conversations}
              activeId={activeConversation?.id ?? null}
              collapsed={false}
              onToggleCollapse={() => setMobileSidebarOpen(false)}
              onNewChat={() => {
                handleNewChat();
                setMobileSidebarOpen(false);
              }}
              onSelect={(id) => {
                handleSelectConversation(id);
                setMobileSidebarOpen(false);
              }}
              onDelete={handleDeleteConversation}
            />
          </div>
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full glass p-2"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <MeraVakilShell
      leftCollapsed={sidebarCollapsed}
      rightCollapsed={!rightPanelOpen}
      left={
        <ChatSidebar
          conversations={conversations}
          activeId={activeConversation?.id ?? null}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onNewChat={handleNewChat}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
        />
      }
      center={
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 items-center justify-end px-4 py-2.5 md:px-6">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open conversation history"
                className="rounded-full lg:hidden"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="rounded-full"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRightPanelOpen((o) => !o)}
                aria-label={rightPanelOpen ? "Hide context panel" : "Show context panel"}
                className="rounded-full xl:hidden"
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {!hasMessages && !mutation.isPending ? (
            <EmptyState
              onQuickAction={(prompt) => sendMessage(prompt)}
              onOpenPremium={() => setPremiumOpen(true)}
            />
          ) : (
            <MessageList
              messages={activeConversation?.messages ?? []}
              isPending={mutation.isPending}
              typingMessageId={typingMessageId}
              editingMessageId={editingMessageId}
              onCitationClick={handleCitationClick}
              onSuggestionSelect={(prompt) => sendMessage(prompt)}
              onStartEdit={setEditingMessageId}
              onCancelEdit={() => setEditingMessageId(null)}
              onResendEdit={handleResendEdit}
              readAloudStatus={readAloud.state.status}
              readAloudActiveId={readAloud.state.activeMessageId}
              onReadAloudToggle={(id, content) => void readAloud.toggle(id, content)}
              onReadAloudStop={readAloud.stop}
            />
          )}

          <InputDock
            value={input}
            onChange={setInput}
            onSubmit={() => sendMessage()}
            disabled={false}
            isPending={mutation.isPending}
            isUploading={isUploading}
            onFileSelect={handleFileUpload}
          />
        </div>
      }
      right={
        <ContextPanel
          documentId={documentId}
          jurisdiction={jurisdiction}
          onDocumentChange={handleDocumentChange}
          onJurisdictionChange={handleJurisdictionChange}
          latestResearch={latestResearch}
          isSpeaking={readAloud.state.isSpeaking}
        />
      }
    />
    </>
  );
}
