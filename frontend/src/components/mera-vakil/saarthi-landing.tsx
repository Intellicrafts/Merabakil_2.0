"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Lock, Scale, ShieldCheck, Square } from "lucide-react";

import { AskAuthSheet } from "@/components/ask/ask-auth-sheet";
import { AskComposer } from "@/components/ask/ask-composer";
import { BrandLogo } from "@/components/brand/brand-logo";
import { MessageList } from "@/components/mera-vakil/message-list";
import { StarterSuggestions } from "@/components/mera-vakil/starter-suggestions";
import { VoiceModeOverlay } from "@/components/mera-vakil/voice-mode-overlay";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { AnalyticsEvents, bucketLatency, captureUtmFromSearch, track } from "@/lib/analytics";
import { GuestLimitError, streamResearchGuest } from "@/lib/api";
import { chatErrorCode } from "@/lib/chat-errors";
import { createUserMessage, toResearchHistory, type ChatMessage } from "@/lib/conversations";
import { FEATURES } from "@/lib/features";
import {
  canGuestChat,
  canGuestVoice,
  getGuestSessionId,
  guestChatsRemaining,
  markGuestChatLimitReached,
  recordGuestChat,
  recordGuestVoiceUsed,
  stashGuestTranscript,
  syncGuestChatsRemaining,
} from "@/lib/guest-store";
import { useTranslation } from "@/lib/i18n";
import {
  consumeMeraVakilAutoSend,
  consumeMeraVakilPrefill,
  consumeMeraVakilVoiceOpen,
  setMeraVakilAutoSend,
  setMeraVakilPrefill,
} from "@/lib/prefill-store";

const SAARTHI = "/mera-vakil";

type Source = "typed" | "chip" | "example";

function lengthBucket(len: number): string {
  if (len < 50) return "short";
  if (len < 200) return "medium";
  if (len < 600) return "long";
  return "very_long";
}

function emptyAssistant(): ChatMessage {
  return {
    id: `a-${crypto.randomUUID()}`,
    role: "assistant",
    content: "",
    createdAt: new Date().toISOString(),
    revealedChars: 0,
  };
}

function SaarthiLandingInner() {
  const searchParams = useSearchParams();
  const { t, lang } = useTranslation();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [wall, setWall] = useState<{ title?: string; subtitle?: string }>({});
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const firstAnswerFiredRef = useRef(false); // fire first_answer_shown once per guest session

  const topic = searchParams.get("topic");
  const topicPrefill = useMemo(() => {
    switch (topic) {
      case "property":
        return t("ask.topicProperty");
      case "family":
        return t("ask.topicFamily");
      case "labour":
        return t("ask.topicLabour");
      default:
        return "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, lang]);

  // Topic prefill follows the language switch — but never overwrites what the user typed.
  const lastPrefillRef = useRef("");
  useEffect(() => {
    if (!topicPrefill) return;
    setQuery((current) => (!current.trim() || current === lastPrefillRef.current ? topicPrefill : current));
    lastPrefillRef.current = topicPrefill;
  }, [topicPrefill]);

  useEffect(() => {
    captureUtmFromSearch(window.location.search);
    track(AnalyticsEvents.ASK_PAGE_VIEWED, { lang });
    setRemaining(guestChatsRemaining());

    // Question carried over from a Saarthi CTA (homepage hero etc.): auto-send it
    // as a guest chat so the visitor gets an answer without a signup wall.
    const carried = consumeMeraVakilPrefill();
    const autoSend = consumeMeraVakilAutoSend();
    const wantVoice = consumeMeraVakilVoiceOpen();
    if (carried) setQuery(carried);
    if (wantVoice && FEATURES.GUEST_VOICE && canGuestVoice()) {
      track(AnalyticsEvents.SAARTHI_VOICE_MODE_ACTIVATED, { guest: true });
      setVoiceOpen(true);
    } else if (carried && autoSend) {
      void submitQuestion(carried, "typed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep an up-to-date copy of the answered exchanges so signing up carries them
  // into the new account's first conversation.
  useEffect(() => {
    stashGuestTranscript(
      messages
        .filter((m) => m.content.trim() && !m.error && m.id !== streamingId)
        .map((m) => ({ role: m.role, content: m.content })),
    );
  }, [messages, streamingId]);

  // Stop an in-flight answer if the visitor leaves the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  const examples =
    topic === "property"
      ? [t("ask.propertyEx1"), t("ask.propertyEx2"), t("ask.propertyEx3")]
      : topic === "family"
        ? [t("ask.familyEx1"), t("ask.familyEx2"), t("ask.familyEx3")]
        : topic === "labour"
          ? [t("ask.labourEx1"), t("ask.labourEx2"), t("ask.labourEx3")]
          : [t("ask.example1"), t("ask.example2"), t("ask.example3"), t("ask.example4")];

  const trust = [
    { icon: Scale, label: t("ask.trust1") },
    { icon: BadgeCheck, label: t("ask.trust2") },
    { icon: Lock, label: t("ask.trust3") },
    { icon: ShieldCheck, label: t("ask.trust4") },
  ];

  function openWall(pendingQuestion: string, reason: "chat" | "voice") {
    if (pendingQuestion.trim()) {
      setMeraVakilPrefill(pendingQuestion.trim());
      setMeraVakilAutoSend();
    }
    track(AnalyticsEvents.GUEST_LIMIT_REACHED, { reason });
    setWall({ title: t("ask.limitTitle"), subtitle: t("ask.limitSubtitle") });
    setAuthOpen(true);
  }

  function openGuestVoice(pendingText: string) {
    // Voice: opt-in (FEATURES.GUEST_VOICE). When unavailable, invite sign-up instead.
    if (FEATURES.GUEST_VOICE && canGuestVoice()) {
      track(AnalyticsEvents.SAARTHI_VOICE_MODE_ACTIVATED, { guest: true });
      setVoiceOpen(true);
    } else {
      openWall(pendingText, "voice");
    }
  }

  async function submitQuestion(
    text: string,
    source: Source,
    opts?: { voice?: boolean; retryOf?: string },
  ) {
    if (opts?.voice) {
      openGuestVoice(text.trim());
      return;
    }

    const trimmed = text.trim();
    if (!trimmed || abortRef.current) return;
    if (!canGuestChat()) {
      openWall(trimmed, "chat");
      return;
    }
    const startedAt = Date.now();

    track(AnalyticsEvents.QUESTION_SUBMITTED, {
      source,
      lang,
      length_bucket: lengthBucket(trimmed.length),
      guest: true,
    });

    // A retry replaces the failed exchange instead of stacking a new one.
    let base = messagesRef.current;
    if (opts?.retryOf) {
      const idx = base.findIndex((m) => m.id === opts.retryOf);
      if (idx > 0) base = base.slice(0, idx - 1);
    }
    const history = toResearchHistory(base.filter((m) => m.content.trim() && !m.error));
    const userMsg = createUserMessage(trimmed);
    const assistant = emptyAssistant();
    const assistantId = assistant.id;
    setMessages([...base, userMsg, assistant]);
    setQuery("");
    setStreamingId(assistantId);
    setStatus(t("chat.preparingAnswer"));

    const controller = new AbortController();
    abortRef.current = controller;
    let serverCounted = false; // the server's count is authoritative when it sends one
    const patch = (fn: (m: ChatMessage) => ChatMessage) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

    try {
      const result = await streamResearchGuest(
        trimmed,
        undefined,
        history,
        {
          onStatus: (_stage, message) => setStatus(message),
          onToken: (tok) => {
            setStatus(undefined);
            patch((m) => ({ ...m, content: m.content + tok, revealedChars: m.content.length + tok.length }));
          },
          onGuestRemaining: (left) => {
            serverCounted = true;
            syncGuestChatsRemaining(left);
            setRemaining(left);
          },
          onCitations: (result) => {
            // Guest activation — the first answer of the session (no question text).
            if (!firstAnswerFiredRef.current) {
              firstAnswerFiredRef.current = true;
              track(AnalyticsEvents.FIRST_ANSWER_SHOWN, {
                guest: true,
                has_citations: Boolean(result.citations?.length || result.web_sources?.length),
                latency_bucket: bucketLatency(Date.now() - startedAt),
              });
            }
          },
        },
        { sessionId: getGuestSessionId(), signal: controller.signal },
      );
      patch((m) => ({ ...m, research: result, content: result.answer, revealedChars: result.answer.length }));
      if (!serverCounted) {
        recordGuestChat();
        setRemaining(guestChatsRemaining());
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Stopped by the visitor: keep whatever arrived, drop an empty shell.
        setMessages((prev) => prev.filter((m) => !(m.id === assistantId && !m.content.trim())));
      } else if (err instanceof GuestLimitError) {
        // Roll back the empty exchange and show the signup wall.
        markGuestChatLimitReached();
        setRemaining(0);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id));
        openWall(trimmed, "chat");
      } else {
        patch((m) => ({ ...m, error: chatErrorCode(err) }));
      }
    } finally {
      abortRef.current = null;
      setStreamingId(null);
      setStatus(undefined);
    }
  }

  const submitRef = useRef(submitQuestion);
  submitRef.current = submitQuestion;

  const handleRetry = useCallback((assistantId: string) => {
    const list = messagesRef.current;
    const idx = list.findIndex((m) => m.id === assistantId);
    const question = idx > 0 ? list[idx - 1] : undefined;
    if (question?.role === "user") void submitRef.current(question.content, "typed", { retryOf: assistantId });
  }, []);

  const handleSuggestion = useCallback((prompt: string) => {
    void submitRef.current(prompt, "chip");
  }, []);

  const chatStarted = messages.length > 0;
  const streaming = streamingId !== null;
  const remainingLabel =
    remaining !== null ? `${remaining} ${t("ask.freeChatsLeft")}` : "";
  const streamingMessage = messages.find((m) => m.id === streamingId);

  return (
    <div
      className={
        chatStarted
          ? "flex h-[100dvh] flex-col overflow-hidden bg-background"
          : "flex min-h-[100dvh] flex-col bg-background"
      }
    >
      <header className="flex shrink-0 items-center justify-between px-4 py-3.5 sm:px-6">
        <Link href="/" aria-label="MeraBakil home">
          <BrandLogo variant="wordmark" size="md" />
        </Link>
        <div className="flex items-center gap-2">
          {chatStarted && remainingLabel ? (
            <span className="hidden rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-muted-foreground dark:bg-white/[0.06] sm:inline">
              {remainingLabel}
            </span>
          ) : null}
          <LanguageSwitcher />
          <Link
            href={`/login?next=${encodeURIComponent(SAARTHI)}`}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            {t("ask.signIn")}
          </Link>
        </div>
      </header>

      {!chatStarted ? (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-24 pt-6 sm:justify-center sm:pb-16 sm:pt-4">
          <h1 className="text-balance text-[1.6rem] font-semibold leading-[1.15] tracking-tight sm:text-[2.1rem]">
            {t("ask.headline")}
          </h1>
          <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
            {t("ask.subline")}
          </p>

          <div className="mt-5">
            <AskComposer
              value={query}
              onChange={setQuery}
              onAsk={(q, opts) => submitQuestion(q, "typed", opts)}
              autoFocus
            />
          </div>

          <div className="mt-3">
            <StarterSuggestions onSelect={(p) => submitQuestion(p, "chip")} hideBooking disabled={streaming} />
          </div>

          <div className="mt-5">
            <p className="mb-2 px-0.5 text-[12px] font-medium text-muted-foreground">
              {t("ask.examplesLabel")}
            </p>
            <div className="flex flex-col gap-2">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => submitQuestion(ex, "example")}
                  className="rounded-xl border border-black/[0.07] bg-black/[0.02] px-3.5 py-2.5 text-left text-[13.5px] text-foreground/90 transition-colors hover:border-black/[0.12] hover:bg-black/[0.04] dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground/80">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                {label}
              </li>
            ))}
          </ul>
        </main>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="mx-auto mt-1 w-full max-w-2xl shrink-0 px-4">
            <span className="block rounded-lg bg-primary/[0.06] px-3 py-2 text-center text-[12px] text-muted-foreground">
              {t("ask.guestNudge")}
            </span>
          </p>
          <MessageList
            messages={messages}
            isPending={streaming && !streamingMessage?.content}
            pendingMessage={status}
            streamingMessageId={streamingMessage?.content ? streamingId : null}
            isGenerating={streaming}
            editingMessageId={null}
            onSuggestionSelect={handleSuggestion}
            onRetry={handleRetry}
          />
          <div className="mv-guest-dock mx-auto w-full max-w-2xl shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
            {streaming && (
              <div className="mb-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-muted dark:border-white/10"
                >
                  <Square className="h-3 w-3 fill-current" aria-hidden />
                  {t("chat.stopGenerating")}
                </button>
              </div>
            )}
            <AskComposer
              value={query}
              onChange={setQuery}
              onAsk={(q, opts) => submitQuestion(q, "typed", opts)}
            />
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground/70 sm:hidden">
              {remainingLabel}
            </p>
          </div>
        </div>
      )}

      <AskAuthSheet
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        title={wall.title}
        subtitle={wall.subtitle}
        source="guest_wall"
      />

      {FEATURES.GUEST_VOICE ? (
        <VoiceModeOverlay
          open={voiceOpen}
          onClose={() => setVoiceOpen(false)}
          speechLocale={lang === "hi" ? "hi-IN" : "en-IN"}
          sessionId={getGuestSessionId()}
          guest
          onGuestLimit={() => {
            setVoiceOpen(false);
            openWall("", "voice");
          }}
          onGuestEnded={() => {
            recordGuestVoiceUsed();
            setVoiceOpen(false);
            openWall("", "voice");
          }}
        />
      ) : null}
    </div>
  );
}

export function SaarthiLanding() {
  return (
    <Suspense fallback={null}>
      <SaarthiLandingInner />
    </Suspense>
  );
}
