"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { lawyerAvatarSrc } from "@/lib/lawyer-avatar";
import { bookConsultation } from "@/lib/marketplace-store";
import type { LawyerProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIME_SLOTS = [
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
];

interface BookingDialogProps {
  lawyer: LawyerProfile | null;
  open: boolean;
  onClose: () => void;
  onBooked: () => void;
}

export function BookingDialog({ lawyer, open, onClose, onBooked }: BookingDialogProps) {
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [matter, setMatter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !lawyer || !mounted) return null;

  const counsel = lawyer;

  function reset() {
    setDate("");
    setSlot("");
    setMatter("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !slot || matter.trim().length < 10) {
      toast({
        title: "Missing details",
        description: "Choose a date, time slot, and describe your matter (min 10 characters).",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      bookConsultation({
        lawyer_id: counsel.id,
        date,
        time_slot: slot,
        matter_summary: matter,
      });
      toast({
        title: "Consultation requested",
        description: `Your request with ${counsel.full_name} has been saved.`,
        variant: "success",
      });
      reset();
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

  const minDate = new Date().toISOString().slice(0, 10);

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
        className="relative z-[71] flex max-h-[min(92vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-black/[0.08] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[hsl(220_14%_9%)] sm:rounded-3xl"
      >
        <div className="relative shrink-0 border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-500/[0.06] via-transparent to-transparent" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl ring-1 ring-black/[0.08] shadow-sm dark:ring-white/10">
                <Image
                  src={lawyerAvatarSrc(lawyer.id)}
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
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {lawyer.full_name}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 rounded-full p-0"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex items-start gap-2 rounded-xl border border-black/[0.05] bg-slate-50/80 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
              Include court stage, city, and urgency so counsel can prepare.
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="booking-date" className="text-[11px] font-medium text-muted-foreground">
                Date
              </Label>
              <Input
                id="booking-date"
                type="date"
                min={minDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl border-black/[0.08] bg-white text-[13px] dark:border-white/10 dark:bg-white/[0.04]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label id="time-slot-label" className="text-[11px] font-medium text-muted-foreground">
                Time slot
              </Label>
              <div
                className="grid grid-cols-3 gap-2 sm:grid-cols-4"
                role="group"
                aria-labelledby="time-slot-label"
              >
                {TIME_SLOTS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSlot(t)}
                    className={cn(
                      "min-h-9 rounded-xl border px-2 text-[12px] font-medium transition-all duration-200",
                      slot === t
                        ? "border-slate-400/60 bg-slate-100 text-slate-800 shadow-sm dark:border-white/25 dark:bg-white/15 dark:text-zinc-100"
                        : "border-black/[0.08] bg-white/70 text-muted-foreground hover:border-slate-300 hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="matter-summary"
                className="text-[11px] font-medium text-muted-foreground"
              >
                Matter summary
              </Label>
              <Textarea
                id="matter-summary"
                value={matter}
                onChange={(e) => setMatter(e.target.value)}
                placeholder="Briefly describe your legal matter…"
                rows={3}
                className="rounded-xl border-black/[0.08] bg-white text-[13px] dark:border-white/10 dark:bg-white/[0.04]"
                required
              />
            </div>
          </div>

          <div className="shrink-0 border-t border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
            <button
              type="submit"
              className="mp-btn-accent h-10 w-full rounded-xl text-[13px] font-semibold disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Confirm booking"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
