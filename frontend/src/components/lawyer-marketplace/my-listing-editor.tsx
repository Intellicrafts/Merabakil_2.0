"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  getMyLawyerListing,
  getStoredUser,
  upsertMyLawyerListing,
} from "@/lib/api";
import { PRACTICE_AREAS, CITIES, JURISDICTIONS } from "@/lib/mock/lawyers";
import { cn } from "@/lib/utils";

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
  const [verified, setVerified] = useState(true);

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
      })
      .catch(() => undefined);
  }, [canEdit, user?.full_name]);

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

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white/55 p-5 dark:border-white/[0.08] dark:bg-white/[0.035]">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold tracking-tight">My profile</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {verified
              ? "Verified and bookable"
              : "Hidden until an admin re-enables verification"}
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
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-9 w-full rounded-xl border border-black/[0.08] bg-background px-3 text-[13px] dark:border-white/10"
          >
            <option value="">Select city</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Bar council ID">
          <Input
            value={barId}
            onChange={(e) => setBarId(e.target.value)}
            className="h-9 rounded-xl"
          />
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
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <BadgeCheck className="h-3.5 w-3.5" />
            New advocates are verified by default
          </p>
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
