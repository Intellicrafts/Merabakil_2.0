"use client";

import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AudioLines, FileUp, Loader2, Mic, Send, X } from "lucide-react";

import { AttachmentPickerPopover } from "@/components/mera-vakil/attachment-picker-popover";
import { ComposerAttachmentList } from "@/components/mera-vakil/composer-attachment-list";
import { SaarthiCameraCapture } from "@/components/mera-vakil/saarthi-camera-capture";
import { streamTranscribeAudio } from "@/lib/api";
import {
  ACCEPTED_FILE_TYPES,
  MAX_COMPOSER_FILES,
  composerFileKey,
  validateComposerFile,
  type ComposerAttachment,
} from "@/lib/composer-attachments";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface InputDockProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => Promise<void> | void;
  composerAttachments?: ComposerAttachment[];
  onFilesSelected?: (files: File[]) => void;
  onRemoveAttachment?: (localId: string) => void;
  onRetryAttachment?: (localId: string) => void;
  disabled?: boolean;
  isPending?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
  onVoiceModeOpen?: () => void;
  onVoiceNoteError?: (message: string) => void;
  speechLocale?: string;
}

const MIN_ROWS = 1;
const MAX_ROWS = 6;
const LINE_HEIGHT = 24;
const MAX_RECORD_SECONDS = 120;
const WAVE_BARS = 14;

type RecordState = "idle" | "recording" | "transcribing";

function formatClock(total: number): string {
  const seconds = Math.max(0, Math.floor(total));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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

const DockIconButton = forwardRef<
  HTMLButtonElement,
  {
    onClick: () => void;
    label: string;
    disabled?: boolean;
    active?: boolean;
    expanded?: boolean;
    children: React.ReactNode;
  }
>(function DockIconButton({ onClick, label, disabled, active, expanded, children }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors",
        "hover:bg-black/[0.04] hover:text-foreground active:scale-95 disabled:opacity-45",
        "md:h-10 md:w-10 md:rounded-full dark:hover:bg-white/10",
        active && "bg-amber-800/10 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
      )}
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      disabled={disabled}
    >
      {children}
    </button>
  );
});

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
  composerAttachments = [],
  onFilesSelected,
  onRemoveAttachment,
  onRetryAttachment,
  disabled,
  isPending,
  isGenerating,
  onStop,
  onVoiceModeOpen,
  onVoiceNoteError,
}: InputDockProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [attachCaretOffset, setAttachCaretOffset] = useState(22);
  const [recState, setRecState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [fileHint, setFileHint] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(true);

  const tickRef = useRef<number | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraAvailable(false);
      return;
    }
    setCameraAvailable(true);
  }, []);

  useLayoutEffect(() => {
    if (!pickerOpen) return;
    const btn = attachButtonRef.current;
    const container = composerRef.current;
    if (!btn || !container) return;
    setAttachCaretOffset(btn.offsetLeft + btn.offsetWidth / 2);
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (attachButtonRef.current?.contains(target)) return;
      const popover = composerRef.current?.querySelector('[role="menu"]');
      if (popover?.contains(target)) return;
      setPickerOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPickerOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);

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

  const stopMediaRecorder = useCallback(() => {
    const rec = mediaRecRef.current;
    if (!rec) return;
    try { rec.stop(); } catch { /* ignore */ }
    try { rec.stream.getTracks().forEach((track) => track.stop()); } catch { /* ignore */ }
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
    if (recState !== "idle" || disabled || isPending || isGenerating) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onVoiceNoteError?.(t("chat.microphoneAccess"));
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

    const rec = mediaRecRef.current;
    if (!rec) { setRecState("idle"); return; }

    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      stopMediaRecorder();
    });

    const chunks = chunksRef.current;
    chunksRef.current = [];

    if (chunks.length === 0) {
      onVoiceNoteError?.(t("chat.nothingCaptured"));
      setRecState("idle");
      return;
    }

    setRecState("transcribing");
    const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let accumulated = "";
    try {
      await streamTranscribeAudio(
        blob,
        (token) => {
          accumulated += token;
          onChange(accumulated);
        },
        ctrl.signal,
      );
      if (ctrl.signal.aborted) return;
      setRecState("idle");
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      if (ctrl.signal.aborted) return;
      onVoiceNoteError?.(t("chat.transcriptionError"));
      setRecState("idle");
    } finally {
      abortRef.current = null;
    }
  }

  function queueFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const accepted: File[] = [];
    const existingKeys = new Set(composerAttachments.map((a) => `${a.fileName}:${a.size}`));

    for (const file of incoming) {
      const validation = validateComposerFile(file);
      if (validation === "type") {
        setFileHint(t("chat.fileTypes"));
        continue;
      }
      if (validation === "empty") {
        setFileHint(t("chat.fileEmpty"));
        continue;
      }
      if (validation === "large") {
        setFileHint(t("chat.fileLarge"));
        continue;
      }
      if (composerAttachments.length + accepted.length >= MAX_COMPOSER_FILES) {
        setFileHint(t("chat.fileLimit").replace("{{count}}", String(MAX_COMPOSER_FILES)));
        break;
      }
      const key = composerFileKey(file);
      if (existingKeys.has(`${file.name}:${file.size}`) || accepted.some((item) => composerFileKey(item) === key)) {
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) {
      onFilesSelected?.(accepted);
    }
    window.setTimeout(() => setFileHint(null), 2800);
  }

  async function handleSend() {
    if (disabled || isPending || isGenerating) return;
    const text = value.trim();
    const readyCount = composerAttachments.filter((a) => a.status === "ready").length;
    if (text.length < 3 && readyCount === 0) return;
    await onSend(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const uploadsInFlight = composerAttachments.some(
    (a) => a.status === "uploading" || a.status === "reading",
  );
  const readyAttachments = composerAttachments.filter((a) => a.status === "ready");
  const busy = disabled || uploadsInFlight;
  const recording = recState === "recording";
  const transcribing = recState === "transcribing";
  const hasText = value.trim().length >= 3;
  const canSend =
    !busy &&
    !isPending &&
    recState === "idle" &&
    (hasText || readyAttachments.length > 0);
  const showVoiceMode =
    Boolean(onVoiceModeOpen) &&
    !hasText &&
    composerAttachments.length === 0 &&
    recState === "idle";

  return (
    <>
      <div
        className={cn(
          "mv-input-dock shrink-0",
          "px-3 pt-1.5",
          "pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]",
          "md:px-6 md:pb-6 md:pt-2",
          "will-change-[transform]",
        )}
      >
        <div ref={composerRef} className="relative mx-auto max-w-3xl">
          <AttachmentPickerPopover
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onUploadDocument={() => fileInputRef.current?.click()}
            onTakePhoto={() => setCameraOpen(true)}
            cameraAvailable={cameraAvailable}
            caretOffset={attachCaretOffset}
          />

          <div
            className={cn(
              "flex flex-col gap-2",
              "rounded-[1.35rem] border px-2 py-2 md:rounded-2xl md:px-2.5",
              "border-black/[0.07] bg-white",
              "shadow-[0_6px_28px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.65)_inset]",
              "transition-[border-color,box-shadow] duration-200",
              "dark:border-white/[0.12] dark:bg-zinc-900",
              "dark:shadow-[0_10px_36px_rgba(0,0,0,0.42),0_1px_0_rgba(255,255,255,0.04)_inset]",
              (focused || recording || pickerOpen) &&
                "border-amber-800/30 shadow-[0_8px_32px_rgba(120,53,15,0.12),0_0_0_3px_rgba(120,53,15,0.08)] dark:border-amber-500/35 dark:shadow-[0_10px_36px_rgba(0,0,0,0.45),0_0_0_3px_rgba(217,119,6,0.12)]",
            )}
          >
          {composerAttachments.length > 0 && (
            <ComposerAttachmentList
              attachments={composerAttachments}
              disabled={isGenerating || recording}
              onRemove={(localId) => onRemoveAttachment?.(localId)}
              onRetry={(localId) => onRetryAttachment?.(localId)}
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) queueFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="flex items-end gap-1.5 md:gap-2">
            <DockIconButton
              ref={attachButtonRef}
              onClick={() => setPickerOpen((open) => !open)}
              label={t("chat.attachDocuments")}
              disabled={busy || isGenerating || recording || transcribing}
              active={pickerOpen}
              expanded={pickerOpen}
            >
              {uploadsInFlight ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-[18px] w-[18px]" strokeWidth={1.75} />
              )}
            </DockIconButton>

            <DockIconButton
              onClick={() => void startRecording()}
              label={t("chat.recordVoice")}
              disabled={busy || isGenerating || recording || transcribing}
              active={recording}
            >
              {transcribing
                ? <Loader2 className="h-[18px] w-[18px] animate-spin text-amber-700 dark:text-amber-400" />
                : <Mic className="h-[18px] w-[18px]" strokeWidth={1.75} />}
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
                  {t("chat.recording")}
                </span>
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
                  aria-label={t("chat.cancelRecording")}
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void stopAndTranscribe()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-800 to-amber-900 text-white shadow-sm transition-transform active:scale-95 dark:from-amber-600 dark:to-amber-700"
                  aria-label={t("chat.stopTranscribe")}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : transcribing ? (
              <>
                <textarea
                  ref={textareaRef}
                  rows={MIN_ROWS}
                  value={value}
                  readOnly
                  className={cn(
                    "max-h-[150px] min-h-[44px] flex-1 resize-none bg-transparent py-2 leading-6 focus:outline-none",
                    "text-base md:min-h-[40px] md:py-1.5 md:text-[13.5px]",
                    "text-foreground/90",
                  )}
                  aria-label={t("chat.transcribing")}
                  aria-live="polite"
                  placeholder={t("chat.transcribing")}
                />
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10 md:h-10 md:w-10"
                  aria-label={t("chat.cancelTranscription")}
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <textarea
                ref={textareaRef}
                rows={MIN_ROWS}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={t("chat.describeYourMatter")}
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
                <PrimaryDisc onClick={onVoiceModeOpen!} label={t("chat.startVoiceMode")}>
                  <AudioLines className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </PrimaryDisc>
              ) : (
                <PrimaryDisc
                  onClick={() => void handleSend()}
                  disabled={!canSend}
                  muted={!canSend}
                  label={t("chat.sendMessage")}
                >
                  <Send className="h-4 w-4" />
                </PrimaryDisc>
              ))}
          </div>
          </div>
        </div>

        {fileHint ? (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{fileHint}</p>
        ) : (
          <p className="mt-2 hidden text-center text-xs text-muted-foreground md:block">
            {t("chat.enterToSend")}
            {onVoiceModeOpen ? " · Wave icon for live voice" : ""}
          </p>
        )}
      </div>

      <SaarthiCameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => queueFiles([file])}
      />
    </>
  );
}
