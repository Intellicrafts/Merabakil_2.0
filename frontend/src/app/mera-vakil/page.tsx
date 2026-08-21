"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, PanelRight, Sun, X } from "lucide-react";

import { BackButton } from "@/components/layout/back-button";
import { ContextPanel } from "@/components/mera-vakil/context-panel";
import { EmptyState } from "@/components/mera-vakil/empty-state";
import { InputDock } from "@/components/mera-vakil/input-dock";
import { MeraVakilShell } from "@/components/mera-vakil/mera-vakil-shell";
import { MessageList } from "@/components/mera-vakil/message-list";
import { PremiumModal } from "@/components/mera-vakil/premium-modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useReadAloud } from "@/hooks/use-read-aloud";
import { streamResearch, uploadUserDocument, getUserDocument } from "@/lib/api";
import { consumeMeraVakilPrefill } from "@/lib/courtroom/session-store";
import { loadSpeechLocale, saveSpeechLocale } from "@/lib/indian-locales";
import {
  createAssistantMessage,
  createConversation,
  createUserMessage,
  deleteConversation,
  deriveTitleFromQuery,
  loadActiveConversationId,
  loadConversations,
  renameConversation,
  saveActiveConversationId,
  togglePinConversation,
  upsertConversation,
  toResearchHistory,
  type ChatConversation,
  type ChatMessage,
  type MatterType,
} from "@/lib/conversations";
import type { ResearchResponse } from "@/lib/types";

const THEME_KEY = "legalos.theme";
const CONTEXT_PANEL_KEY = "mera-vakil.context-panel-open";

export default function MeraVakilPage() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null);
  const [input, setInput] = useState("");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | undefined>();
  const [speechLocale, setSpeechLocale] = useState("en-IN");
  const [isUploading, setIsUploading] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const assistantMsgIdRef = useRef<string | null>(null);
  const withUserRef = useRef<ChatConversation | null>(null);
  const tokenBufferRef = useRef("");
  const tokenRafRef = useRef<number | null>(null);
  const skipActivePersist = useRef(true);
  const [groundingMessageId, setGroundingMessageId] = useState<string | null>(null);
  const readAloud = useReadAloud(speechLocale);

  useEffect(() => {
    const all = loadConversations();
    setConversations(all);
    const lastId = loadActiveConversationId();
    if (lastId) {
      const found = all.find((c) => c.id === lastId);
      if (found) setActiveConversation(found);
    }
    const stored = localStorage.getItem(THEME_KEY);
    const prefersDark = stored === "dark";
    setDark(prefersDark);
    document.documentElement.classList.toggle("dark", prefersDark);
    setSpeechLocale(loadSpeechLocale());
    const panelStored = localStorage.getItem(CONTEXT_PANEL_KEY);
    if (panelStored !== null) {
      setRightPanelOpen(panelStored === "true");
    }
    const prefill = consumeMeraVakilPrefill();
    if (prefill) setInput(prefill);
  }, []);

  useEffect(() => {
    if (skipActivePersist.current) {
      skipActivePersist.current = false;
      return;
    }
    saveActiveConversationId(activeConversation?.id ?? null);
  }, [activeConversation?.id]);

  function setRightPanelOpenPersisted(open: boolean) {
    setRightPanelOpen(open);
    localStorage.setItem(CONTEXT_PANEL_KEY, String(open));
  }

  const documentId = activeConversation?.documentId ?? null;
  const jurisdiction = activeConversation?.jurisdiction ?? "";

  const [isResearching, setIsResearching] = useState(false);

  const latestResearch =
    activeConversation?.messages
      .filter((m) => m.role === "assistant" && m.research)
      .at(-1)?.research ?? null;

  function handleSpeechLocaleChange(code: string) {
    setSpeechLocale(code);
    saveSpeechLocale(code);
  }

  function handleNewChat() {
    const conv = createConversation({
      documentId,
      jurisdiction: jurisdiction || null,
      matterType: activeConversation?.matterType ?? null,
    });
    setActiveConversation(conv);
    setInput("");
    setStreamingMessageId(null);
    setPendingStatus(undefined);
    setEditingMessageId(null);
  }

  function handleSelectConversation(id: string) {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setActiveConversation(conv);
      setInput("");
      setStreamingMessageId(null);
      setPendingStatus(undefined);
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

  function handleRenameConversation(id: string, title: string) {
    const updated = renameConversation(id, title);
    setConversations(loadConversations());
    if (updated && activeConversation?.id === id) {
      setActiveConversation(updated);
    }
  }

  function handlePinConversation(id: string) {
    const updated = togglePinConversation(id);
    setConversations(loadConversations());
    if (updated && activeConversation?.id === id) {
      setActiveConversation(updated);
    }
  }

  function handleMatterTypeChange(type: MatterType) {
    setActiveConversation((prev) => {
      const base =
        prev ?? createConversation({ documentId, jurisdiction: jurisdiction || null, matterType: type });
      const next = { ...base, matterType: type };
      upsertConversation(next);
      setConversations(loadConversations());
      return next;
    });
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
    if (isUploading || isResearching) return;
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

  function handleStopGeneration() {
    abortRef.current?.abort();
    if (tokenRafRef.current != null) {
      cancelAnimationFrame(tokenRafRef.current);
      tokenRafRef.current = null;
    }
    tokenBufferRef.current = "";

    const assistantId = assistantMsgIdRef.current;
    const baseConv = withUserRef.current;

    let stoppedConv: ChatConversation | null = null;

    setActiveConversation((prev) => {
      if (!prev || !assistantId) {
        stoppedConv = baseConv ?? prev;
        return stoppedConv;
      }
      const assistant = prev.messages.find((m) => m.id === assistantId);
      if (!assistant?.content?.trim()) {
        stoppedConv = baseConv ?? prev;
        return stoppedConv;
      }
      stoppedConv = {
        ...(baseConv ?? prev),
        messages: [...(baseConv?.messages ?? []), assistant],
      };
      return stoppedConv;
    });

    if (stoppedConv) {
      upsertConversation(stoppedConv);
      setConversations(loadConversations());
    }

    setIsResearching(false);
    setStreamingMessageId(null);
    setPendingStatus(undefined);
    abortRef.current = null;
    assistantMsgIdRef.current = null;
    withUserRef.current = null;

    toast({ title: "Response stopped", description: "Generation was cancelled." });
  }

  async function sendMessage(
    queryText?: string,
    options?: { editMessageId?: string },
  ) {
    const query = (queryText ?? input).trim();
    if (query.length < 3 || isResearching) return;

    let conv = activeConversation;
    if (!conv) {
      conv = createConversation({
        title: deriveTitleFromQuery(query),
        documentId,
        jurisdiction: jurisdiction || null,
        matterType: activeConversation?.matterType ?? null,
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
    abortRef.current?.abort();
    setStreamingMessageId(null);
    setPendingStatus("Understanding your question…");
    setIsResearching(true);

    const assistantMsgId = crypto.randomUUID?.() ?? `asst-${Date.now()}`;
    assistantMsgIdRef.current = assistantMsgId;
    withUserRef.current = withUser;

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantAdded = false;
    tokenBufferRef.current = "";
    if (tokenRafRef.current != null) {
      cancelAnimationFrame(tokenRafRef.current);
      tokenRafRef.current = null;
    }
    setGroundingMessageId(null);

    const flushTokens = (assistantMsgId: string) => {
      const chunk = tokenBufferRef.current;
      tokenBufferRef.current = "";
      tokenRafRef.current = null;
      if (!chunk) return;
      setActiveConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m,
          ),
        };
      });
    };

    try {
      const result = await streamResearch(
        query,
        jurisdiction || undefined,
        priorHistory,
        {
          onStatus: (_stage, message) => setPendingStatus(message),
          onToken: (token) => {
            setPendingStatus(undefined);
            if (!assistantAdded) {
              assistantAdded = true;
              const assistantMsg: ChatMessage = {
                id: assistantMsgId,
                role: "assistant",
                content: token,
                createdAt: new Date().toISOString(),
              };
              setStreamingMessageId(assistantMsgId);
              setActiveConversation({
                ...withUser,
                messages: [...withUser.messages, assistantMsg],
              });
              return;
            }
            tokenBufferRef.current += token;
            if (tokenRafRef.current == null) {
              tokenRafRef.current = requestAnimationFrame(() => flushTokens(assistantMsgId));
            }
          },
          onCitations: (citationsResult) => {
            if (tokenRafRef.current != null) {
              cancelAnimationFrame(tokenRafRef.current);
              flushTokens(assistantMsgId);
            }
            setGroundingMessageId(assistantMsgId);
            setActiveConversation((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: citationsResult.answer || m.content,
                        research: {
                          ...citationsResult,
                          web_sources: citationsResult.web_sources ?? [],
                          web_images: citationsResult.web_images ?? [],
                          suggestions: [],
                        },
                      }
                    : m,
                ),
              };
            });
          },
        },
        { documentId: documentId ?? undefined, signal: controller.signal, sessionId: activeConversation?.id },
      );

      const finalized = createAssistantMessage(result);
      const completedConv: ChatConversation = {
        ...withUser,
        messages: [
          ...withUser.messages,
          { ...finalized, id: assistantMsgId, content: result.answer },
        ],
      };
      setActiveConversation(completedConv);
      upsertConversation(completedConv);
      setConversations(loadConversations());
    } catch (err) {
      if (controller.signal.aborted) return;
      toast({
        title: "Research failed",
        description: err instanceof Error ? err.message : "Could not complete research",
        variant: "destructive",
      });
      setActiveConversation(withUser);
    } finally {
      if (tokenRafRef.current != null) {
        cancelAnimationFrame(tokenRafRef.current);
        tokenRafRef.current = null;
      }
      tokenBufferRef.current = "";
      setIsResearching(false);
      setStreamingMessageId(null);
      setPendingStatus(undefined);
      setGroundingMessageId(null);
      abortRef.current = null;
      assistantMsgIdRef.current = null;
      withUserRef.current = null;
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
    const num = marker.replace(/[[\]]/g, "").replace(/^(KB|WEB)-/, "");
    const el = document.getElementById(`source-${num}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const hasMessages = (activeConversation?.messages.length ?? 0) > 0;

  return (
    <>
      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />

      {mobilePanelOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Session panel">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobilePanelOpen(false)}
            aria-label="Close panel"
          />
          <div className="absolute right-0 top-0 h-full w-[300px] max-w-[88vw]">
            <ContextPanel
              conversations={conversations}
              activeId={activeConversation?.id ?? null}
              onNewChat={() => {
                handleNewChat();
                setMobilePanelOpen(false);
              }}
              onSelectConversation={(id) => {
                handleSelectConversation(id);
                setMobilePanelOpen(false);
              }}
              onDeleteConversation={handleDeleteConversation}
              onRenameConversation={handleRenameConversation}
              onPinConversation={handlePinConversation}
              onMatterTypeChange={handleMatterTypeChange}
              onJurisdictionChange={handleJurisdictionChange}
              onQuickAction={setInput}
              activeConversation={activeConversation}
              speechLocale={speechLocale}
              onSpeechLocaleChange={handleSpeechLocaleChange}
              latestResearch={latestResearch}
              isSpeaking={readAloud.state.isSpeaking}
              onClose={() => setMobilePanelOpen(false)}
            />
          </div>
          <button
            type="button"
            className="absolute left-4 top-4 rounded-full glass p-2"
            onClick={() => setMobilePanelOpen(false)}
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <MeraVakilShell
      rightCollapsed={!rightPanelOpen}
      onOpenRightPanel={() => setRightPanelOpenPersisted(true)}
      center={
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-2.5 md:px-6">
            <BackButton />
            <div className="flex items-center gap-1">
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
                onClick={() => {
                  if (window.matchMedia("(min-width: 1024px)").matches) {
                    setRightPanelOpenPersisted(!rightPanelOpen);
                  } else {
                    setMobilePanelOpen(true);
                  }
                }}
                aria-label={rightPanelOpen ? "Hide session panel" : "Show session panel"}
                className="rounded-full"
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {!hasMessages && !isResearching ? (
            <EmptyState
              onQuickAction={(prompt) => sendMessage(prompt)}
              onOpenPremium={() => setPremiumOpen(true)}
            />
          ) : (
            <MessageList
              messages={activeConversation?.messages ?? []}
              isPending={isResearching && Boolean(pendingStatus)}
              pendingMessage={pendingStatus}
              streamingMessageId={streamingMessageId}
              isGenerating={isResearching}
              editingMessageId={editingMessageId}
              onCitationClick={handleCitationClick}
              onSuggestionSelect={(prompt) => sendMessage(prompt)}
              onStartEdit={setEditingMessageId}
              onCancelEdit={() => setEditingMessageId(null)}
              onResendEdit={handleResendEdit}
              onRegenerate={(userMessageId) => {
                const userMsg = activeConversation?.messages.find((m) => m.id === userMessageId);
                if (userMsg) void sendMessage(userMsg.content, { editMessageId: userMessageId });
              }}
              groundingMessageId={groundingMessageId}
              readAloudStatus={readAloud.state.status}
              readAloudActiveId={readAloud.state.activeMessageId}
              onReadAloudToggle={(id, content) => void readAloud.toggle(id, content)}
              onReadAloudStop={readAloud.stop}
            />
          )}

          <p className="px-4 pb-1 text-center text-[11px] text-muted-foreground/50">
            Informational only · Not a substitute for licensed legal advice
          </p>

          <InputDock
            value={input}
            onChange={setInput}
            onSubmit={() => sendMessage()}
            disabled={false}
            isPending={isResearching}
            isGenerating={isResearching}
            onStop={handleStopGeneration}
            isUploading={isUploading}
            onFileSelect={handleFileUpload}
          />
        </div>
      }
      right={
        <ContextPanel
          conversations={conversations}
          activeId={activeConversation?.id ?? null}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onPinConversation={handlePinConversation}
          onMatterTypeChange={handleMatterTypeChange}
          onJurisdictionChange={handleJurisdictionChange}
          onQuickAction={setInput}
          activeConversation={activeConversation}
          speechLocale={speechLocale}
          onSpeechLocaleChange={handleSpeechLocaleChange}
          latestResearch={latestResearch}
          isSpeaking={readAloud.state.isSpeaking}
          onClose={() => setRightPanelOpenPersisted(false)}
        />
      }
    />
    </>
  );
}
