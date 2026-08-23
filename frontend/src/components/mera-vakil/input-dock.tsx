"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Paperclip, Send } from "lucide-react";

import { cn } from "@/lib/utils";

interface InputDockProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isPending?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
  isUploading?: boolean;
  onFileSelect?: (file: File) => void;
  onVoiceModeOpen?: () => void;
}

const MIN_ROWS = 1;
const MAX_ROWS = 6;
const LINE_HEIGHT = 24;
const ACCEPTED_TYPES = ".pdf,.doc,.docx,.txt,.csv,.md";

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
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground active:scale-95 disabled:opacity-45 md:h-9 md:w-9 md:rounded-full dark:hover:bg-white/10"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function InputDock({
  value,
  onChange,
  onSubmit,
  disabled,
  isPending,
  isGenerating,
  onStop,
  isUploading,
  onFileSelect,
  onVoiceModeOpen,
}: InputDockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isPending && !isUploading && value.trim().length >= 3) {
        onSubmit();
      }
    }
  }

  const busy = disabled || isUploading;
  const canSend = !busy && !isPending && value.trim().length >= 3;

  return (
    <div
      className={cn(
        "mv-input-dock shrink-0",
        "px-3 pt-1.5",
        "pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]",
        "md:px-6 md:pb-6 md:pt-2",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-3xl items-end gap-1.5 md:gap-2",
          "rounded-[1.35rem] border px-2 py-2 md:rounded-2xl md:px-2.5",
          "border-black/[0.07] bg-white",
          "shadow-[0_6px_28px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.65)_inset]",
          "transition-[border-color,box-shadow,transform] duration-200",
          "dark:border-white/[0.12] dark:bg-zinc-900",
          "dark:shadow-[0_10px_36px_rgba(0,0,0,0.42),0_1px_0_rgba(255,255,255,0.04)_inset]",
          focused &&
            "border-amber-800/30 shadow-[0_8px_32px_rgba(120,53,15,0.12),0_0_0_3px_rgba(120,53,15,0.08)] dark:border-amber-500/35 dark:shadow-[0_10px_36px_rgba(0,0,0,0.45),0_0_0_3px_rgba(217,119,6,0.12)]",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelect?.(file);
            e.target.value = "";
          }}
        />

        <DockIconButton
          onClick={() => fileInputRef.current?.click()}
          label="Attach document"
          disabled={busy || isGenerating}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </DockIconButton>

        {onVoiceModeOpen && (
          <DockIconButton
            onClick={onVoiceModeOpen}
            label="Voice mode"
            disabled={busy || isGenerating}
          >
            <Mic className="h-4 w-4" />
          </DockIconButton>
        )}

        <textarea
          ref={textareaRef}
          rows={MIN_ROWS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ask Mera Vakil anything…"
          disabled={disabled || isUploading}
          className={cn(
            "max-h-[150px] min-h-[40px] flex-1 resize-none bg-transparent py-2 leading-6 placeholder:text-muted-foreground/80 focus:outline-none",
            "text-base md:min-h-[36px] md:py-1.5 md:text-[13.5px]",
          )}
          aria-label="Chat message input"
        />

        {isGenerating && onStop ? (
          <StopButton onClick={onStop} />
        ) : (
          <button
            type="button"
            className={cn(
              "mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              "bg-gradient-to-b from-amber-800 to-amber-900 text-white",
              "shadow-[0_4px_14px_rgba(120,53,15,0.35)] transition-all",
              "hover:from-amber-900 hover:to-amber-950 active:scale-95",
              "md:h-10 md:w-10 dark:from-amber-600 dark:to-amber-700 dark:hover:from-amber-500 dark:hover:to-amber-600",
              !canSend && "cursor-not-allowed opacity-45 shadow-none",
            )}
            onClick={onSubmit}
            disabled={!canSend}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="mt-2 hidden text-center text-xs text-muted-foreground md:block">
        Enter to send · Shift+Enter for new line
        {onVoiceModeOpen ? " · Mic for voice mode" : " · Attach PDF, DOCX, TXT, CSV"}
      </p>
    </div>
  );
}
