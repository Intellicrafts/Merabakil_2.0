"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mic, Pause, Play, Square, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";

const MAX_SECONDS = 120;

function pickMime(): { mime: string; ext: string } {
  const candidates = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  for (const item of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(item.mime)) return item;
  }
  return { mime: "", ext: "webm" };
}

function formatClock(total: number): string {
  const seconds = Math.max(0, Math.floor(total));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type Phase = "idle" | "requesting" | "denied" | "recording" | "review";

interface VoiceNoteComposerProps {
  onSend: (file: File, caption: string) => Promise<void>;
  onActiveChange?: (active: boolean) => void;
}

export function VoiceNoteComposer({ onSend, onActiveChange }: VoiceNoteComposerProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const active = phase !== "idle";
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [playing, setPlaying] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<File | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrl = useRef<string | null>(null);
  const tickRef = useRef<number | null>(null);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearPreview() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    fileRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setPlaying(false);
  }

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  function reset() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    chunksRef.current = [];
    stopTracks();
    clearPreview();
    setElapsed(0);
    setError(null);
    setPhase("idle");
  }

  useEffect(() => () => reset(), []);

  async function start() {
    setError(null);
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const picked = pickMime();
      const recorder = picked.mime
        ? new MediaRecorder(stream, { mimeType: picked.mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || picked.mime || "audio/webm" });
        const ext = (blob.type.includes("mp4") && "m4a") || (blob.type.includes("ogg") && "ogg") || "webm";
        const file = new File([blob], `voice-note.${ext}`, { type: blob.type || `audio/${ext}` });
        fileRef.current = file;
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = URL.createObjectURL(file);
        setPhase("review");
      };
      recorderRef.current = recorder;
      recorder.start(200);
      setElapsed(0);
      setPhase("recording");
      const started = Date.now();
      tickRef.current = window.setInterval(() => {
        const next = Math.round((Date.now() - started) / 1000);
        setElapsed(next);
        if (next >= MAX_SECONDS) finish();
      }, 250);
    } catch (err) {
      const name = (err as DOMException).name;
      setError(
        name === "NotAllowedError"
          ? "Microphone permission is blocked. Allow access to send a voice note."
          : "Microphone is not available on this device.",
      );
      setPhase("denied");
    }
  }

  function finish() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  function togglePreview() {
    if (!previewUrl.current) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    audio.src = previewUrl.current;
    void audio.play();
    audio.onended = () => setPlaying(false);
    setPlaying(true);
  }

  async function send() {
    if (!fileRef.current) return;
    setSending(true);
    try {
      await onSend(fileRef.current, "Voice note");
      reset();
    } catch {
      setError("Could not send voice note.");
    } finally {
      setSending(false);
    }
  }

  if (phase === "idle") {
    return (
      <button
        type="button"
        onClick={() => void start()}
        className="mb-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/10"
        aria-label="Record voice note"
      >
        <Mic className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center gap-2 rounded-xl bg-stone-100/90 px-2 py-1.5 dark:bg-white/[0.06]">
        {phase === "recording" && (
          <>
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />
            <span className="flex h-6 items-end gap-0.5" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-0.5 origin-bottom animate-pulse rounded-full bg-slate-700 dark:bg-slate-200"
                  style={{
                    height: `${8 + ((i * 5 + elapsed) % 12)}px`,
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              ))}
            </span>
            <span className="flex-1 text-[12px] font-medium tabular-nums">{formatClock(elapsed)}</span>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">Recording</span>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.05]"
              aria-label="Cancel recording"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={finish}
              className="mp-btn-accent inline-flex h-8 items-center rounded-lg px-2.5 text-[11px] font-semibold"
            >
              <Square className="mr-1 h-3 w-3" />
              Stop
            </button>
          </>
        )}
        {phase === "review" && (
          <>
            <button
              type="button"
              onClick={togglePreview}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
              aria-label={playing ? "Pause preview" : "Play preview"}
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <span className="flex-1 text-[12px] font-medium tabular-nums">{formatClock(elapsed)}</span>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.05]"
              aria-label="Discard voice note"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending}
              className={cn("mp-btn-accent inline-flex h-8 items-center rounded-lg px-2.5 text-[11px] font-semibold", sending && "opacity-60")}
            >
              <Check className="mr-1 h-3 w-3" />
              {sending ? "Sending…" : "Send"}
            </button>
          </>
        )}
        {(phase === "requesting" || phase === "denied") && (
          <>
            <Mic className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 text-[12px] text-muted-foreground">
              {phase === "requesting" ? "Allow microphone access…" : error}
            </span>
            <button type="button" onClick={reset} className="text-[11px] font-semibold">
              Close
            </button>
            {phase === "denied" && (
              <button type="button" onClick={() => void start()} className="mp-btn-primary h-8 rounded-lg px-2 text-[11px] font-semibold">
                Try again
              </button>
            )}
          </>
        )}
      </div>
      {error && phase === "recording" ? <p className="px-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
