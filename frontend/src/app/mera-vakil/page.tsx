"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, PanelRight, Sun } from "lucide-react";

import { BackButton } from "@/components/layout/back-button";
import { BookingDialog } from "@/components/lawyer-marketplace/booking-dialog";
import { EmptyState } from "@/components/mera-vakil/empty-state";
import { SaarthiDisclaimerBanner } from "@/components/mera-vakil/saarthi-disclaimer-banner";
import { InputDock } from "@/components/mera-vakil/input-dock";
import { StarterSuggestions } from "@/components/mera-vakil/starter-suggestions";
import { MeraVakilShell } from "@/components/mera-vakil/mera-vakil-shell";
import { MessageList } from "@/components/mera-vakil/message-list";
import { Skeleton } from "@/components/ui/skeleton";
import { isVoiceBotSupported, type VoiceMessage } from "@/hooks/use-voice-bot";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useReadAloud } from "@/hooks/use-read-aloud";
import { useStreamingReveal } from "@/hooks/use-streaming-reveal";
import {
  AnalyticsEvents,
  bucketCount,
  bucketFileSize,
  bucketLatency,
  track,
  trackAiSessionCompleted,
} from "@/lib/analytics";
import { streamResearch, uploadUserDocument, extractCaseBrief, createCase, updateCaseApi, attachDocumentToSession, detachDocumentFromSession } from "@/lib/api";
import {
  buildDefaultAttachmentQuery,
  isImageFile,
  type ComposerAttachment,
} from "@/lib/composer-attachments";
import { FEATURES } from "@/lib/features";
import {
  consumeMeraVakilAutoSend,
  consumeMeraVakilPrefill,
  consumeMeraVakilVoiceOpen,
} from "@/lib/prefill-store";
import { loadSpeechLocale } from "@/lib/indian-locales";
import {
  createAssistantMessage,
  createConversation,
  createUserMessage,
  type ChatAttachment,
  deleteConversation,
  deriveTitleFromQuery,
  initConversations,
  loadActiveConversationId,
  loadConversations,
  renameConversation,
  saveActiveConversationId,
  togglePinConversation,
  upsertConversation,
  toResearchHistory,
  type AttachedDocument,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/conversations";
import type { LawyerMatchResult, LawyerProfile, ResearchResponse } from "@/lib/types";

const ContextPanel = dynamic(
  () =>
    import("@/components/mera-vakil/counsel-rail").then((m) => ({
      default: m.ContextPanel,
    })),
  { loading: () => <Skeleton className="h-full w-full" /> },
);

const VoiceModeOverlay = dynamic(
  () =>
    import("@/components/mera-vakil/voice-mode-overlay").then((m) => ({
      default: m.VoiceModeOverlay,
    })),
  { ssr: false },
);

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
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const uploadAbortRefs = useRef<Map<string, AbortController>>(new Map());
  const pendingUploadFilesRef = useRef<Map<string, File>>(new Map());
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const [voiceBookingLawyer, setVoiceBookingLawyer] = useState<LawyerProfile | null>(null);
  const [voiceSupported] = useState(() => isVoiceBotSupported());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const mobilePanelTriggerRef = useRef<HTMLButtonElement>(null);
  const assistantMsgIdRef = useRef<string | null>(null);
  const withUserRef = useRef<ChatConversation | null>(null);
  // From /ask: a question to auto-send once hydrated, and a flag to fire the
  // first_answer_shown conversion when its first response arrives.
  const autoSendQuestionRef = useRef<string | null>(null);
  const firstAnswerPendingRef = useRef(false);
  const streamReveal = useStreamingReveal();
  const streamGenerationRef = useRef(0);
  const [groundingMessageId, setGroundingMessageId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const readAloud = useReadAloud(speechLocale);

  // Draft case ID keyed by session (conversation) ID
  const [isResearching, setIsResearching] = useState(false);
  const [draftCaseId, setDraftCaseId] = useState<string | null>(null);
  const [lastExtractedTurnCount, setLastExtractedTurnCount] = useState(0);
  const extractingRef = useRef(false);

  // Auto-extract case brief after every 3rd turn (3, 6, 9, ...)
  const totalMessageCount = activeConversation?.messages.length ?? 0;
  const sessionId = activeConversation?.id ?? null;

  // Refs so cleanup/unmount handlers can read latest values without stale closures.
  // Updated inline (not just in effects) so they are always current during the same render.
  const sessionIdRef = useRef<string | null>(sessionId);
  const draftCaseIdRef = useRef<string | null>(draftCaseId);
  const totalMessageCountRef = useRef<number>(totalMessageCount);
  const activeConversationRef = useRef<ChatConversation | null>(activeConversation);
  sessionIdRef.current = sessionId;
  draftCaseIdRef.current = draftCaseId;
  totalMessageCountRef.current = totalMessageCount;
  activeConversationRef.current = activeConversation;

  useEffect(() => {
    const msgId = assistantMsgIdRef.current;
    if (!msgId || streamReveal.phase === "idle" || streamReveal.phase === "waiting") return;

    setActiveConversation((prev) => {
      if (!prev) return prev;
      if (!prev.messages.some((m) => m.id === msgId)) return prev;
      return {
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === msgId
            ? {
                ...m,
                content: streamReveal.content,
                revealedChars: streamReveal.revealedChars,
              }
            : m,
        ),
      };
    });
  }, [streamReveal.content, streamReveal.revealedChars, streamReveal.phase]);

  useEffect(() => {
    if (!FEATURES.CASE_BRIEF) return;
    if (!sessionId) return;
    if (totalMessageCount < 10) return;
    if (totalMessageCount <= lastExtractedTurnCount) return;
    const nextThreshold = Math.floor(totalMessageCount / 10) * 10;
    if (nextThreshold <= lastExtractedTurnCount) return;
    if (extractingRef.current) return;
    if (isResearching) return;

    extractingRef.current = true;
    setLastExtractedTurnCount(nextThreshold);

    void (async () => {
      try {
        const brief = await extractCaseBrief(sessionId);
        const ai_brief = {
          problem_summary: brief.problem_summary,
          key_facts: brief.key_facts,
          parties: brief.parties,
          jurisdiction: brief.jurisdiction,
          practice_area: brief.practice_area,
          legal_issues: brief.legal_issues,
          recommended_actions: brief.recommended_actions,
          urgency: brief.urgency,
          extracted_at: new Date().toISOString(),
          session_id: sessionId,
        };

        let caseId = draftCaseId;
        if (!caseId) {
          const created = await createCase({
            title: brief.case_title,
            description: brief.problem_summary,
            practice_area: brief.practice_area ?? "",
            jurisdiction: brief.jurisdiction ?? "",
            status: "draft",
            source: "saarthi",
            session_id: sessionId,
            ai_brief: ai_brief as Record<string, unknown>,
          });
          caseId = created.id;
          setDraftCaseId(caseId);
          // Persist so returning to this conversation doesn't create a duplicate case
          setActiveConversation((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, draftCaseId: caseId };
            upsertConversation(updated);
            return updated;
          });
        } else {
          await updateCaseApi(caseId, {
            title: brief.case_title,
            ai_brief: ai_brief as Record<string, unknown>,
          });
        }

        toast({
          title: "Case brief prepared",
          description: "Your AI case brief is ready. Visit Case Management to review it.",
        });
      } catch {
        // Extraction failure is silent — don't interrupt the user
      } finally {
        extractingRef.current = false;
      }
    })();
  }, [totalMessageCount, sessionId, isResearching]);

  useEffect(() => {
    void (async () => {
      // Load theme and panel state synchronously so UI doesn't flash
      const stored = localStorage.getItem(THEME_KEY);
      const prefersDark = stored === "dark";
      setDark(prefersDark);
      document.documentElement.classList.toggle("dark", prefersDark);
      setSpeechLocale(loadSpeechLocale());
      const panelStored = localStorage.getItem(CONTEXT_PANEL_KEY);
      if (panelStored !== null) setRightPanelOpen(panelStored === "true");
      const prefill = consumeMeraVakilPrefill();
      if (prefill) {
        setInput(prefill);
        // The landing stashes the question + an auto-send flag so the visitor's
        // answer generates immediately after sign-in — no retyping. Deferred to
        // the one-shot effect below (after hydration) so sendMessage has state.
        if (consumeMeraVakilAutoSend()) autoSendQuestionRef.current = prefill;
      } else {
        // Logged-in entry from a legal-guide CTA (/mera-vakil?topic=…) — prefill
        // a relevant starter (not auto-sent; the user reviews/edits first).
        const topic = new URLSearchParams(window.location.search).get("topic");
        const topicText =
          topic === "property"
            ? "I have a property dispute — what are my rights?"
            : topic === "family"
              ? "I need help with a family law matter (divorce, custody or maintenance)."
              : topic === "labour"
                ? "I have a workplace or salary issue — what can I do?"
                : "";
        if (topicText) setInput(topicText);
      }
      const wantVoice =
        consumeMeraVakilVoiceOpen() || new URLSearchParams(window.location.search).get("voice") === "1";
      if (wantVoice && FEATURES.VOICE && isVoiceBotSupported()) setVoiceModeOpen(true);

      // Fetch conversations from server (falls back to [] on error)
      const all = await initConversations();
      setConversations(all);
      // A shared/deep link is explicit, otherwise continue the user's last active matter.
      // The active ID is recorded whenever a conversation is selected or created, so a
      // browser refresh must not drop the user back onto the empty Saarthi screen.
      const convId =
        new URLSearchParams(window.location.search).get("c") || loadActiveConversationId();
      if (convId) {
        const found = all.find((c) => c.id === convId);
        if (found) {
          setActiveConversation(found);
          setDraftCaseId(found.draftCaseId ?? null);
          saveActiveConversationId(found.id);
        } else if (loadActiveConversationId() === convId) {
          // Do not repeatedly attempt to restore a conversation that was deleted or is
          // no longer available to this user.
          saveActiveConversationId(null);
        }
      }
      setHydrated(true);
    })();
  }, []);

  // Auto-send the question carried over from /ask, once hydration has set up
  // conversation state. One-shot: the ref is cleared before sending.
  useEffect(() => {
    if (!hydrated) return;
    const q = autoSendQuestionRef.current;
    if (!q) return;
    autoSendQuestionRef.current = null;
    firstAnswerPendingRef.current = true;
    void sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (voiceModeOpen) {
      track(AnalyticsEvents.SAARTHI_VOICE_MODE_ACTIVATED, { voice_supported: voiceSupported });
    }
  }, [voiceModeOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mobilePanelOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      const panel = mobilePanelRef.current;
      const initialFocus = panel?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      (initialFocus ?? panel)?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobilePanelOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const panel = mobilePanelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      mobilePanelTriggerRef.current?.focus();
    };
  }, [mobilePanelOpen]);

  function setRightPanelOpenPersisted(open: boolean) {
    setRightPanelOpen(open);
    localStorage.setItem(CONTEXT_PANEL_KEY, String(open));
  }

  const documentId = activeConversation?.documentId ?? null;
  const jurisdiction = activeConversation?.jurisdiction ?? "";

  const runFinalExtraction = useCallback(async (sid: string, currentDraftCaseId: string | null) => {
    if (!FEATURES.CASE_BRIEF) return;
    if (extractingRef.current) return;
    extractingRef.current = true;
    try {
      const brief = await extractCaseBrief(sid);
      const ai_brief = {
        problem_summary: brief.problem_summary,
        key_facts: brief.key_facts,
        parties: brief.parties,
        jurisdiction: brief.jurisdiction,
        practice_area: brief.practice_area,
        legal_issues: brief.legal_issues,
        recommended_actions: brief.recommended_actions,
        urgency: brief.urgency,
        extracted_at: new Date().toISOString(),
        session_id: sid,
        is_final: true,
      };
      if (!currentDraftCaseId) {
        await createCase({
          title: brief.case_title,
          description: brief.problem_summary,
          practice_area: brief.practice_area ?? "",
          jurisdiction: brief.jurisdiction ?? "",
          status: "draft",
          source: "saarthi",
          session_id: sid,
          ai_brief: ai_brief as Record<string, unknown>,
        });
      } else {
        await updateCaseApi(currentDraftCaseId, {
          title: brief.case_title,
          ai_brief: ai_brief as Record<string, unknown>,
        });
      }
    } catch {
      // Silent — don't block the user flow
    } finally {
      extractingRef.current = false;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On mount: pick up any pending extraction saved when the user closed the tab
  useEffect(() => {
    const raw = localStorage.getItem("pending_extraction");
    if (!raw) return;
    localStorage.removeItem("pending_extraction");
    try {
      const { sessionId: sid, draftCaseId: cid } = JSON.parse(raw) as {
        sessionId: string;
        draftCaseId: string | null;
      };
      if (sid) void runFinalExtraction(sid, cid);
    } catch {
      // Malformed entry — ignore
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On unmount (SPA navigation away) + tab close → trigger final extraction
  useEffect(() => {
    function handleBeforeUnload() {
      const sid = sessionIdRef.current;
      const count = totalMessageCountRef.current;
      const cid = draftCaseIdRef.current;
      if (sid && count >= 10) {
        // Store for pickup on next load (async fetch unreliable on tab close)
        localStorage.setItem("pending_extraction", JSON.stringify({ sessionId: sid, draftCaseId: cid }));
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      trackAiSessionCompleted(activeConversationRef.current);
      // SPA navigation: component unmounts but JS context stays alive — fetch completes
      const sid = sessionIdRef.current;
      const count = totalMessageCountRef.current;
      const cid = draftCaseIdRef.current;
      if (sid && count >= 10) {
        void runFinalExtraction(sid, cid);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNewChat() {
    trackAiSessionCompleted(activeConversation);
    // Fire final extraction for the session that's ending
    if (sessionId && totalMessageCount >= 10) {
      void runFinalExtraction(sessionId, draftCaseId);
    }
    const conv = createConversation({
      documentId,
      jurisdiction: jurisdiction || null,
      matterType: activeConversation?.matterType ?? null,
    });
    setActiveConversation(conv);
    saveActiveConversationId(conv.id);
    setInput("");
    clearComposerAttachments();
    setStreamingMessageId(null);
    setPendingStatus(undefined);
    setEditingMessageId(null);
    setDraftCaseId(null);
    setLastExtractedTurnCount(0);
  }

  function handleVoiceConversationEnd(messages: VoiceMessage[], lawyers: LawyerMatchResult[]) {
    if (messages.length === 0) return;
    const chatMessages: ChatMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: new Date().toISOString(),
    }));
    // Attach lawyer results to the last assistant message so LawyerRecommendationPanel renders
    if (lawyers.length > 0) {
      const lastAssistantIdx = [...chatMessages].reverse().findIndex((m) => m.role === "assistant");
      if (lastAssistantIdx !== -1) {
        const idx = chatMessages.length - 1 - lastAssistantIdx;
        chatMessages[idx] = {
          ...chatMessages[idx],
          research: {
            query: chatMessages[idx].content.slice(0, 80),
            intent: "voice",
            jurisdiction: {
              country: "IN",
              level: jurisdiction ? "state" : "national",
              region: jurisdiction || null,
              confidence: 1,
            },
            answer: chatMessages[idx].content,
            sources: [],
            web_sources: [],
            web_images: [],
            suggestions: [],
            citations: [],
            confidence: {
              retrieval_strength: 1,
              source_agreement: 1,
              coverage: 1,
              overall: 1,
            },
            trace: [],
            specialist_payload: { lawyers },
            disclaimer: "",
          } satisfies ResearchResponse,
        };
      }
    }
    const base = activeConversation ?? createConversation({ documentId, jurisdiction: jurisdiction || null });
    const firstUserMsg = messages.find((m) => m.role === "user");
    const updated: ChatConversation = {
      ...base,
      title: base.messages.length === 0 && firstUserMsg
        ? firstUserMsg.content.slice(0, 48)
        : base.title,
      messages: [...base.messages, ...chatMessages],
      updatedAt: new Date().toISOString(),
    };
    upsertConversation(updated);
    setConversations(loadConversations());
    setActiveConversation(updated);

    // Final extraction when voice session ends (>= 10 messages)
    if (updated.messages.length >= 10) {
      void runFinalExtraction(updated.id, draftCaseId);
    }
  }

  function handleSelectConversation(id: string) {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      if (activeConversation?.id !== id) {
        trackAiSessionCompleted(activeConversation);
      }
      setActiveConversation(conv);
      saveActiveConversationId(conv.id);
      setInput("");
      clearComposerAttachments();
      setStreamingMessageId(null);
      setPendingStatus(undefined);
      setEditingMessageId(null);
      setDraftCaseId(conv.draftCaseId ?? null);
      setLastExtractedTurnCount(0);
    }
  }

  function handleDeleteConversation(id: string) {
    if (activeConversation?.id === id) {
      trackAiSessionCompleted(activeConversation);
    }
    deleteConversation(id);
    const updated = loadConversations();
    setConversations(updated);
    if (activeConversation?.id === id) {
      setActiveConversation(null);
      saveActiveConversationId(null);
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

  function clearComposerAttachments() {
    setComposerAttachments((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
    pendingUploadFilesRef.current.clear();
    uploadAbortRefs.current.forEach((ctrl) => ctrl.abort());
    uploadAbortRefs.current.clear();
  }

  function ensureUploadConversation(): ChatConversation {
    let conv = activeConversationRef.current;
    if (!conv) {
      conv = createConversation({ jurisdiction: jurisdiction || null, matterType: null });
      setActiveConversation(conv);
      saveActiveConversationId(conv.id);
      upsertConversation(conv);
      setConversations(loadConversations());
    }
    return conv;
  }

  async function uploadComposerFile(localId: string, file: File, targetSessionId: string) {
    const abort = new AbortController();
    uploadAbortRefs.current.set(localId, abort);
    pendingUploadFilesRef.current.set(localId, file);

    const previewUrl = isImageFile(file.name, file.type) ? URL.createObjectURL(file) : undefined;

    setComposerAttachments((prev) => {
      const existing = prev.find((item) => item.localId === localId);
      if (existing) {
        return prev.map((item) =>
          item.localId === localId
            ? { ...item, status: "uploading", percent: 8, error: undefined }
            : item,
        );
      }
      return [
        ...prev,
        {
          localId,
          fileName: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          previewUrl,
          status: "uploading",
          percent: 8,
        },
      ];
    });

    try {
      const uploaded = await uploadUserDocument(
        file,
        {
          title: file.name.replace(/\.[^.]+$/, "") || file.name,
          doc_type: "user_upload",
        },
        (percent) => {
          setComposerAttachments((prev) =>
            prev.map((item) =>
              item.localId === localId
                ? { ...item, percent: Math.min(90, percent), status: "uploading" }
                : item,
            ),
          );
        },
        abort.signal,
      );

      setComposerAttachments((prev) =>
        prev.map((item) =>
          item.localId === localId ? { ...item, percent: 94, status: "reading" } : item,
        ),
      );

      const documentIdValue = uploaded.document_id;

      setActiveConversation((prev) => {
        if (!prev) return prev;
        const newDoc: AttachedDocument = {
          id: documentIdValue,
          name: file.name,
          size: file.size,
          contentType: file.type,
        };
        const already = prev.attachedDocuments?.some((doc) => doc.id === documentIdValue);
        if (already) return prev;
        const updated = { ...prev, attachedDocuments: [...(prev.attachedDocuments ?? []), newDoc] };
        upsertConversation(updated);
        return updated;
      });

      try {
        await attachDocumentToSession(targetSessionId, documentIdValue);
      } catch (err) {
        toast({
          title: "Could not attach to session",
          description: err instanceof Error ? err.message : "The file uploaded; context may still apply on send.",
          variant: "destructive",
        });
      }

      const ready = uploaded.status === "ready" || uploaded.status === "indexed";
      setComposerAttachments((prev) =>
        prev.map((item) =>
          item.localId === localId
            ? {
                ...item,
                percent: 100,
                status: "ready",
                documentId: documentIdValue,
                error: undefined,
              }
            : item,
        ),
      );

      track(AnalyticsEvents.SAARTHI_DOCUMENT_ATTACHED, {
        file_type_category: file.type.split("/")[0] || "other",
        file_size_bucket: bucketFileSize(file.size),
        processing_status: ready ? "ready" : "pending",
      });

    } catch (err) {
      if ((err as DOMException).name === "AbortError") {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setComposerAttachments((prev) => prev.filter((item) => item.localId !== localId));
        return;
      }
      setComposerAttachments((prev) =>
        prev.map((item) =>
          item.localId === localId
            ? {
                ...item,
                status: "failed",
                percent: 100,
                error: err instanceof Error ? err.message : "Could not upload document",
              }
            : item,
        ),
      );
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not upload document",
        variant: "destructive",
      });
    } finally {
      uploadAbortRefs.current.delete(localId);
    }
  }

  function handleFilesSelected(files: File[]) {
    if (isResearching || files.length === 0) return;
    const conv = ensureUploadConversation();
    for (const file of files) {
      const localId = crypto.randomUUID?.() ?? `file-${Date.now()}-${Math.random()}`;
      void uploadComposerFile(localId, file, conv.id);
    }
  }

  function handleRemoveComposerAttachment(localId: string) {
    uploadAbortRefs.current.get(localId)?.abort();
    uploadAbortRefs.current.delete(localId);
    pendingUploadFilesRef.current.delete(localId);

    let documentId: string | undefined;
    let previewUrl: string | undefined;

    setComposerAttachments((prev) => {
      const item = prev.find((entry) => entry.localId === localId);
      documentId = item?.documentId;
      previewUrl = item?.previewUrl;
      return prev.filter((entry) => entry.localId !== localId);
    });

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (documentId && sessionIdRef.current) {
      void detachDocumentFromSession(sessionIdRef.current, documentId).catch(() => undefined);
      setActiveConversation((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          attachedDocuments: (prev.attachedDocuments ?? []).filter((doc) => doc.id !== documentId),
        };
        upsertConversation(updated);
        return updated;
      });
    }
  }

  function handleRetryComposerAttachment(localId: string) {
    const file = pendingUploadFilesRef.current.get(localId);
    if (!file) return;
    const conv = ensureUploadConversation();
    void uploadComposerFile(localId, file, conv.id);
  }

  async function handleComposerSend(text: string) {
    if (isResearching) return;
    const ready = composerAttachments.filter((item) => item.status === "ready" && item.documentId);
    const query = text.trim().length >= 3 ? text.trim() : buildDefaultAttachmentQuery(ready);
    if (query.length < 3) return;

    const uploadedAttachments: ChatAttachment[] = ready.map((item) => ({
      id: item.documentId!,
      name: item.fileName,
      size: item.size,
      contentType: item.contentType,
    }));

    await sendMessage(query, { attachments: uploadedAttachments, clearComposerAttachments: true });
  }

  function handleStopGeneration() {
    const generation = streamGenerationRef.current;
    abortRef.current?.abort();
    streamReveal.stopRaf();
    streamReveal.flush();

    const assistantId = assistantMsgIdRef.current;
    const baseConv = withUserRef.current;
    const partialContent = streamReveal.content;
    const partialRevealed = streamReveal.revealedChars;

    let stoppedConv: ChatConversation | null = null;

    setActiveConversation((prev) => {
      if (!prev || !assistantId) {
        stoppedConv = baseConv ?? prev;
        return stoppedConv;
      }
      const assistant = prev.messages.find((m) => m.id === assistantId);
      const content = partialContent || assistant?.content || "";
      if (!content.trim()) {
        stoppedConv = baseConv ?? prev;
        return stoppedConv;
      }
      const stoppedAssistant: ChatMessage = {
        ...(assistant ?? {
          id: assistantId,
          role: "assistant" as const,
          createdAt: new Date().toISOString(),
        }),
        content,
        revealedChars: Math.min(partialRevealed || content.length, content.length),
      };
      const baseMessages = baseConv?.messages ?? prev.messages.filter((m) => m.id !== assistantId);
      stoppedConv = {
        ...(baseConv ?? prev),
        messages: [...baseMessages.filter((m) => m.id !== assistantId), stoppedAssistant],
      };
      return stoppedConv;
    });

    if (stoppedConv) {
      upsertConversation(stoppedConv);
      setConversations(loadConversations());
    }

    setIsResearching(false);
    setPendingStatus(undefined);
    setGroundingMessageId(null);
    abortRef.current = null;

    void streamReveal.waitForAnimation(300).then(() => {
      if (streamGenerationRef.current !== generation) return;
      setStreamingMessageId(null);
      assistantMsgIdRef.current = null;
      withUserRef.current = null;
      streamReveal.reset();
    });

    toast({ title: "Response stopped", description: "Generation was cancelled." });
  }

  async function sendMessage(
    queryText?: string,
    options?: {
      editMessageId?: string;
      attachments?: ChatAttachment[];
      clearComposerAttachments?: boolean;
    },
  ) {
    const query = (queryText ?? input).trim();
    if (query.length < 3 || isResearching) return;

    // Use ref to always read the latest conversation state, regardless of when
    // this function was created (avoids stale closure when called from memoized callbacks).
    let conv = activeConversationRef.current;
    if (!conv) {
      conv = createConversation({
        title: deriveTitleFromQuery(query),
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

    const userMsg = createUserMessage(query, options?.attachments);
    const priorHistory = toResearchHistory(baseMessages);
    const extraDocs = (options?.attachments ?? []).filter(
      (item) => !(conv.attachedDocuments ?? []).some((doc) => doc.id === item.id),
    );
    const attachedDocuments = [
      ...(conv.attachedDocuments ?? []),
      ...extraDocs.map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        contentType: item.contentType,
      })),
    ];
    const withUser: ChatConversation = {
      ...conv,
      title: baseMessages.length === 0 ? deriveTitleFromQuery(query) : conv.title,
      messages: [...baseMessages, userMsg],
      attachedDocuments,
    };
    setActiveConversation(withUser);
    saveActiveConversationId(withUser.id);
    upsertConversation(withUser);
    setConversations(loadConversations());
    if (options?.clearComposerAttachments) {
      clearComposerAttachments();
    }
    setInput("");
    setEditingMessageId(null);
    abortRef.current?.abort();
    streamReveal.reset();
    const generation = ++streamGenerationRef.current;
    setStreamingMessageId(null);
    setPendingStatus("Understanding your question…");
    setIsResearching(true);

    const startedAt = Date.now();
    const isNewChat = baseMessages.length === 0;
    if (isNewChat) {
      track(AnalyticsEvents.AI_CHAT_STARTED, { session_type: "saarthi", entry_point: "composer" });
    }
    track(AnalyticsEvents.AI_MESSAGE_SENT, {
      has_attachment: Boolean(options?.attachments?.length),
      message_count_bucket: bucketCount(withUser.messages.length),
      interaction_type: options?.editMessageId ? "edit_resend" : "send",
    });

    const assistantMsgId = crypto.randomUUID?.() ?? `asst-${Date.now()}`;
    assistantMsgIdRef.current = assistantMsgId;
    withUserRef.current = withUser;

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantAdded = false;
    streamReveal.startWaiting();
    setGroundingMessageId(null);

    const ensureAssistantShell = () => {
      if (assistantAdded) return;
      assistantAdded = true;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        revealedChars: 0,
      };
      setStreamingMessageId(assistantMsgId);
      setActiveConversation({
        ...withUser,
        messages: [...withUser.messages, assistantMsg],
      });
    };

    try {
      const result = await streamResearch(
        query,
        jurisdiction || undefined,
        priorHistory,
        {
          onStatus: (_stage, message) => {
            setPendingStatus(message);
            ensureAssistantShell();
          },
          onToken: (token) => {
            setPendingStatus(undefined);
            ensureAssistantShell();
            streamReveal.appendToken(token);
          },
          onCitations: (citationsResult) => {
            streamReveal.flush();
            setGroundingMessageId(assistantMsgId);
            // Conversion: the /ask visitor's first question just got its answer.
            if (firstAnswerPendingRef.current) {
              firstAnswerPendingRef.current = false;
              track(AnalyticsEvents.FIRST_ANSWER_SHOWN, {});
            }
            const streamed = streamReveal.content.trim();
            const guardrailed = (citationsResult.answer ?? "").trim();
            if (guardrailed && guardrailed !== streamed) {
              streamReveal.setContent(citationsResult.answer);
            }
            setActiveConversation((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
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
          onDraftStatus: () => {
            // Show loading card immediately while draft generates
            setActiveConversation((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        research: m.research
                          ? { ...m.research, specialist_payload: { ...m.research.specialist_payload, draft_loading: true } }
                          : m.research,
                      }
                    : m,
                ),
              };
            });
          },
          onDraft: (draft) => {
            // Replace loading flag with actual draft, then persist
            setActiveConversation((prev) => {
              if (!prev) return prev;
              const updated = {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        research: m.research
                          ? {
                              ...m.research,
                              specialist_payload: {
                                ...m.research.specialist_payload,
                                draft_loading: false,
                                draft,
                              },
                            }
                          : m.research,
                      }
                    : m,
                ),
              };
              // Persist after draft arrives
              upsertConversation(updated);
              return updated;
            });
          },
        },
        {
          signal: controller.signal,
          sessionId: conv.id,
          documentIds: (withUser.attachedDocuments ?? []).map((d) => d.id),
        },
      );

      streamReveal.complete();
      streamReveal.flush();

      const finalized = createAssistantMessage(result);
      const finalMsg = {
        ...finalized,
        id: assistantMsgId,
        content: result.answer,
        revealedChars: result.answer.length,
      };

      // Persist immediately — before the animation wait — so navigating away
      // during the typewriter effect doesn't lose the AI response.
      // withUser is a closure variable (not React state) so it's always available.
      const completedConv: ChatConversation = {
        ...withUser,
        messages: [...withUser.messages, finalMsg],
      };
      upsertConversation(completedConv);
      setConversations(loadConversations());

      setActiveConversation((prev) => {
        if (!prev) return prev;
        const hasAssistant = prev.messages.some((m) => m.id === assistantMsgId);
        const messages = hasAssistant
          ? prev.messages.map((m) => (m.id === assistantMsgId ? finalMsg : m))
          : [...prev.messages, finalMsg];
        return { ...prev, messages };
      });
      await streamReveal.waitForAnimation(3000);
      track(AnalyticsEvents.AI_RESPONSE_RECEIVED, {
        latency_bucket: bucketLatency(Date.now() - startedAt),
        has_citations: Boolean(result.citations?.length || result.web_sources?.length),
        response_status: "success",
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      toast({
        title: "Research failed",
        description: err instanceof Error ? err.message : "Could not complete research",
        variant: "destructive",
      });
      setActiveConversation(withUser);
      streamReveal.reset();
    } finally {
      streamReveal.flush();
      if (controller.signal.aborted) {
        abortRef.current = null;
        return;
      }
      setIsResearching(false);
      setPendingStatus(undefined);
      setGroundingMessageId(null);
      abortRef.current = null;

      void streamReveal.waitForAnimation(300).then(() => {
        if (streamGenerationRef.current !== generation) return;
        setStreamingMessageId(null);
        assistantMsgIdRef.current = null;
        withUserRef.current = null;
        streamReveal.reset();
      });
    }
  }

  function handleResendEdit(messageId: string, newContent: string) {
    void sendMessage(newContent, { editMessageId: messageId });
  }

  const handleCitationClick = useCallback((marker: string) => {
    const num = marker.replace(/[[\]]/g, "").replace(/^(KB|WEB)-/, "");
    const el = document.getElementById(`source-${num}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleSuggestionSelect = useCallback(
    (prompt: string) => {
      void sendMessage(prompt);
    },
    // sendMessage reads activeConversationRef.current (always fresh) so stale closure is not
    // a concern; isResearching in deps ensures the guard inside sendMessage is re-evaluated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isResearching],
  );

  const handleReadAloudToggle = useCallback(
    (id: string, content: string) => {
      void readAloud.toggle(id, content);
    },
    [readAloud],
  );

  const handleReadAloudStop = useCallback(() => {
    readAloud.stop();
  }, [readAloud]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  }

  function matchResultToProfile(lawyer: LawyerMatchResult): LawyerProfile {
    return {
      id: lawyer.id,
      slug: lawyer.slug,
      full_name: lawyer.full_name,
      bar_council_id: lawyer.bar_council_id ?? "",
      practice_areas: lawyer.practice_areas,
      city: lawyer.city ?? lawyer.jurisdictions[0] ?? "India",
      jurisdictions: lawyer.jurisdictions,
      languages: lawyer.languages,
      years_experience: lawyer.years_experience,
      rating: lawyer.rating,
      review_count: lawyer.rating_count,
      verified: lawyer.is_verified,
      hourly_rate_inr: lawyer.hourly_rate,
      bio: lawyer.summary,
    };
  }

  const hasMessages = (activeConversation?.messages.length ?? 0) > 0;

  return (
    <>
      {FEATURES.BOOKING && (
        <BookingDialog
          lawyer={voiceBookingLawyer}
          open={Boolean(voiceBookingLawyer)}
          source="ai_match"
          caseId={draftCaseId}
          onClose={() => setVoiceBookingLawyer(null)}
          onBooked={() => setVoiceBookingLawyer(null)}
        />
      )}
      {FEATURES.VOICE && (
        <VoiceModeOverlay
          open={voiceModeOpen}
          onClose={() => setVoiceModeOpen(false)}
          speechLocale={speechLocale}
          conversationMessages={activeConversation?.messages}
          onConversationEnd={handleVoiceConversationEnd}
          onBookLawyer={FEATURES.BOOKING ? (lawyer) => setVoiceBookingLawyer(matchResultToProfile(lawyer)) : undefined}
        />
      )}

      {mobilePanelOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Conversation history">
          <button
            type="button"
            className="mv-mobile-drawer-backdrop absolute inset-0"
            onClick={() => setMobilePanelOpen(false)}
            aria-label="Dismiss conversation history"
          />
          <div
            ref={mobilePanelRef}
            tabIndex={-1}
            data-presentation="drawer"
            className="mv-mobile-conversation-drawer absolute inset-y-0 right-0 flex flex-col overflow-hidden outline-none"
          >
            <ContextPanel
              presentation="drawer"
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
              onClose={() => setMobilePanelOpen(false)}
            />
          </div>
        </div>
      )}

      <MeraVakilShell
      rightCollapsed={!rightPanelOpen}
      onOpenRightPanel={() => setRightPanelOpenPersisted(true)}
      center={
        <div className="flex h-full min-h-0 flex-col">
          <SaarthiDisclaimerBanner />
          <header className="app-topbar flex shrink-0 items-center justify-between gap-3 px-4 py-2.5 md:px-6">
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
                ref={mobilePanelTriggerRef}
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

          {!hydrated ? (
            <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-4 px-4 py-8 md:px-6">
              <Skeleton className="ml-auto h-16 w-[70%] rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-20 w-[85%] rounded-2xl" />
            </div>
          ) : !hasMessages && !isResearching ? (
            <EmptyState />
          ) : (
            <MessageList
              messages={activeConversation?.messages ?? []}
              isPending={isResearching && !streamingMessageId}
              pendingMessage={pendingStatus}
              streamingMessageId={streamingMessageId}
              isGenerating={isResearching}
              editingMessageId={editingMessageId}
              onCitationClick={handleCitationClick}
              onSuggestionSelect={handleSuggestionSelect}
              onStartEdit={setEditingMessageId}
              onCancelEdit={() => setEditingMessageId(null)}
              onResendEdit={handleResendEdit}
              groundingMessageId={groundingMessageId}
              readAloudStatus={readAloud.state.status}
              readAloudActiveId={readAloud.state.activeMessageId}
              onReadAloudToggle={handleReadAloudToggle}
              onReadAloudStop={handleReadAloudStop}
              caseId={draftCaseId}
            />
          )}

          {hydrated && !hasMessages && !isResearching ? (
            <StarterSuggestions
              onSelect={(prompt) => sendMessage(prompt)}
              disabled={isResearching}
            />
          ) : null}

          <InputDock
            value={input}
            onChange={setInput}
            onSend={handleComposerSend}
            composerAttachments={composerAttachments}
            onFilesSelected={handleFilesSelected}
            onRemoveAttachment={handleRemoveComposerAttachment}
            onRetryAttachment={handleRetryComposerAttachment}
            disabled={false}
            isPending={isResearching}
            isGenerating={isResearching}
            onStop={handleStopGeneration}
            onVoiceModeOpen={FEATURES.VOICE && voiceSupported ? () => setVoiceModeOpen(true) : undefined}
            onVoiceNoteError={(message) =>
              toast({ title: "Voice input", description: message, variant: "destructive" })
            }
          />
          <p className="-mt-2 hidden px-4 pb-2 text-center text-[11px] text-muted-foreground/50 sm:block">
            Informational only · Not a substitute for licensed legal advice
          </p>
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
          onClose={() => setRightPanelOpenPersisted(false)}
        />
      }
    />
    </>
  );
}
