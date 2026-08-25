"use client";

import { useCallback, useEffect, useRef } from "react";
import { CalendarPlus, X } from "lucide-react";

import { AppointmentConfirmationCard } from "@/components/mera-vakil/appointment-confirmation-card";
import { useVoiceBot, type VoiceBotState, type VoiceMessage } from "@/hooks/use-voice-bot";
import type { LawyerMatchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VoiceModeOverlayProps {
  open: boolean;
  onClose: () => void;
  speechLocale: string;
  onConversationEnd?: (messages: VoiceMessage[], lawyers: LawyerMatchResult[]) => void;
  onBookLawyer?: (lawyer: LawyerMatchResult) => void;
}

// Blob gradient per state
const BLOB_BG: Record<VoiceBotState, string> = {
  idle: "radial-gradient(circle at 35% 35%, #1e293b, #0f172a, #020617)",
  listening:
    "radial-gradient(circle at 30% 30%, #a5b4fc, #818cf8 25%, #6366f1 50%, #3730a3 75%, #1e1b4b)",
  thinking:
    "radial-gradient(circle at 40% 35%, #c4b5fd, #a78bfa 25%, #7c3aed 55%, #4c1d95 80%, #1e1b4b)",
  speaking:
    "radial-gradient(circle at 30% 25%, #ddd6fe, #a5b4fc 20%, #818cf8 45%, #6366f1 65%, #1e1b4b)",
};

// Outer atmospheric halo gradient per state
const HALO_GRADIENT: Record<VoiceBotState, string> = {
  idle:      "radial-gradient(circle, rgba(30,27,75,0.12) 0%, transparent 65%)",
  listening: "radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 65%)",
  thinking:  "radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 65%)",
  speaking:  "radial-gradient(circle, rgba(129,140,248,0.18) 0%, transparent 65%)",
};

// RGB components for box-shadow glow (combined at render time with dynamic opacity)
const BLOB_GLOW_RGB: Record<VoiceBotState, string> = {
  idle:      "30,27,75",
  listening: "99,102,241",
  thinking:  "124,58,237",
  speaking:  "129,140,248",
};

// Label shown at the bottom
const STATE_LABEL: Record<VoiceBotState, string> = {
  idle: "Connecting…",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Tap orb to interrupt",
};

// Morph speed: slow for idle/listening, faster for speaking
const BLOB_DURATION: Record<VoiceBotState, string> = {
  idle: "7s",
  listening: "4s",
  thinking: "5s",
  speaking: "2s",
};

export function VoiceModeOverlay({ open, onClose, speechLocale, onConversationEnd, onBookLawyer }: VoiceModeOverlayProps) {
  const { botState, transcript, amplitude, permissionDenied, voiceMessages, lawyerResults, lastBooking, interrupt, stop } =
    useVoiceBot({ open, speechLocale });

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
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  // Dynamic scale driven by live audio amplitude (0 when not speaking)
  const blobScale = 1 + amplitude * 0.38;
  // Dynamic glow radius driven by amplitude
  const glowRadius = 70 + amplitude * 110;
  const glowOpacity = (0.4 + amplitude * 0.45).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#050508]"
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
          aria-label="Exit voice mode"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/25 transition-colors hover:bg-white/[0.08] hover:text-white/60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Center — orb */}
      <div className="flex flex-1 items-center justify-center">
        <button
          type="button"
          aria-label={botState === "speaking" ? "Tap to interrupt" : undefined}
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
              className="absolute rounded-full border border-indigo-400/25 voice-blob-breathe"
              style={{ width: "210px", height: "210px" }}
            />
          )}

          {/* Barge-in indicator: small pulsing mic dot shown during speaking */}
          {botState === "speaking" && (
            <span className="absolute bottom-6 right-6 flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/20" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white/40" />
            </span>
          )}
        </button>
      </div>

      {/* Booking confirmation — appears when AI books an appointment */}
      {lastBooking && (
        <div className="shrink-0 px-5 pb-2">
          <p className="mb-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
            Appointment booked
          </p>
          <AppointmentConfirmationCard appointment={lastBooking} variant="voice" />
        </div>
      )}

      {/* Lawyer bubbles — appears when AI surfaces advocates */}
      {lawyerResults.length > 0 && (
        <div className="shrink-0 px-5 pb-2">
          <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
            Recommended advocates
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {lawyerResults.map((lawyer) => (
              <button
                key={lawyer.id}
                type="button"
                onClick={() => onBookLawyer?.(lawyer)}
                className="flex items-center gap-2.5 rounded-full bg-white/[0.08] px-3.5 py-2 ring-1 ring-white/[0.12] transition-all hover:bg-white/[0.15] hover:ring-white/[0.22] active:scale-[0.97]"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white/80">
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
                <CalendarPlus className="ml-0.5 h-3 w-3 text-white/35" />
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
              Microphone access denied. Allow it in browser settings.
            </p>
          ) : transcript && botState === "listening" ? (
            <p className="text-[14px] leading-snug text-white/60">{transcript}</p>
          ) : null}
        </div>

        {/* State label */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/25">
          {permissionDenied ? "Permission denied" : STATE_LABEL[botState]}
        </p>

        {/* Close / end button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="End voice session"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.08] text-white/40 ring-1 ring-white/10 transition-all hover:bg-white/[0.15] hover:text-white/70 hover:ring-white/20 active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
