"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Lock, Scale, ShieldCheck } from "lucide-react";

import { AskAuthSheet } from "@/components/ask/ask-auth-sheet";
import { AskComposer } from "@/components/ask/ask-composer";
import { BrandLogo } from "@/components/brand/brand-logo";
import { MessageBubble } from "@/components/mera-vakil/message-bubble";
import { StarterSuggestions } from "@/components/mera-vakil/starter-suggestions";
import { ThinkingLoader } from "@/components/mera-vakil/thinking-loader";
import { VoiceModeOverlay } from "@/components/mera-vakil/voice-mode-overlay";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { AnalyticsEvents, captureUtmFromSearch, track } from "@/lib/analytics";
import { GuestLimitError, streamResearchGuest } from "@/lib/api";
import { createUserMessage, type ChatMessage } from "@/lib/conversations";
import { FEATURES } from "@/lib/features";
import {
  canGuestChat,
  canGuestVoice,
  getGuestSessionId,
  guestChatsRemaining,
  recordGuestChat,
  recordGuestVoiceUsed,
} from "@/lib/guest-store";
import { useTranslation } from "@/lib/i18n";
import {
  consumeMeraVakilAutoSend,
  consumeMeraVakilPrefill,
  consumeMeraVakilVoiceOpen,
  setMeraVakilAutoSend,
  setMeraVakilPrefill,
} from "@/lib/prefill-store";
import type { ConversationTurn } from "@/lib/types";

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
  const [streaming, setStreaming] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [wall, setWall] = useState<{ title?: string; subtitle?: string }>({});
  const [voiceOpen, setVoiceOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (topicPrefill) setQuery(topicPrefill);
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
      setVoiceOpen(true);
    } else if (carried && autoSend) {
      void submitQuestion(carried, "typed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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

  function openWall(pendingQuestion: string) {
    if (pendingQuestion.trim()) {
      setMeraVakilPrefill(pendingQuestion.trim());
      setMeraVakilAutoSend();
    }
    setWall({ title: t("ask.limitTitle"), subtitle: t("ask.limitSubtitle") });
    setAuthOpen(true);
  }

  async function submitQuestion(text: string, source: Source, opts?: { voice?: boolean }) {
    // Voice: guest voice is opt-in (FEATURES.GUEST_VOICE). When enabled and the
    // daily session is available, open the voice overlay; otherwise nudge signup.
    if (opts?.voice) {
      if (FEATURES.GUEST_VOICE && canGuestVoice()) {
        setVoiceOpen(true);
      } else {
        openWall(text.trim());
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;
    if (streaming) return;
    if (!canGuestChat()) {
      openWall(trimmed);
      return;
    }

    track(AnalyticsEvents.QUESTION_SUBMITTED, {
      source,
      lang,
      length_bucket: lengthBucket(trimmed.length),
      guest: true,
    });

    const history: ConversationTurn[] = messages
      .filter((m) => m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }));

    const userMsg = createUserMessage(trimmed);
    const assistant = emptyAssistant();
    const assistantId = assistant.id;
    setMessages((prev) => [...prev, userMsg, assistant]);
    setQuery("");
    setStreaming(true);

    try {
      await streamResearchGuest(
        trimmed,
        undefined,
        history,
        {
          onToken: (tok) =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + tok, revealedChars: m.content.length + tok.length }
                  : m,
              ),
            ),
          onCitations: (result) =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      research: result,
                      content: result.answer || m.content,
                      revealedChars: (result.answer || m.content).length,
                    }
                  : m,
              ),
            ),
        },
        { sessionId: getGuestSessionId() },
      );
      recordGuestChat();
      setRemaining(guestChatsRemaining());
    } catch (err) {
      if (err instanceof GuestLimitError) {
        // Roll back the empty exchange and show the signup wall.
        setMessages((prev) => prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id));
        openWall(trimmed);
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry — something went wrong. Please try again.", revealedChars: 40 }
              : m,
          ),
        );
      }
    } finally {
      setStreaming(false);
    }
  }

  const chatStarted = messages.length > 0;
  const remainingLabel =
    remaining !== null ? `${remaining} ${t("ask.freeChatsLeft")}` : "";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3.5 sm:px-6">
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
          <div ref={scrollRef} className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <p className="rounded-lg bg-primary/[0.06] px-3 py-2 text-center text-[12px] text-muted-foreground">
              {t("ask.guestNudge")}
            </p>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} isTyping={streaming && !m.content && m.role === "assistant"} />
            ))}
            {streaming && messages[messages.length - 1]?.content === "" ? (
              <ThinkingLoader message="Searching Indian law…" />
            ) : null}
          </div>
          <div className="mx-auto w-full max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
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
      />

      {FEATURES.GUEST_VOICE ? (
        <VoiceModeOverlay
          open={voiceOpen}
          onClose={() => setVoiceOpen(false)}
          speechLocale="en-IN"
          guest
          onGuestLimit={() => {
            setVoiceOpen(false);
            setWall({ title: t("ask.limitTitle"), subtitle: t("ask.limitSubtitle") });
            setAuthOpen(true);
          }}
          onGuestEnded={() => {
            recordGuestVoiceUsed();
            setVoiceOpen(false);
            setWall({ title: t("ask.limitTitle"), subtitle: t("ask.limitSubtitle") });
            setAuthOpen(true);
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
