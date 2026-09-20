"use client";

import { useMemo } from "react";
import { Calendar, CheckCircle2, Circle, Lock, Mail, MapPin, Phone, UserRound } from "lucide-react";

import { ProfileSectionCard } from "@/components/profile/profile-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { CitizenProfileFormState } from "@/hooks/use-citizen-profile";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const STRENGTH_CHECKS = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
] as const;

export function CitizenProfileEditor({
  loading,
  saving,
  error,
  form,
  isDirty,
  setField,
  onUpdate,
  onRetry,
}: {
  loading: boolean;
  saving: boolean;
  error: string | null;
  form: CitizenProfileFormState;
  isDirty: boolean;
  setField: <K extends keyof CitizenProfileFormState>(
    key: K,
    value: CitizenProfileFormState[K],
  ) => void;
  onUpdate: () => Promise<void>;
  onRetry: () => void;
}) {
  const { toast } = useToast();

  const strength = useMemo(() => {
    const checks = [
      { label: "Name", done: form.full_name.trim().length > 0 },
      { label: "Phone", done: form.phone.trim().length > 0 },
      { label: "Address", done: form.address.trim().length > 0 },
    ];
    return { checks, count: checks.filter((c) => c.done).length };
  }, [form.full_name, form.phone, form.address]);

  async function handleUpdate() {
    try {
      await onUpdate();
      track(AnalyticsEvents.PROFILE_SAVED, {
        profile_type: "citizen",
        profile_strength: strength.count,
        fields_changed_count: strength.count,
      });
      toast({ title: "Profile updated successfully", variant: "success" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Could not update profile",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <ProfileSectionCard>
        <div className="space-y-4 animate-pulse">
          <div className="h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.06]" />
          <div className="h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.06]" />
          <div className="h-24 rounded-xl bg-black/[0.04] dark:bg-white/[0.06]" />
        </div>
      </ProfileSectionCard>
    );
  }

  if (error) {
    return (
      <ProfileSectionCard>
        <p className="text-[13px] text-destructive">{error}</p>
        <Button type="button" variant="ghost" className="mt-3 h-10 rounded-xl" onClick={onRetry}>
          Try again
        </Button>
      </ProfileSectionCard>
    );
  }

  return (
    <div className="space-y-4 pb-28 sm:pb-6">
      <ProfileSectionCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold">Profile strength</p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              {strength.count}/{STRENGTH_CHECKS.length} details added
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            {strength.count}/{STRENGTH_CHECKS.length}
          </span>
        </div>
        <div className="mt-3 hidden grid-cols-3 gap-1.5 sm:grid">
          {strength.checks.map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-lg px-2 py-2 text-center text-[10px] font-medium",
                item.done
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-black/[0.03] text-muted-foreground dark:bg-white/[0.04]",
              )}
            >
              <span className="inline-flex items-center gap-1">
                {item.done ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3 opacity-50" />
                )}
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard title="Basic information">
        <div className="space-y-4">
          <div className="mp-profile-field">
            <Label htmlFor="citizen-full-name" className="flex items-center gap-1.5 text-[12px]">
              <UserRound className="h-3.5 w-3.5" />
              Full name
            </Label>
            <Input
              id="citizen-full-name"
              value={form.full_name}
              onChange={(e) => setField("full_name", e.target.value)}
              className="h-11 rounded-xl"
              autoComplete="name"
            />
          </div>

          <div className="mp-profile-field">
            <Label htmlFor="citizen-email" className="flex items-center gap-1.5 text-[12px]">
              <Mail className="h-3.5 w-3.5" />
              Email
            </Label>
            <div className="relative">
              <Input
                id="citizen-email"
                value={form.email}
                readOnly
                className="h-11 rounded-xl bg-black/[0.02] pr-10 dark:bg-white/[0.03]"
              />
              <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="mp-profile-field">
            <Label htmlFor="citizen-phone" className="flex items-center gap-1.5 text-[12px]">
              <Phone className="h-3.5 w-3.5" />
              Phone
            </Label>
            <Input
              id="citizen-phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="+91 98765 43210"
              className="h-11 rounded-xl"
              autoComplete="tel"
            />
          </div>

          <div className="mp-profile-field">
            <Label htmlFor="citizen-dob" className="flex items-center gap-1.5 text-[12px]">
              <Calendar className="h-3.5 w-3.5" />
              Date of birth
            </Label>
            <Input
              id="citizen-dob"
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setField("date_of_birth", e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="mp-profile-field">
            <Label htmlFor="citizen-address" className="flex items-center gap-1.5 text-[12px]">
              <MapPin className="h-3.5 w-3.5" />
              Address
            </Label>
            <Textarea
              id="citizen-address"
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
              rows={3}
              placeholder="City, state, or full address"
              className="min-h-[88px] resize-none rounded-xl"
            />
          </div>
        </div>
      </ProfileSectionCard>

      <div className="mp-profile-sticky-footer sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <Button
          type="button"
          className="mp-btn-accent h-11 w-full rounded-xl text-[13px] font-semibold sm:w-auto sm:min-w-[10rem]"
          disabled={!isDirty || saving}
          onClick={() => void handleUpdate()}
        >
          {saving ? "Updating…" : "Update profile"}
        </Button>
      </div>
    </div>
  );
}
