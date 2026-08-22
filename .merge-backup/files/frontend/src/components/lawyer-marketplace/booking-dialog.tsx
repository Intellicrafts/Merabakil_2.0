"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, CalendarDays, Check, Clock3, FileText, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { bookAppointment, getStoredUser } from "@/lib/api";
import { lawyerAvatarSrc } from "@/lib/lawyer-avatar";
import type { LawyerProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIME_SLOTS = [
  "Immediate",
  "Start in 1 minute",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
];

const QUICK_SLOTS = new Set(["immediate", "start in 1 minute"]);
const STEPS = ["When", "Matter", "Review"] as const;
const MATTER_MIN = 10;

type Step = 0 | 1 | 2;
type FieldErrors = { date?: string; slot?: string; matter?: string };

function localToday(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function formatReviewDate(isoDate: string): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(y, m - 1, d));
}

interface BookingDialogProps {
  lawyer: LawyerProfile | null;
  open: boolean;
  onClose: () => void;
  onBooked: () => void;
  source?: "ai_match" | "manual";
}

export function BookingDialog({ lawyer, open, onClose, onBooked, source = "manual" }: BookingDialogProps) {
  const { toast } = useToast();
  const today = useMemo(() => localToday(), [open]);
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState("Immediate");
  const [matter, setMatter] = useState("");
  const [step, setStep] = useState<Step>(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const nextToday = localToday();
    setDate(nextToday);
    setSlot("Immediate");
    setMatter("");
    setStep(0);
    setErrors({});
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const matterLen = matter.trim().length;
  const dateValid = Boolean(date) && date >= today;
  const slotValid = Boolean(slot);
  const matterValid = matterLen >= MATTER_MIN;
  const allValid = dateValid && slotValid && matterValid;

  function validateWhen(): boolean {
    const next: FieldErrors = {};
    if (!date) next.date = "Choose a consultation date.";
    else if (date < today) next.date = "Choose today or a future date.";
    if (!slot) next.slot = "Select a time slot to continue.";
    setErrors(next);
    return !next.date && !next.slot;
  }

  function validateMatter(): boolean {
    const next: FieldErrors = {};
    if (!matterValid) next.matter = `Describe the matter in at least ${MATTER_MIN} characters.`;
    setErrors((prev) => ({ ...prev, matter: next.matter }));
    return !next.matter;
  }

  function handleClose() {
    onClose();
  }

  function goNext() {
    if (step === 0 && !validateWhen()) return;
    if (step === 1 && !validateMatter()) return;
    setErrors({});
    setStep((prev) => (prev < 2 ? ((prev + 1) as Step) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step < 2) {
      goNext();
      return;
    }
    if (!allValid) {
      validateWhen();
      validateMatter();
      return;
    }
    if (!lawyer) return;
    setSubmitting(true);
    try {
      const user = getStoredUser();
      await bookAppointment({
        lawyer_id: lawyer.id,
        date,
        time_slot: slot,
        matter_summary: matter.trim(),
        source,
        citizen_name: user?.full_name ?? "Citizen",
      });
      toast({
        title: "Consultation booked",
        description: `Your request with ${lawyer.full_name} is confirmed.`,
        variant: "success",
      });
      onBooked();
      onClose();
    } catch (err) {
      toast({
        title: "Booking failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !lawyer || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-5">
      <button
        type="button"
        className="mp-modal-veil absolute inset-0"
        aria-label="Close booking dialog"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        className="relative z-[71] flex max-h-[min(94vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-black/[0.08] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[hsl(220_14%_9%)] sm:rounded-3xl"
      >
        <div className="relative shrink-0 border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-500/[0.06] via-transparent to-transparent" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl ring-1 ring-black/[0.08] shadow-sm dark:ring-white/10">
                <Image
                  src={lawyerAvatarSrc(lawyer.slug || lawyer.id)}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                  <h2 id="booking-title" className="text-[14px] font-semibold tracking-tight">
                    Book consultation
                  </h2>
                </div>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{lawyer.full_name}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 rounded-full p-0" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ol className="relative mt-4 flex items-center gap-2">
            {STEPS.map((label, index) => {
              const active = step === index;
              const done = step > index;
              return (
                <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      done && "bg-slate-800 text-white dark:bg-white dark:text-slate-900",
                      active && !done && "bg-slate-200 text-slate-800 dark:bg-white/20 dark:text-white",
                      !active && !done && "bg-black/[0.06] text-muted-foreground dark:bg-white/10",
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : index + 1}
                  </div>
                  <span
                    className={cn(
                      "truncate text-[11px] font-medium",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                  {index < STEPS.length - 1 && (
                    <span className="hidden h-px flex-1 bg-black/[0.06] dark:bg-white/10 sm:block" />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-[280px] space-y-4 overflow-y-auto px-5 py-4">
            {step === 0 && (
              <>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Choose when you want to meet. Immediate opens the room as soon as both of you join.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="booking-date" className="text-[11px] font-medium text-muted-foreground">
                    Date
                  </Label>
                  <Input
                    id="booking-date"
                    type="date"
                    min={today}
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setErrors((prev) => ({ ...prev, date: undefined }));
                    }}
                    className={cn(
                      "h-10 rounded-xl border-black/[0.08] bg-white text-[13px] dark:border-white/10 dark:bg-white/[0.04]",
                      errors.date && "border-red-300 dark:border-red-800",
                    )}
                  />
                  {errors.date && <p className="text-[11px] text-red-600 dark:text-red-400">{errors.date}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label id="time-slot-label" className="text-[11px] font-medium text-muted-foreground">
                    Time slot
                  </Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-labelledby="time-slot-label">
                    {TIME_SLOTS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setSlot(option);
                          if (QUICK_SLOTS.has(option.toLowerCase())) setDate(today);
                          setErrors((prev) => ({ ...prev, slot: undefined }));
                        }}
                        className={cn(
                          "min-h-10 rounded-xl border px-2 text-[12px] font-medium transition-all duration-200",
                          slot === option
                            ? "border-slate-500 bg-slate-900 text-white shadow-sm dark:border-white/40 dark:bg-white dark:text-slate-900"
                            : "border-black/[0.08] bg-white/70 text-muted-foreground hover:border-slate-300 hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]",
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {errors.slot && <p className="text-[11px] text-red-600 dark:text-red-400">{errors.slot}</p>}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="flex items-start gap-2 rounded-xl border border-black/[0.05] bg-slate-50/80 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  Include court stage, city, and urgency so counsel can prepare.
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="matter-summary" className="text-[11px] font-medium text-muted-foreground">
                      Matter summary
                    </Label>
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        matterValid ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                      )}
                    >
                      {matterLen}/{MATTER_MIN}
                    </span>
                  </div>
                  <Textarea
                    id="matter-summary"
                    value={matter}
                    onChange={(e) => {
                      setMatter(e.target.value);
                      if (e.target.value.trim().length >= MATTER_MIN) {
                        setErrors((prev) => ({ ...prev, matter: undefined }));
                      }
                    }}
                    placeholder="e.g. Anticipatory bail in a 498A matter, Delhi, hearing next week…"
                    rows={6}
                    className={cn(
                      "rounded-xl border-black/[0.08] bg-white text-[13px] dark:border-white/10 dark:bg-white/[0.04]",
                      errors.matter && "border-red-300 dark:border-red-800",
                    )}
                  />
                  {errors.matter ? (
                    <p className="text-[11px] text-red-600 dark:text-red-400">{errors.matter}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Minimum {MATTER_MIN} characters.</p>
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-[13px] text-muted-foreground">Review the details, then confirm the booking.</p>
                <div className="rounded-2xl border border-black/[0.06] bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Counsel</p>
                  <p className="mt-1 text-[14px] font-semibold tracking-tight">{lawyer.full_name}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-black/[0.06] px-4 py-3 dark:border-white/10">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Date
                    </p>
                    <p className="mt-1 text-[13px] font-medium">{formatReviewDate(date)}</p>
                  </div>
                  <div className="rounded-2xl border border-black/[0.06] px-4 py-3 dark:border-white/10">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      Slot
                    </p>
                    <p className="mt-1 text-[13px] font-medium">{slot}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-black/[0.06] px-4 py-3 dark:border-white/10">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Matter
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed">{matter.trim()}</p>
                </div>
                {!allValid && (
                  <p className="text-[11px] text-red-600 dark:text-red-400">
                    Complete date, time slot, and a matter of at least {MATTER_MIN} characters.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  className="mp-btn-soft inline-flex h-10 items-center rounded-xl px-4 text-[13px] font-semibold"
                  onClick={() => {
                    setErrors({});
                    setStep((prev) => (prev > 0 ? ((prev - 1) as Step) : prev));
                  }}
                >
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                  Back
                </button>
              )}
              <button
                type="submit"
                className="mp-btn-accent h-10 flex-1 rounded-xl text-[13px] font-semibold disabled:opacity-50"
                disabled={submitting || (step === 2 && !allValid)}
              >
                {submitting ? "Booking…" : step === 2 ? "Confirm booking" : "Continue"}
              </button>
            </div>
            {step === 2 && !allValid && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Add a date, slot, and matter summary to confirm.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
