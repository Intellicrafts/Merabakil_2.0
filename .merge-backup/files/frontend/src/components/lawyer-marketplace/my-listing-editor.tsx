"use client";

import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";

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
import { PRACTICE_AREAS, CITIES } from "@/lib/mock/lawyers";
import { cn } from "@/lib/utils";

interface MyListingEditorProps {
  onSaved?: () => void;
}

export function MyListingEditor({ onSaved }: MyListingEditorProps) {
  const { toast } = useToast();
  const user = getStoredUser();
  const canEdit = Boolean(user?.roles.includes("advocate"));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [city, setCity] = useState("");
  const [barId, setBarId] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("0");
  const [areas, setAreas] = useState<string[]>([]);
  const [languages, setLanguages] = useState("English, Hindi");
  const [bio, setBio] = useState("");
  const [verified, setVerified] = useState(true);

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
        setLanguages((row.languages ?? []).join(", ") || "English, Hindi");
        setBio(row.bio || row.summary || "");
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
        languages: languages
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        bio: bio.trim(),
      });
      toast({ title: "Listing updated", description: "Citizens can now book this profile.", variant: "success" });
      setOpen(false);
      onSaved?.();
    } catch (err) {
      toast({ title: "Could not save listing", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white/55 p-4 dark:border-white/[0.08] dark:bg-white/[0.035]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold tracking-tight">My listing</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {verified ? "Verified and bookable" : "Hidden until an admin re-enables verification"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-xl text-[12px]"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Edit listing"}
        </Button>
      </div>
      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Display name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9 rounded-xl" />
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
            <Input value={barId} onChange={(e) => setBarId(e.target.value)} className="h-9 rounded-xl" />
          </Field>
          <Field label="Hourly rate (INR)">
            <Input type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="h-9 rounded-xl" />
          </Field>
          <Field label="Years of experience">
            <Input type="number" min={0} value={years} onChange={(e) => setYears(e.target.value)} className="h-9 rounded-xl" />
          </Field>
          <Field label="Languages">
            <Input value={languages} onChange={(e) => setLanguages(e.target.value)} className="h-9 rounded-xl" />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Practice areas</p>
            <div className="flex flex-wrap gap-1.5">
              {PRACTICE_AREAS.map((area) => {
                const on = areas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() =>
                      setAreas((prev) => (on ? prev.filter((a) => a !== area) : [...prev, area]))
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium",
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
          <div className="sm:col-span-2">
            <Field label="Bio">
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="rounded-xl text-[13px]" />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3 sm:col-span-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5" />
              New advocates are verified by default
            </p>
            <Button type="button" className="h-9 rounded-xl" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save listing"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
