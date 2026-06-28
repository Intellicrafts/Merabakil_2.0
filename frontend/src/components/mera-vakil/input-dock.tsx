"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";

import { cn } from "@/lib/utils";

interface InputDockProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isPending?: boolean;
  isUploading?: boolean;
  onFileSelect?: (file: File) => void;
}

const MIN_ROWS = 1;
const MAX_ROWS = 6;
const LINE_HEIGHT = 24;
const ACCEPTED_TYPES = ".pdf,.doc,.docx,.txt,.csv,.md";

export function InputDock({
  value,
  onChange,
  onSubmit,
  disabled,
  isPending,
  isUploading,
  onFileSelect,
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

  const busy = disabled || isPending || isUploading;
  const canSend = !busy && value.trim().length >= 3;

  return (
    <div className="shrink-0 px-4 pb-6 pt-2 md:px-6">
      <div
        className={cn(
          "mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-black/[0.07] bg-white/70 px-2.5 py-2 shadow-[0_6px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 ease-in-out dark:border-white/10 dark:bg-white/5",
          focused && "border-slate-400/60 shadow-[0_8px_30px_rgba(15,23,42,0.14)] dark:border-slate-400/40",
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
        <button
          type="button"
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground disabled:opacity-50 dark:hover:bg-white/10"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach document"
          disabled={busy}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </button>

        <textarea
          ref={textareaRef}
          rows={MIN_ROWS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ask Mera Vakil anything — general or legal…"
          disabled={busy}
          className="max-h-[150px] min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-[13.5px] leading-6 placeholder:text-muted-foreground focus:outline-none"
          aria-label="Chat message input"
        />

        <button
          type="button"
          className={cn(
            "orb-glow mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-md transition-all duration-300 ease-in-out dark:from-slate-100 dark:to-slate-300 dark:text-slate-900",
            canSend ? "hover:scale-105 active:scale-95" : "opacity-50 cursor-not-allowed",
          )}
          onClick={onSubmit}
          disabled={!canSend}
          aria-label={isPending ? "Sending message" : "Send message"}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Enter to send · Shift+Enter for new line · Attach PDF, DOCX, TXT, CSV
      </p>
    </div>
  );
}
