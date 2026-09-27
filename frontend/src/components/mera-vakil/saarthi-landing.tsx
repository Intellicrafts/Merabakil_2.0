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
import {
  blockReasonFor,
  trackQuestionBlocked,
  trackQuestionSent,
  type QuestionSource,
} from "@/lib/analytics/question-funnel";
import type { SignupTrigger } from "@/lib/analytics/signup-source";
import { TurnstileChallenge, TURNSTILE_SITE_KEY } from "@/components/security/turnstile-challenge";
import { GuestChallengeError, GuestLimitError, streamResearchGuest } from "@/lib/api";
import { chatErrorCode } from "@/lib/chat-errors";
import { INITIAL_STATUS_KEY, statusLabel } from "@/lib/chat-status";
import { createUserMessage, toResearchHistory, type ChatMessage } from "@/lib/conversations";
import { FEATURES } from "@/lib/features";
import {
  canGuestChat,
  canGuestVoice,
  getGuestDeviceId,
  getGuestSessionId,
  GUEST_DAILY_CHAT_LIMIT,
  guestChatsRemaining,
  guestChatsUsedToday,
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
  const [wall, setWall] = useState<{ title?: string; subtitle?: string; trigger?: SignupTrigger }>({});
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | undefined>();
  // Busy network: the server asked for a bot check before this question goes through.
  const [challenge, setChallenge] = useState<{ question: string; source: QuestionSource } | null>(null);
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
      track(AnalyticsEvents.SAARTHI_VOICE_MODE_ACTIVATED, { is_guest: true });
      setVoiceOpen(true);
    } else if (carried && autoSend) {
      void submitQuestion(carried, "autosend");
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

  type LimitHit =
    | { reason: "text"; limitType: "daily_messages" }
    | { reason: "voice"; limitType: "daily_voice_session" | "voice_time_cap"; voiceSeconds?: number };

  /** Show the sign-up sheet for a guest prompt. Limit hits also emit guest_limit_reached. */
  function openSignupPrompt(trigger: SignupTrigger, pendingQuestion = "", limit?: LimitHit) {
    if (pendingQuestion.trim()) {
      setMeraVakilPrefill(pendingQuestion.trim());
      setMeraVakilAutoSend();
    }
    if (limit?.reason === "text") {
      track(AnalyticsEvents.GUEST_LIMIT_REACHED, {
        reason: "text",
        limit_type: limit.limitType,
        chats_used: Math.max(guestChatsUsedToday(), GUEST_DAILY_CHAT_LIMIT),
      });
    } else if (limit?.reason === "voice") {
      track(AnalyticsEvents.GUEST_LIMIT_REACHED, {
        reason: "voice",
        limit_type: limit.limitType,
        ...(limit.voiceSeconds !== undefined ? { voice_seconds_used: limit.voiceSeconds } : {}),
      });
    }
    // Every time the sign-up sheet is shown — limits and the nudge alike.
    track(AnalyticsEvents.GUEST_SIGNUP_PROMPT_SHOWN, { trigger, is_guest: true });
    setWall(
      trigger === "nudge"
        ? { trigger }
        : { title: t("ask.limitTitle"), subtitle: t("ask.limitSubtitle"), trigger },
    );
    setAuthOpen(true);
  }

  function openGuestVoice(pendingText: string) {
    // Voice: opt-in (FEATURES.GUEST_VOICE). When unavailable, invite sign-up instead.
    if (FEATURES.GUEST_VOICE && canGuestVoice()) {
      track(AnalyticsEvents.SAARTHI_VOICE_MODE_ACTIVATED, { is_guest: true });
      setVoiceOpen(true);
    } else if (FEATURES.GUEST_VOICE) {
      openSignupPrompt("voice_limit", pendingText, { reason: "voice", limitType: "daily_voice_session" });
    } else {
      openSignupPrompt("voice_limit", pendingText); // guest voice switched off — not a limit
    }
  }

  async function submitQuestion(
    text: string,
    requestedSource: QuestionSource,
    opts?: { voice?: boolean; retryOf?: string; turnstileToken?: string },
  ) {
    if (opts?.voice) {
      openGuestVoice(text.trim());
      return;
    }

    const trimmed = text.trim();
    if (!trimmed || abortRef.current) return;
    const source: QuestionSource = opts?.retryOf ? "retry" : requestedSource;
    if (!canGuestChat()) {
      trackQuestionBlocked({ isGuest: true, reason: "guest_limit", source });
      openSignupPrompt("text_limit", trimmed, { reason: "text", limitType: "daily_messages" });
      return;
    }
    const startedAt = Date.now();
    let firstTokenAt: number | null = null;
    setChallenge(null);

    // A retry replaces the failed exchange instead of stacking a new one.
    let base = messagesRef.current;
    if (opts?.retryOf) {
      const idx = base.findIndex((m) => m.id === opts.retryOf);
      if (idx > 0) base = base.slice(0, idx - 1);
    }
    const messageNumber = base.filter((m) => m.role === "user").length + 1;
    let accepted = false;
    const history = toResearchHistory(base.filter((m) => m.content.trim() && !m.error));
    const userMsg = createUserMessage(trimmed);
    const assistant = emptyAssistant();
    const assistantId = assistant.id;
    setMessages([...base, userMsg, assistant]);
    setQuery("");
    setStreamingId(assistantId);
    setStatus(t(INITIAL_STATUS_KEY));

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
          onAccepted: () => {
            accepted = true;
            trackQuestionSent({
              isGuest: true,
              source,
              lang,
              questionLength: trimmed.length,
              messageNumber,
              entryPoint: "guest",
            });
          },
          onStatus: (stage, message) => setStatus(statusLabel(stage, message, t)),
          onToken: (tok) => {
            firstTokenAt ??= Date.now();
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
                is_guest: true,
                has_citations: Boolean(result.citations?.length || result.web_sources?.length),
                latency_bucket: bucketLatency(Date.now() - startedAt),
                ttft_bucket: bucketLatency((firstTokenAt ?? Date.now()) - startedAt),
              });
            }
          },
          onSuggestions: (suggestions) =>
            patch((m) => (m.research ? { ...m, research: { ...m.research, suggestions } } : m)),
        },
        {
          sessionId: getGuestSessionId(),
          signal: controller.signal,
          deviceId: getGuestDeviceId(),
          turnstileToken: opts?.turnstileToken,
        },
      );
      patch((m) => ({ ...m, research: result, content: result.answer, revealedChars: result.answer.length }));
      track(AnalyticsEvents.AI_RESPONSE_RECEIVED, {
        latency_bucket: bucketLatency(Date.now() - startedAt),
        has_citations: Boolean(result.citations?.length || result.web_sources?.length),
        response_status: "success",
        is_guest: true,
      });
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
        trackQuestionBlocked({ isGuest: true, reason: "guest_limit", source });
        markGuestChatLimitReached();
        setRemaining(0);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id));
        openSignupPrompt("text_limit", trimmed, { reason: "text", limitType: "daily_messages" });
      } else if (err instanceof GuestChallengeError) {
        // Not a chat yet: take the exchange back and ask for the bot check.
        trackQuestionBlocked({ isGuest: true, reason: "bot_check", source });
        setMessages((prev) => prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id));
        if (TURNSTILE_SITE_KEY) setChallenge({ question: trimmed, source });
        else openSignupPrompt("text_limit", trimmed, { reason: "text", limitType: "daily_messages" });
      } else {
        patch((m) => ({ ...m, error: chatErrorCode(err) }));
        if (accepted) {
          track(AnalyticsEvents.AI_RESPONSE_RECEIVED, {
            latency_bucket: bucketLatency(Date.now() - startedAt),
            has_citations: false,
            response_status: "error",
            error_code: chatErrorCode(err),
            is_guest: true,
          });
        } else {
          trackQuestionBlocked({ isGuest: true, source, ...blockReasonFor(err, true) });
        }
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
    void submitRef.current(prompt, "suggestion");
  }, []);

  const chatStarted = messages.length > 0;
  const streaming = streamingId !== null;
  const remainingLabel =
    remaining !== null
      ? `${remaining} ${t(remaining === 1 ? "ask.freeChatLeft" : "ask.freeChatsLeft")} · ${t("ask.resetsMidnightIst")}`
      : "";
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
            <button
              type="button"
              onClick={() => openSignupPrompt("nudge")}
              className="block w-full rounded-lg bg-primary/[0.06] px-3 py-2 text-center text-[12px] text-muted-foreground transition-colors hover:bg-primary/[0.1] hover:text-foreground"
            >
              {t("ask.guestNudge")}
            </button>
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
          {challenge && (
            <div
              role="dialog"
              aria-labelledby="guest-bot-check-title"
              className="mx-auto mb-2 w-full max-w-2xl shrink-0 px-4"
            >
              <div className="rounded-xl border border-black/[0.08] bg-background p-4 text-center shadow-sm dark:border-white/10">
                <p id="guest-bot-check-title" className="text-sm font-medium text-foreground">
                  {t("ask.botCheckTitle")}
                </p>
                <p className="mb-3 mt-1 text-[12px] text-muted-foreground">{t("ask.botCheckBody")}</p>
                <TurnstileChallenge
                  lang={lang}
                  onToken={(token) => void submitRef.current(challenge.question, challenge.source, { turnstileToken: token })}
                  onError={() => {
                    const pending = challenge.question;
                    setChallenge(null);
                    openSignupPrompt("text_limit", pending);
                  }}
                />
              </div>
            </div>
          )}
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
        source={wall.trigger}
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
            openSignupPrompt("voice_limit", "", { reason: "voice", limitType: "daily_voice_session" });
          }}
          onGuestEnded={() => {
            recordGuestVoiceUsed();
            setVoiceOpen(false);
            openSignupPrompt("voice_limit", "", { reason: "voice", limitType: "voice_time_cap", voiceSeconds: 90 });
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
