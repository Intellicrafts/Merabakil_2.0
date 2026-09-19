"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  getMyLawyerListing,
  getStoredUser,
  upsertMyLawyerListing,
  verifyMyEnrollment,
} from "@/lib/api";
import type { VerifyResult } from "@/lib/types";
import { PRACTICE_AREAS, CITIES, JURISDICTIONS } from "@/lib/mock/lawyers";
import { cn } from "@/lib/utils";

const SUPPORTED_STATES = ["Uttar Pradesh", "Delhi", "Andhra Pradesh", "Rajasthan"] as const;

function detectBarCouncilState(enrollment: string): string {
  const en = enrollment.toUpperCase().trim();
  if (en.startsWith("UP")) return "Uttar Pradesh";
  if (en.startsWith("D/")) return "Delhi";
  if (en.startsWith("AP/")) return "Andhra Pradesh";
  if (en.startsWith("R/")) return "Rajasthan";
  return "";
}

interface MyListingEditorProps {
  onSaved?: () => void;
}

const COMPLETION_CHECKS = [
  { key: "areas",         label: "Practice areas" },
  { key: "experience",    label: "Experience" },
  { key: "bio",           label: "Bio (50+ chars)" },
  { key: "jurisdictions", label: "Jurisdictions" },
] as const;

function useCompletion(
  areas: string[],
  years: string,
  bio: string,
  jurisdictions: string[],
) {
  return useMemo(() => {
    const checks = [
      { label: "Practice areas", done: areas.length > 0 },
      { label: "Experience",     done: Number(years) > 0 },
      { label: "Bio (50+ chars)", done: bio.trim().length >= 50 },
      { label: "Jurisdictions",  done: jurisdictions.length > 0 },
    ];
    return { checks, count: checks.filter((c) => c.done).length };
  }, [areas, years, bio, jurisdictions]);
}

export function MyListingEditor({ onSaved }: MyListingEditorProps) {
  const { toast } = useToast();
  const user = getStoredUser();
  const canEdit = Boolean(user?.roles.includes("advocate"));

  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [city, setCity] = useState("");
  const [barId, setBarId] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("0");
  const [areas, setAreas] = useState<string[]>([]);
  const [jurisdictions, setJurisdictions] = useState<string[]>([]);
  const [languages, setLanguages] = useState("English, Hindi");
  const [bio, setBio] = useState("");
  const [verified, setVerified] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<Pick<VerifyResult, "status" | "data"> | null>(null);
  const [verifyState, setVerifyState] = useState("");
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [loadedBarId, setLoadedBarId] = useState("");

  const completion = useCompletion(areas, years, bio, jurisdictions);
  const isComplete = completion.count === COMPLETION_CHECKS.length;

  useEffect(() => {
    if (!canEdit) return;
    void getMyLawyerListing()
      .then((row) => {
        setFullName(row.full_name || user?.full_name || "");
        setCity(row.city || "");
        setBarId(row.bar_council_id || "");
        setRate(row.hourly_rate != null ? String(row.hourly_rate) : "");
        setYears(String(row.years_experience ?? 0));
        setAreas(row.practice_areas ?? []);
        setJurisdictions(row.jurisdictions ?? []);
        setLanguages((row.languages ?? []).join(", ") || "English, Hindi");
        setBio(row.bio || "");
        setVerified(Boolean(row.is_verified ?? row.verified));
        setVerifyState(detectBarCouncilState(row.bar_council_id || ""));
        setLoadedBarId(row.bar_council_id || "");
        const savedVData = (row.verification_data as { data?: Record<string, string> } | null)?.data;
        if ((row.is_verified ?? row.verified) && savedVData?.name) {
          setVerifyResult({ status: "success", data: savedVData });
        }
      })
      .catch(() => undefined);
  }, [canEdit, user?.full_name]);

  useEffect(() => {
    if (barId === loadedBarId) return;
    setVerifyResult(null);
    setShowStatePicker(false);
  }, [barId, loadedBarId]);

  if (!canEdit) return null;

  async function handleSave() {
    setSaving(true);
    try {
      await upsertMyLawyerListing({
        full_name: fullName.trim() || user?.full_name,
        city: city.trim(),
        bar_council_id: barId.trim() || null,
        hourly_rate: rate ? Number(rate) : null,
        years_experience: Number(years) || 0,
        practice_areas: areas,
        jurisdictions,
        languages: languages.split(",").map((s) => s.trim()).filter(Boolean),
        bio: bio.trim(),
      });
      toast({
        title: "Profile saved",
        description: isComplete
          ? "AI summary will be generated shortly — your listing is now indexable."
          : `Complete all ${COMPLETION_CHECKS.length} fields to enable AI matching.`,
        variant: isComplete ? "success" : "default",
      });
      onSaved?.();
    } catch (err) {
      toast({
        title: "Could not save profile",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify() {
    if (!barId.trim()) return;
    const state = verifyState || detectBarCouncilState(barId);
    if (!state) {
      setShowStatePicker(true);
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await verifyMyEnrollment(barId.trim(), state);
      setVerified(result.is_verified);
      setVerifyResult({ status: result.status, data: result.data });
      if (result.status === "success") {
        toast({
          title: `Verified — ${result.data?.name ?? "enrollment confirmed"}`,
          variant: "success",
        });
      } else {
        toast({ title: "Not found on bar council records", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verification failed. Try again later.", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white/55 p-5 dark:border-white/[0.08] dark:bg-white/[0.035]">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold tracking-tight">My profile</p>
          <p className={cn(
            "mt-0.5 flex items-center gap-1 text-[11px]",
            verified ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}>
            {verified && <BadgeCheck className="h-3 w-3 shrink-0" />}
            {verified
              ? "Bar council verified — visible in search results"
              : "Verify your bar council enrollment to appear in search"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            isComplete
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
          )}
        >
          {completion.count}/{COMPLETION_CHECKS.length} complete
        </span>
      </div>

      {/* Completion bar */}
      <div className="mb-5 space-y-2">
        <div className="flex gap-1">
          {completion.checks.map((c) => (
            <div
              key={c.label}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                c.done
                  ? "bg-emerald-500"
                  : "bg-black/[0.08] dark:bg-white/10",
              )}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {completion.checks.map((c) => (
            <span
              key={c.label}
              className="flex items-center gap-1 text-[11px] text-muted-foreground"
            >
              {c.done ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <Circle className="h-3 w-3 opacity-40" />
              )}
              {c.label}
            </span>
          ))}
        </div>
        {isComplete && (
          <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Profile complete — your listing will be indexed for AI matching
          </p>
        )}
      </div>

      {/* Form fields */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Display name">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-9 rounded-xl"
          />
        </Field>

        <Field label="City">
          <Select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-11 rounded-xl text-[13px] sm:h-9"
            aria-label="City"
            placeholder="Select city"
          >
            <option value="">Select city</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Bar council ID">
          <div className="flex gap-2">
            <Input
              value={barId}
              onChange={(e) => setBarId(e.target.value)}
              placeholder="e.g. UP1234/25, D/105/2005"
              className="h-9 flex-1 rounded-xl"
            />
            <button
              type="button"
              disabled={!barId.trim() || verifying}
              onClick={() => void handleVerify()}
              className={cn(
                "shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
                verifyResult?.status === "success"
                  ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950 dark:text-emerald-400"
                  : "border-black/[0.08] bg-black/[0.02] text-muted-foreground hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.02]",
              )}
            >
              {verifying ? "Verifying…" : verifyResult?.status === "success" ? "✓ Verified" : "Verify"}
            </button>
          </div>

          {showStatePicker && (
            <div className="mt-2 flex items-center gap-2">
              <select
                value={verifyState}
                onChange={(e) => setVerifyState(e.target.value)}
                className="flex-1 rounded-xl border border-black/[0.08] bg-white px-3 py-1.5 text-sm text-foreground dark:border-white/10 dark:bg-zinc-900"
              >
                <option value="">Select your state bar council</option>
                {SUPPORTED_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!verifyState || verifying}
                onClick={() => void handleVerify()}
                className="rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-1.5 text-xs font-semibold disabled:opacity-40 hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.02]"
              >
                {verifying ? "Verifying…" : "Verify"}
              </button>
            </div>
          )}

          {verifyResult?.status === "success" && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {verifyResult.data?.name ?? "Enrollment verified"}
              </span>
              {verifyResult.data?.state && (
                <span className="text-xs text-muted-foreground">· {verifyResult.data.state}</span>
              )}
            </div>
          )}
          {verifyResult?.status === "failed" && (
            <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              Not found on bar council records
            </p>
          )}
        </Field>

        <Field label="Hourly rate (INR)">
          <Input
            type="number"
            min={0}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="h-9 rounded-xl"
          />
        </Field>

        <Field label="Years of experience *">
          <Input
            type="number"
            min={0}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className="h-9 rounded-xl"
          />
        </Field>

        <Field label="Languages">
          <Input
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            className="h-9 rounded-xl"
          />
        </Field>

        {/* Practice areas */}
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Practice areas *
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRACTICE_AREAS.map((area) => {
              const on = areas.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() =>
                    setAreas((prev) =>
                      on ? prev.filter((a) => a !== area) : [...prev, area],
                    )
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    on
                      ? "border-slate-400/60 bg-slate-100 dark:border-white/25 dark:bg-white/15"
                      : "border-black/[0.08] text-muted-foreground dark:border-white/10",
                  )}
                >
                  {area}
                </button>
              );
            })}
          </div>
        </div>

        {/* Jurisdictions */}
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Jurisdictions *
          </p>
          <div className="flex flex-wrap gap-1.5">
            {JURISDICTIONS.map((j) => {
              const on = jurisdictions.includes(j);
              return (
                <button
                  key={j}
                  type="button"
                  onClick={() =>
                    setJurisdictions((prev) =>
                      on ? prev.filter((x) => x !== j) : [...prev, j],
                    )
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    on
                      ? "border-slate-400/60 bg-slate-100 dark:border-white/25 dark:bg-white/15"
                      : "border-black/[0.08] text-muted-foreground dark:border-white/10",
                  )}
                >
                  {j}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bio */}
        <div className="sm:col-span-2">
          <Field label="Bio * (min 50 chars for AI matching)">
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="rounded-xl text-[13px]"
            />
          </Field>
          {bio.trim().length > 0 && bio.trim().length < 50 && (
            <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
              {50 - bio.trim().length} more characters needed
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          <Button
            type="button"
            className="h-9 rounded-xl"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
