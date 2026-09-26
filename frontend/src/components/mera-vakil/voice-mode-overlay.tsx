"use client";

import { useCallback, useEffect, useRef } from "react";
import { CalendarPlus, X } from "lucide-react";

import { VoiceBookingConfirmationModal } from "@/components/mera-vakil/voice-booking-confirmation-modal";
import { useVoiceBot, type VoiceBotState, type VoiceMessage } from "@/hooks/use-voice-bot";
import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";
import { useTranslation } from "@/lib/i18n";
import type { LawyerMatchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VoiceModeOverlayProps {
  open: boolean;
  onClose: () => void;
  speechLocale: string;
  conversationMessages?: Array<{ role: string; content: string }>;
  onConversationEnd?: (messages: VoiceMessage[], lawyers: LawyerMatchResult[]) => void;
  onBookLawyer?: (lawyer: LawyerMatchResult) => void;
  /** Guest (logged-out) one-shot session: ~90s cap, no reconnect. */
  guest?: boolean;
  onGuestLimit?: () => void;
  onGuestEnded?: () => void;
  /** Conversation / guest session id, so voice turns share the chat's memory. */
  sessionId?: string | null;
}

// Blob gradient per state — Saarthi amber brand palette
const BLOB_BG: Record<VoiceBotState, string> = {
  idle: "radial-gradient(circle at 35% 35%, #292524, #1c1410, #0c0a09)",
  listening:
    "radial-gradient(circle at 30% 30%, #fef3c7, #fcd34d 25%, #f59e0b 50%, #b45309 75%, #451a03)",
  thinking:
    "radial-gradient(circle at 40% 35%, #fde68a, #fbbf24 25%, #d97706 55%, #92400e 80%, #292524)",
  speaking:
    "radial-gradient(circle at 30% 25%, #fffbeb, #fde68a 20%, #f59e0b 45%, #92400e 65%, #1c1410)",
};

// Outer atmospheric halo gradient per state
const HALO_GRADIENT: Record<VoiceBotState, string> = {
  idle:      "radial-gradient(circle, rgba(120,53,15,0.12) 0%, transparent 65%)",
  listening: "radial-gradient(circle, rgba(217,119,6,0.14) 0%, transparent 65%)",
  thinking:  "radial-gradient(circle, rgba(180,83,9,0.14) 0%, transparent 65%)",
  speaking:  "radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 65%)",
};

// RGB components for box-shadow glow (combined at render time with dynamic opacity)
const BLOB_GLOW_RGB: Record<VoiceBotState, string> = {
  idle:      "120,53,15",
  listening: "217,119,6",
  thinking:  "180,83,9",
  speaking:  "245,158,11",
};

// Translation key for each voice state label
const STATE_LABEL_KEY: Record<VoiceBotState, string> = {
  idle: "chat.connecting",
  listening: "chat.listening",
  thinking: "chat.thinking",
  speaking: "chat.tapToInterrupt",
};

// Morph speed: slow for idle/listening, faster for speaking
const BLOB_DURATION: Record<VoiceBotState, string> = {
  idle: "7s",
  listening: "4s",
  thinking: "5s",
  speaking: "2s",
};

export function VoiceModeOverlay({ open, onClose, speechLocale, conversationMessages, onConversationEnd, onBookLawyer, guest, onGuestLimit, onGuestEnded, sessionId }: VoiceModeOverlayProps) {
  const { t } = useTranslation();
  const {
    botState,
    transcript,
    amplitude,
    permissionDenied,
    voiceMessages,
    lawyerResults,
    lastBooking,
    dismissLastBooking,
    interrupt,
    stop,
    errorKind,
    needsGesture,
    secondsLeft,
    retry,
  } = useVoiceBot({ open, speechLocale, priorMessages: conversationMessages, guest, onGuestLimit, onGuestEnded, sessionId });

  const statusText = permissionDenied
    ? t("chat.permissionDenied")
    : errorKind === "reconnect_failed"
      ? t("chat.voiceReconnectFailed")
      : errorKind === "unavailable"
        ? t("chat.voiceUnavailable")
        : needsGesture
          ? t("chat.voiceTapToStart")
          : t(STATE_LABEL_KEY[botState]);

  const voiceMessagesRef = useRef(voiceMessages);
  const lawyerResultsRef = useRef(lawyerResults);
  useEffect(() => { voiceMessagesRef.current = voiceMessages; }, [voiceMessages]);
  useEffect(() => { lawyerResultsRef.current = lawyerResults; }, [lawyerResults]);

  const handleClose = useCallback(() => {
    stop();
    if (voiceMessagesRef.current.length > 0) {
      onConversationEnd?.(voiceMessagesRef.current, lawyerResultsRef.current);
    }
    onClose();
  }, [stop, onClose, onConversationEnd]);

  const handleOrbClick = useCallback(() => {
    if (botState === "speaking") interrupt();
  }, [botState, interrupt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lastBooking) {
        dismissLastBooking();
        return;
      }
      handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose, lastBooking, dismissLastBooking]);

  if (!open) return null;

  // Dynamic scale driven by live audio amplitude (0 when not speaking)
  const blobScale = 1 + amplitude * 0.38;
  // Dynamic glow radius driven by amplitude
  const glowRadius = 70 + amplitude * 110;
  const glowOpacity = (0.4 + amplitude * 0.45).toFixed(2);

  return (
    <div
      {...CLARITY_MASK}
      className="mv-voice-overlay fixed inset-0 z-[100] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Voice mode"
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-5 py-4">
        <span className="select-none text-[10px] font-semibold uppercase tracking-[0.22em] text-white/20">
          Saarthi · Voice
        </span>
        <button
          type="button"
          onClick={handleClose}
          aria-label={t("chat.exitVoiceMode")}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/25 transition-colors hover:bg-amber-500/10 hover:text-amber-200/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Center — orb */}
      <div className="flex flex-1 items-center justify-center">
        <button
          type="button"
          aria-label={botState === "speaking" ? t("chat.tapToInterrupt") : undefined}
          onClick={handleOrbClick}
          className={cn(
            "group relative flex items-center justify-center focus:outline-none",
            botState === "speaking" ? "cursor-pointer" : "cursor-default",
          )}
          style={{ width: "320px", height: "320px" }}
        >
          {/* Outer atmospheric halo */}
          <div
            className="absolute rounded-full"
            style={{
              inset: 0,
              background: HALO_GRADIENT[botState],
              filter: "blur(50px)",
              transform: `scale(${1 + amplitude * 0.5})`,
              transition: "transform 80ms ease-out",
            }}
          />

          {/* Inner glow ring */}
          <div
            className="absolute rounded-full"
            style={{
              width: "220px",
              height: "220px",
              background: `radial-gradient(circle, rgba(${BLOB_GLOW_RGB[botState]},0.5) 0%, transparent 70%)`,
              filter: "blur(28px)",
              transform: `scale(${1 + amplitude * 0.35})`,
              opacity: botState === "idle" ? 0.3 : 0.65,
              transition: "transform 80ms ease-out, opacity 600ms ease",
            }}
          />

          {/* Main blob */}
          <div
            className={cn(
              "voice-blob",
              botState === "listening" && "voice-blob-listen",
              botState === "speaking" && "voice-blob-speak",
              botState === "thinking" && "voice-blob-think",
            )}
            style={{
              background: BLOB_BG[botState],
              animationDuration: BLOB_DURATION[botState],
              transform: `scale(${blobScale})`,
              boxShadow: `0 0 ${glowRadius}px rgba(${BLOB_GLOW_RGB[botState]},${glowOpacity})`,
              transition: "transform 80ms ease-out, box-shadow 80ms ease-out, background 600ms ease",
            }}
          />

          {/* Listening breathing ring */}
          {botState === "listening" && (
            <span
              className="absolute rounded-full border border-amber-400/30 voice-blob-breathe"
              style={{ width: "210px", height: "210px" }}
            />
          )}

          {/* Barge-in indicator: small pulsing mic dot shown during speaking */}
          {botState === "speaking" && (
            <span className="absolute bottom-6 right-6 flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/25" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-300/50" />
            </span>
          )}
        </button>
      </div>

      {lastBooking ? (
        <VoiceBookingConfirmationModal appointment={lastBooking} onDismiss={dismissLastBooking} />
      ) : null}

      {/* Lawyer bubbles — appears when AI surfaces advocates */}
      {lawyerResults.length > 0 && (
        <div className="shrink-0 px-5 pb-2">
          <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
            {t("chat.recommendedAdvocates")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {lawyerResults.map((lawyer) => (
              <button
                key={lawyer.id}
                type="button"
                onClick={() => onBookLawyer?.(lawyer)}
                className="flex items-center gap-2.5 rounded-full bg-amber-950/30 px-3.5 py-2 ring-1 ring-amber-500/20 transition-all hover:bg-amber-900/35 hover:ring-amber-400/35 active:scale-[0.97]"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-800/40 text-[11px] font-semibold text-amber-100/90">
                  {lawyer.full_name.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-semibold leading-tight text-white/90">
                    {lawyer.full_name.split(" ")[0]}
                  </p>
                  <p className="text-[10px] leading-tight text-white/40">
                    {lawyer.practice_areas[0] ?? "Advocate"}
                  </p>
                </div>
                <CalendarPlus className="ml-0.5 h-3 w-3 text-amber-300/50" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom — label + transcript + close */}
      <div className="flex shrink-0 flex-col items-center gap-5 pb-12 pt-2">
        {/* Live transcript (listening only) */}
        <div className="min-h-[1.6rem] max-w-[340px] px-4 text-center">
          {permissionDenied ? (
            <p className="text-[12px] leading-snug text-white/35">
              {t("chat.microphoneDenied")}
            </p>
          ) : transcript && botState === "listening" ? (
            <p className="text-[14px] leading-snug text-white/60">{transcript}</p>
          ) : null}
        </div>

        {(needsGesture || errorKind) && !permissionDenied && (
          <button
            type="button"
            onClick={retry}
            className="rounded-full bg-white/10 px-4 py-2 text-[13px] font-medium text-white/85 transition-colors hover:bg-white/15"
          >
            {needsGesture ? t("chat.voiceTapToStart") : t("chat.retry")}
          </button>
        )}

        {/* State label (announced to screen readers) */}
        <p
          aria-live="polite"
          className="max-w-[320px] text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white/25"
        >
          {statusText}
        </p>
        {secondsLeft !== null && (
          <p className="-mt-3 text-[11px] tabular-nums text-white/40">
            {t("chat.voiceSecondsLeft").replace("{{count}}", String(secondsLeft))}
          </p>
        )}

        {/* Close / end button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label={t("chat.endVoiceSession")}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full text-white",
            "bg-gradient-to-b from-amber-800 to-amber-900",
            "shadow-[0_4px_14px_rgba(120,53,15,0.35)] transition-all",
            "hover:from-amber-900 hover:to-amber-950 active:scale-95",
          )}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
