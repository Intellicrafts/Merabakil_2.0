"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, FileUp, Loader2, Mic, Send, X } from "lucide-react";

import { ChatFileCard } from "@/components/mera-vakil/chat-file-card";
import { transcribeAudio } from "@/lib/api";
import type { AttachedDocument } from "@/lib/conversations";
import { cn } from "@/lib/utils";

export type UploadStage = "uploading" | "reading" | "ready" | "failed";

export interface UploadProgress {
  fileName: string;
  percent: number;
  stage: UploadStage;
  startedAt?: number;
}

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
  uploadProgress?: UploadProgress | null;
  attachedDocuments?: AttachedDocument[];
  onDetachDocument?: (id: string) => void;
  onVoiceModeOpen?: () => void;
  onVoiceNoteError?: (message: string) => void;
  speechLocale?: string;
}

const MIN_ROWS = 1;
const MAX_ROWS = 6;
const LINE_HEIGHT = 24;
const ACCEPTED_TYPES = ".pdf,.doc,.docx,.txt,.csv,.md";
const ACCEPTED_EXT = [".pdf", ".doc", ".docx", ".txt", ".csv", ".md"];
const MAX_FILES = 5;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_RECORD_SECONDS = 120;
const WAVE_BARS = 14;

type RecordState = "idle" | "recording" | "transcribing";

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
  uploadProgress,
  attachedDocuments = [],
  onDetachDocument,
  onVoiceModeOpen,
  onVoiceNoteError,
}: InputDockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [recState, setRecState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [fileHint, setFileHint] = useState<string | null>(null);
  const [uploadElapsed, setUploadElapsed] = useState(0);

  const tickRef = useRef<number | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    if (!uploadProgress || uploadProgress.stage === "ready" || uploadProgress.stage === "failed") {
      return;
    }
    const started = uploadProgress.startedAt ?? Date.now();
    const tick = () => setUploadElapsed(Math.max(0, Math.round((Date.now() - started) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [uploadProgress]);

  const clearTimers = useCallback(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setElapsed(0);
  }, []);

  const stopMediaRecorder = useCallback(() => {
    const rec = mediaRecRef.current;
    if (!rec) return;
    try { rec.stop(); } catch { /* ignore */ }
    try { rec.stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    mediaRecRef.current = null;
  }, []);

  const cancelRecording = useCallback(() => {
    stopMediaRecorder();
    chunksRef.current = [];
    abortRef.current?.abort();
    abortRef.current = null;
    clearTimers();
    setRecState("idle");
  }, [stopMediaRecorder, clearTimers]);

  useEffect(() => () => { cancelRecording(); }, [cancelRecording]);

  async function startRecording() {
    if (recState !== "idle" || disabled || isPending || isUploading || isGenerating) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onVoiceNoteError?.("Microphone access is needed to record audio.");
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";

    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.start(250);
    mediaRecRef.current = rec;
    setRecState("recording");

    const started = Date.now();
    tickRef.current = window.setInterval(() => {
      const next = Math.round((Date.now() - started) / 1000);
      setElapsed(next);
      if (next >= MAX_RECORD_SECONDS) void stopAndTranscribe();
    }, 250);
  }

  async function stopAndTranscribe() {
    if (recState === "transcribing") return;
    clearTimers();

    // Collect the final chunk then stop
    const rec = mediaRecRef.current;
    if (!rec) { setRecState("idle"); return; }

    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      stopMediaRecorder();
    });

    const chunks = chunksRef.current;
    chunksRef.current = [];

    if (chunks.length === 0) {
      onVoiceNoteError?.("Nothing was captured. Please try again.");
      setRecState("idle");
      return;
    }

    setRecState("transcribing");
    const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const text = await transcribeAudio(blob);
      if (ctrl.signal.aborted) return;
      onChange(text);
      setRecState("idle");
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      if (ctrl.signal.aborted) return;
      onVoiceNoteError?.("Could not transcribe audio. Please try again.");
      setRecState("idle");
    } finally {
      abortRef.current = null;
    }
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    setPendingFiles((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
        if (!ACCEPTED_EXT.includes(ext)) {
          setFileHint("Use PDF, Word, text, CSV, or Markdown.");
          continue;
        }
        if (file.size === 0) {
          setFileHint("Empty files cannot be uploaded.");
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          setFileHint("Each file must be 15 MB or smaller.");
          continue;
        }
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
    setPendingFiles([]);
    try {
      await onSend(text, files);
    } catch {
      setPendingFiles(files);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const busy = disabled || isUploading;
  const recording = recState === "recording";
  const transcribing = recState === "transcribing";
  const hasText = value.trim().length >= 3;
  const canSend = !busy && !isPending && recState === "idle" && (hasText || pendingFiles.length > 0);
  const showVoiceMode = Boolean(onVoiceModeOpen) && !hasText && pendingFiles.length === 0 && recState === "idle";

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
        {attachedDocuments.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 px-1 pt-0.5" aria-label="Documents in context">
            {attachedDocuments.map((doc) => (
              <li
                key={doc.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-800/20 bg-amber-50/60 py-1 pl-2.5 pr-1 text-[12px] text-amber-900 dark:border-amber-500/20 dark:bg-amber-900/10 dark:text-amber-300"
                title="This document is in context for this conversation"
              >
                <FileUp className="h-3 w-3 shrink-0 opacity-70" />
                <span className="max-w-[9.5rem] truncate font-medium">{doc.name}</span>
                {onDetachDocument && (
                  <button
                    type="button"
                    onClick={() => onDetachDocument(doc.id)}
                    disabled={isGenerating}
                    className="flex h-6 w-6 items-center justify-center rounded-full opacity-60 hover:bg-amber-800/10 hover:opacity-100 disabled:opacity-30 dark:hover:bg-amber-400/10"
                    aria-label={`Remove ${doc.name} from context`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {pendingFiles.length > 0 && (
          <div className="space-y-2 px-1 pt-0.5">
            {uploadProgress && (
              <div
                className="rounded-xl border border-amber-800/15 bg-gradient-to-r from-amber-50/90 to-white px-3 py-2.5 dark:border-amber-500/20 dark:from-amber-950/40 dark:to-zinc-900"
                role="status"
                aria-live="polite"
              >
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
                  <span className="truncate font-medium text-amber-950 dark:text-amber-100">
                    {uploadProgress.stage === "uploading" && "Uploading"}
                    {uploadProgress.stage === "reading" && "Reading document"}
                    {uploadProgress.stage === "ready" && "Ready"}
                    {uploadProgress.stage === "failed" && "Could not process"}
                    {` · ${uploadProgress.fileName}`}
                  </span>
                  <span className="shrink-0 tabular-nums text-amber-800 dark:text-amber-300">
                    {uploadProgress.percent}%
                    {uploadElapsed > 0 ? ` · ${uploadElapsed}s` : ""}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-amber-900/10 dark:bg-amber-200/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-800 to-amber-600 transition-[width] duration-200 ease-out dark:from-amber-500 dark:to-amber-400"
                    style={{ width: `${Math.max(4, uploadProgress.percent)}%` }}
                  />
                </div>
              </div>
            )}
            <ul className="flex flex-wrap gap-2" aria-label="Attached files">
              {pendingFiles.map((file, index) => {
                const uploading = uploadingFileName === file.name || uploadProgress?.fileName === file.name;
                return (
                  <li key={fileKey(file)} className="relative">
                    <ChatFileCard name={file.name} size={file.size} contentType={file.type} />
                    {uploading && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-800 text-white shadow dark:bg-amber-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      disabled={busy || isGenerating || recording}
                      className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white text-muted-foreground shadow-sm hover:text-foreground disabled:opacity-40 dark:border-white/15 dark:bg-zinc-800"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
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
            disabled={busy || isGenerating || recording || transcribing}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          </DockIconButton>

          <DockIconButton
            onClick={() => void startRecording()}
            label="Record voice input"
            disabled={busy || isGenerating || recording || transcribing}
            active={recording}
          >
            <Mic className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </DockIconButton>

          {/* Recording state */}
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
                Recording…
              </span>
              <button
                type="button"
                onClick={cancelRecording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
                aria-label="Cancel recording"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void stopAndTranscribe()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-800 to-amber-900 text-white shadow-sm transition-transform active:scale-95 dark:from-amber-600 dark:to-amber-700"
                aria-label="Stop and transcribe"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : transcribing ? (
            /* Transcribing state */
            <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 py-1" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-700 dark:text-amber-400" />
              <span className="min-w-0 flex-1 text-[12px] text-muted-foreground">Transcribing…</span>
              <button
                type="button"
                onClick={cancelRecording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
                aria-label="Cancel transcription"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Normal textarea */
            <textarea
              ref={textareaRef}
              rows={MIN_ROWS}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Describe your matter…"
              disabled={disabled}
              className={cn(
                "max-h-[150px] min-h-[44px] flex-1 resize-none bg-transparent py-2 leading-6 placeholder:text-muted-foreground/80 focus:outline-none",
                "text-base md:min-h-[40px] md:py-1.5 md:text-[13.5px]",
              )}
              aria-label="Chat message input"
            />
          )}

          {recState === "idle" &&
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
          Enter to send · Mic for voice input
          {onVoiceModeOpen ? " · Wave icon for live voice" : ""}
        </p>
      )}
    </div>
  );
}
