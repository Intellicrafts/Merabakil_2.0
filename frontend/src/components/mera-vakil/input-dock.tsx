"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, FileUp, Loader2, Mic, Send, X } from "lucide-react";

import { collectSpeechTranscript, waitForSpeechEnd } from "@/lib/speech-transcript";
import { cn } from "@/lib/utils";

interface InputDockProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string, files: File[]) => Promise<void> | void;
  disabled?: boolean;
  isPending?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
  isUploading?: boolean;
  uploadingFileName?: string | null;
  onVoiceModeOpen?: () => void;
  onVoiceNoteSend?: (transcript: string) => void;
  onVoiceNoteError?: (message: string) => void;
  speechLocale?: string;
}

const MIN_ROWS = 1;
const MAX_ROWS = 6;
const LINE_HEIGHT = 24;
const ACCEPTED_TYPES = ".pdf,.doc,.docx,.txt,.csv,.md";
const MAX_FILES = 5;
const MAX_NOTE_SECONDS = 60;
const WAVE_BARS = 14;

type SpeechRecInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string }; isFinal?: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecCtor = new () => SpeechRecInstance;

function getSpeechRecognition(): SpeechRecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { SpeechRecognition?: SpeechRecCtor; webkitSpeechRecognition?: SpeechRecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatClock(total: number): string {
  const seconds = Math.max(0, Math.floor(total));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function StopButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-black/[0.08] transition-all hover:bg-slate-50 active:scale-95 md:h-10 md:w-10 dark:bg-slate-100 dark:text-slate-900"
      aria-label="Stop generating"
    >
      <span className="block h-3 w-3 rounded-[2px] bg-slate-900" />
    </button>
  );
}

function DockIconButton({
  onClick,
  label,
  disabled,
  active,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors",
        "hover:bg-black/[0.04] hover:text-foreground active:scale-95 disabled:opacity-45",
        "md:h-10 md:w-10 md:rounded-full dark:hover:bg-white/10",
        active && "bg-amber-800/10 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
      )}
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function PrimaryDisc({
  onClick,
  disabled,
  label,
  children,
  muted,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
        "bg-gradient-to-b from-amber-800 to-amber-900 text-white",
        "shadow-[0_4px_14px_rgba(120,53,15,0.35)] transition-all",
        "hover:from-amber-900 hover:to-amber-950 active:scale-95",
        "md:h-10 md:w-10 dark:from-amber-600 dark:to-amber-700 dark:hover:from-amber-500 dark:hover:to-amber-600",
        muted && "cursor-not-allowed opacity-45 shadow-none",
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function InputDock({
  value,
  onChange,
  onSend,
  disabled,
  isPending,
  isGenerating,
  onStop,
  isUploading,
  uploadingFileName,
  onVoiceModeOpen,
  onVoiceNoteSend,
  onVoiceNoteError,
  speechLocale = "en-IN",
}: InputDockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [fileHint, setFileHint] = useState<string | null>(null);

  const tickRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecInstance | null>(null);
  const transcriptRef = useRef("");
  const liveTranscriptRef = useRef("");
  const recordingRef = useRef(false);
  const finishingRef = useRef(false);
  const cancelledRef = useRef(false);
  const finishNoteRef = useRef<() => void>(() => undefined);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = LINE_HEIGHT * MAX_ROWS + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const clearTimers = useCallback(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setElapsed(0);
  }, []);

  const detachRecognition = useCallback((abort: boolean) => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    if (!abort) return;
    try {
      rec.abort();
    } catch {
      /* ignore */
    }
  }, []);

  const resetTranscript = useCallback(() => {
    transcriptRef.current = "";
    liveTranscriptRef.current = "";
    setLiveTranscript("");
  }, []);

  const stopRecording = useCallback(() => {
    recordingRef.current = false;
    finishingRef.current = false;
    cancelledRef.current = true;
    setRecording(false);
    clearTimers();
    detachRecognition(true);
    resetTranscript();
  }, [clearTimers, detachRecognition, resetTranscript]);

  useEffect(() => () => stopRecording(), [stopRecording]);

  function startVoiceNote() {
    if (recording || disabled || isPending || isUploading || isGenerating) return;
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      onVoiceNoteError?.("Voice notes need speech recognition. Try Chrome or Edge, or type your question.");
      return;
    }

    const rec = new Ctor();
    rec.lang = speechLocale;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      const { finalText, liveText } = collectSpeechTranscript(event.results);
      transcriptRef.current = finalText;
      liveTranscriptRef.current = liveText;
      setLiveTranscript(liveText);
    };
    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (finishingRef.current || cancelledRef.current) return;
      if (event.error === "not-allowed" || event.error === "audio-capture") {
        onVoiceNoteError?.("Microphone access is needed for a voice note.");
      } else {
        onVoiceNoteError?.("Could not hear that clearly. Please try again.");
      }
      stopRecording();
    };
    rec.onend = () => {
      if (!recordingRef.current || finishingRef.current || cancelledRef.current) return;
      try {
        rec.start();
      } catch {
        /* already running */
      }
    };

    finishingRef.current = false;
    cancelledRef.current = false;
    resetTranscript();

    try {
      rec.start();
    } catch {
      onVoiceNoteError?.("Microphone access is needed for a voice note.");
      return;
    }

    recognitionRef.current = rec;
    recordingRef.current = true;
    setRecording(true);
    setElapsed(0);
    const started = Date.now();
    tickRef.current = window.setInterval(() => {
      const next = Math.round((Date.now() - started) / 1000);
      setElapsed(next);
      if (next >= MAX_NOTE_SECONDS) finishNoteRef.current();
    }, 250);
  }

  async function finishVoiceNote() {
    if (!recordingRef.current && !recognitionRef.current) return;
    if (finishingRef.current) return;
    finishingRef.current = true;
    recordingRef.current = false;

    const rec = recognitionRef.current;
    if (rec) rec.onend = null;
    await waitForSpeechEnd(rec);

    const text = (liveTranscriptRef.current || transcriptRef.current).trim();
    setRecording(false);
    clearTimers();
    detachRecognition(false);
    finishingRef.current = false;
    resetTranscript();

    if (text.length < 3) {
      onVoiceNoteError?.("Nothing was captured. Please try again or type your question.");
      return;
    }
    onVoiceNoteSend?.(text);
  }

  finishNoteRef.current = () => {
    void finishVoiceNote();
  };

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    setPendingFiles((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.length >= MAX_FILES) {
          setFileHint(`You can attach up to ${MAX_FILES} files.`);
          break;
        }
        if (next.some((item) => fileKey(item) === fileKey(file))) continue;
        next.push(file);
      }
      return next;
    });
    window.setTimeout(() => setFileHint(null), 2800);
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    if (disabled || isPending || isUploading || isGenerating) return;
    const text = value.trim();
    if (text.length < 3 && pendingFiles.length === 0) return;
    const files = pendingFiles;
    try {
      await onSend(text, files);
      setPendingFiles([]);
    } catch {
      /* keep staged files so the user can retry */
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const busy = disabled || isUploading;
  const hasText = value.trim().length >= 3;
  const canSend = !busy && !isPending && !recording && (hasText || pendingFiles.length > 0);
  const showVoiceMode = Boolean(onVoiceModeOpen) && !hasText && pendingFiles.length === 0 && !recording;

  return (
    <div
      className={cn(
        "mv-input-dock shrink-0",
        "px-3 pt-1.5",
        "pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]",
        "md:px-6 md:pb-6 md:pt-2",
        "will-change-[transform]",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-3xl flex-col gap-2",
          "rounded-[1.35rem] border px-2 py-2 md:rounded-2xl md:px-2.5",
          "border-black/[0.07] bg-white",
          "shadow-[0_6px_28px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.65)_inset]",
          "transition-[border-color,box-shadow] duration-200",
          "dark:border-white/[0.12] dark:bg-zinc-900",
          "dark:shadow-[0_10px_36px_rgba(0,0,0,0.42),0_1px_0_rgba(255,255,255,0.04)_inset]",
          (focused || recording) &&
            "border-amber-800/30 shadow-[0_8px_32px_rgba(120,53,15,0.12),0_0_0_3px_rgba(120,53,15,0.08)] dark:border-amber-500/35 dark:shadow-[0_10px_36px_rgba(0,0,0,0.45),0_0_0_3px_rgba(217,119,6,0.12)]",
        )}
      >
        {pendingFiles.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 px-1 pt-0.5" aria-label="Attached files">
            {pendingFiles.map((file, index) => {
              const uploading = uploadingFileName === file.name;
              return (
                <li
                  key={fileKey(file)}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-black/[0.07] bg-black/[0.03] py-1 pl-2.5 pr-1 text-[12px] dark:border-white/[0.10] dark:bg-white/[0.05]"
                >
                  {uploading ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <FileUp className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="max-w-[9.5rem] truncate font-medium">{file.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={busy || isGenerating || recording}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-black/[0.06] hover:text-foreground disabled:opacity-40 dark:hover:bg-white/10"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="flex items-end gap-1.5 md:gap-2">
          <DockIconButton
            onClick={() => fileInputRef.current?.click()}
            label="Attach documents"
            disabled={busy || isGenerating || recording}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          </DockIconButton>

          <DockIconButton
            onClick={() => (recording ? stopRecording() : startVoiceNote())}
            label={recording ? "Recording voice note" : "Record a voice note"}
            disabled={busy || isGenerating}
            active={recording}
          >
            <Mic className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </DockIconButton>

          {recording ? (
            <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 py-1" role="status" aria-live="polite">
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 mv-voice-note-dot" />
              <span className="flex h-7 items-end gap-[3px]" aria-hidden>
                {Array.from({ length: WAVE_BARS }, (_, i) => (
                  <span
                    key={i}
                    className="mv-voice-note-bar w-[2.5px] rounded-full bg-amber-800/80 dark:bg-amber-400/80"
                    style={{ animationDelay: `${i * 0.07}s` }}
                  />
                ))}
              </span>
              <span className="shrink-0 text-[12px] font-medium tabular-nums">{formatClock(elapsed)}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                {liveTranscript || "Listening…"}
              </span>
              <button
                type="button"
                onClick={stopRecording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
                aria-label="Cancel voice note"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void finishVoiceNote()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-800 to-amber-900 text-white shadow-sm transition-transform active:scale-95 dark:from-amber-600 dark:to-amber-700"
                aria-label="Send voice note"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              rows={MIN_ROWS}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Describe your matter…"
              disabled={disabled || isUploading}
              className={cn(
                "max-h-[150px] min-h-[44px] flex-1 resize-none bg-transparent py-2 leading-6 placeholder:text-muted-foreground/80 focus:outline-none",
                "text-base md:min-h-[40px] md:py-1.5 md:text-[13.5px]",
              )}
              aria-label="Chat message input"
            />
          )}

          {!recording &&
            (isGenerating && onStop ? (
              <StopButton onClick={onStop} />
            ) : showVoiceMode ? (
              <PrimaryDisc onClick={onVoiceModeOpen!} label="Start voice mode">
                <AudioLines className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </PrimaryDisc>
            ) : (
              <PrimaryDisc
                onClick={() => void handleSend()}
                disabled={!canSend}
                muted={!canSend}
                label="Send message"
              >
                <Send className="h-4 w-4" />
              </PrimaryDisc>
            ))}
        </div>
      </div>

      {fileHint ? (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{fileHint}</p>
      ) : (
        <p className="mt-2 hidden text-center text-xs text-muted-foreground md:block">
          Enter to send · Mic for a voice note
          {onVoiceModeOpen ? " · Wave icon for live voice" : ""}
        </p>
      )}
    </div>
  );
}
