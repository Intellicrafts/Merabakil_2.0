"use client";

import { useCallback, useEffect, useRef } from "react";

import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";
import { cn } from "@/lib/utils";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
};

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  className,
}: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(length, " ").slice(0, length).split("");

  const focusIndex = useCallback((index: number) => {
    const el = inputsRef.current[index];
    el?.focus();
    el?.select();
  }, []);

  useEffect(() => {
    if (autoFocus) {
      focusIndex(0);
    }
  }, [autoFocus, focusIndex]);

  const updateAt = (index: number, char: string) => {
    const next = digits.map((d, i) => (i === index ? char : d === " " ? "" : d)).join("");
    onChange(next.slice(0, length));
  };

  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      updateAt(index, "");
      return;
    }
    if (cleaned.length === 1) {
      updateAt(index, cleaned);
      if (index < length - 1) focusIndex(index + 1);
      return;
    }
    const merged = (value.slice(0, index) + cleaned).slice(0, length);
    onChange(merged);
    focusIndex(Math.min(index + cleaned.length, length - 1));
  };

  const handleKeyDown = (index: number, key: string) => {
    if (key === "Backspace" && !digits[index]?.trim() && index > 0) {
      focusIndex(index - 1);
    }
    if (key === "ArrowLeft" && index > 0) focusIndex(index - 1);
    if (key === "ArrowRight" && index < length - 1) focusIndex(index + 1);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    focusIndex(Math.min(pasted.length, length - 1));
  };

  return (
    // Clarity masks type=password but not these type=text digits — mask explicitly.
    <div
      {...CLARITY_MASK}
      className={cn("flex justify-center gap-2", className)}
      role="group"
      aria-label="One-time code"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          value={digit.trim()}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          className={cn(
            "h-12 w-10 rounded-xl border text-center text-lg font-semibold tracking-widest",
            "border-black/[0.08] bg-white text-foreground shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            "dark:border-white/[0.10] dark:bg-zinc-800",
            disabled && "opacity-60",
          )}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e.key)}
          onPaste={handlePaste}
          onFocus={(e) => e.currentTarget.select()}
        />
      ))}
    </div>
  );
}
