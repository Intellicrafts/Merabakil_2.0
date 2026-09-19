"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, Circle } from "lucide-react";

import { ProfileSectionCard } from "@/components/profile/profile-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  getMyLawyerListing,
  getStoredUser,
  upsertMyLawyerListing,
  verifyMyEnrollment,
} from "@/lib/api";
import type { VerifyResult } from "@/lib/types";
import { PRACTICE_AREAS, JURISDICTIONS } from "@/lib/mock/lawyers";
import { cn } from "@/lib/utils";

const SUPPORTED_STATES = ["Uttar Pradesh", "Delhi", "Andhra Pradesh", "Rajasthan"] as const;

const FIELD_LABELS: Record<string, string> = {
  name:              "Name",
  father_name:       "Father's name",
  address:           "Address",
  district:          "District",
  enrollment_date:   "Enrolled on",
  transfer_date:     "Transfer date",
  dob:               "Date of birth",
  tr_date:           "TR date",
  mobile_no:         "Mobile",
  email:             "Email",
  degree_year:       "Degree year",
  status:            "Enrolment status",
  place_of_practice: "Place of practice",
  aibe_applicable:   "AIBE applicable",
  fake:              "Flagged as fake",
  licence_removed:   "Licence removed",
  licence_cancelled: "Licence cancelled",
};

const SKIP_FIELDS = new Set(["state", "enrollment_number"]);

function detectBarCouncilState(enrollment: string): string {
  const en = enrollment.toUpperCase().trim();
  if (en.startsWith("UP")) return "Uttar Pradesh";
  if (en.startsWith("D/")) return "Delhi";
  if (en.startsWith("AP/")) return "Andhra Pradesh";
  if (en.startsWith("R/")) return "Rajasthan";
  return "";
}

function stateToBarCouncil(apiState: string): string {
  const s = apiState.toLowerCase();
  if (s.includes("uttar pradesh"))  return "Uttar Pradesh";
  if (s.includes("delhi"))          return "Delhi";
  if (s.includes("andhra pradesh")) return "Andhra Pradesh";
  if (s.includes("rajasthan"))      return "Rajasthan";
  return "";
}

function stateToJurisdictions(apiState: string): string[] {
  const s = apiState.toLowerCase();
  if (s.includes("uttar pradesh"))                             return ["Allahabad High Court"];
  if (s.includes("uttarakhand"))                               return ["Uttarakhand High Court"];
  if (s.includes("delhi"))                                     return ["Delhi High Court"];
  if (s.includes("andhra pradesh") || s.includes("telangana")) return ["Hyderabad High Court"];
  if (s.includes("rajasthan"))                                 return ["Rajasthan High Court"];
  if (s.includes("maharashtra") || s.includes("goa"))          return ["Bombay High Court"];
  if (s.includes("karnataka"))                                 return ["Karnataka High Court"];
  if (s.includes("tamil nadu") || s.includes("puducherry"))    return ["Madras High Court"];
  if (s.includes("west bengal") || s.includes("andaman"))      return ["Calcutta High Court"];
  if (s.includes("kerala") || s.includes("lakshadweep"))       return ["Kerala High Court"];
  if (s.includes("gujarat") || s.includes("dadra"))            return ["Gujarat High Court"];
  if (s.includes("punjab") || s.includes("haryana") || s.includes("chandigarh")) return ["Punjab and Haryana High Court"];
  if (s.includes("himachal"))                                  return ["Himachal Pradesh High Court"];
  if (s.includes("bihar") || s.includes("jharkhand"))          return ["Patna High Court"];
  if (s.includes("madhya pradesh") || s.includes("chhattisgarh")) return ["Madhya Pradesh High Court"];
  if (s.includes("odisha") || s.includes("orissa"))            return ["Orissa High Court"];
  if (s.includes("assam") || s.includes("manipur") || s.includes("meghalaya") ||
      s.includes("nagaland") || s.includes("mizoram") || s.includes("arunachal") ||
      s.includes("tripura") || s.includes("sikkim"))           return ["Gauhati High Court"];
  if (s.includes("jammu") || s.includes("kashmir") || s.includes("ladakh")) return ["Jammu & Kashmir and Ladakh High Court"];
  return [];
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
      { label: "Practice areas",  done: areas.length > 0 },
      { label: "Experience",      done: Number(years) > 0 },
      { label: "Bio (50+ chars)", done: bio.trim().length >= 50 },
      { label: "Jurisdictions",   done: jurisdictions.length > 0 },
    ];
    return { checks, count: checks.filter((c) => c.done).length };
  }, [areas, years, bio, jurisdictions]);
}

export function MyListingEditor({ onSaved }: MyListingEditorProps) {
  const { toast } = useToast();
  const user = getStoredUser();
  const canEdit = Boolean(user?.roles.includes("advocate"));

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  const [pincode, setPincode] = useState("");
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeInfo, setPincodeInfo] = useState<{ state: string; district: string } | null>(null);

  const completion = useCompletion(areas, years, bio, jurisdictions);
  const isComplete = completion.count === COMPLETION_CHECKS.length;

  const sortedJurisdictions = useMemo(() => {
    if (!pincodeInfo) return JURISDICTIONS as unknown as string[];
    const primary = stateToJurisdictions(pincodeInfo.state);
    return [
      ...primary.filter((j) => (JURISDICTIONS as readonly string[]).includes(j)),
      ...(JURISDICTIONS as readonly string[]).filter((j) => !primary.includes(j)),
    ];
  }, [pincodeInfo]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const row = await getMyLawyerListing();
      setFullName(row.full_name || user?.full_name || "");
      setCity(row.city || "");
      const bar = row.bar_council_id || "";
      setBarId(bar);
      setLoadedBarId(bar);
      setRate(row.hourly_rate != null ? String(row.hourly_rate) : "");
      setYears(String(row.years_experience ?? 0));
      setAreas(row.practice_areas ?? []);
      setJurisdictions(row.jurisdictions ?? []);
      setLanguages((row.languages ?? []).join(", ") || "English, Hindi");
      setBio(row.bio || "");
      const isV = Boolean(row.is_verified ?? row.verified);
      setVerified(isV);
      setVerifyState(detectBarCouncilState(bar));
      const savedVData = (row.verification_data as { data?: Record<string, string> } | null)?.data;
      if (isV && savedVData?.name) {
        setVerifyResult({ status: "success", data: savedVData });
      }
    } catch {
      setLoadError("Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }, [user?.full_name]);

  useEffect(() => {
    if (!canEdit) return;
    void loadProfile();
  }, [canEdit, loadProfile]);

  useEffect(() => {
    if (barId === loadedBarId) return;
    setVerifyResult(null);
    setShowStatePicker(false);
  }, [barId, loadedBarId]);

  if (!canEdit) return null;

  if (loading) {
    return (
      <div className="space-y-4">
        <ProfileSectionCard>
          <div className="animate-pulse space-y-3">
            <div className="h-3.5 w-1/3 rounded-lg bg-black/[0.05] dark:bg-white/[0.07]" />
            <div className="h-1.5 rounded-full bg-black/[0.05] dark:bg-white/[0.07]" />
            <div className="flex gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-3 w-16 rounded bg-black/[0.05] dark:bg-white/[0.07]" />
              ))}
            </div>
          </div>
        </ProfileSectionCard>
        <ProfileSectionCard>
          <div className="animate-pulse grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-1/3 rounded bg-black/[0.05] dark:bg-white/[0.07]" />
                <div className="h-11 rounded-xl bg-black/[0.05] dark:bg-white/[0.07]" />
              </div>
            ))}
          </div>
        </ProfileSectionCard>
        <ProfileSectionCard>
          <div className="animate-pulse space-y-3">
            <div className="h-3 w-1/4 rounded bg-black/[0.05] dark:bg-white/[0.07]" />
            <div className="h-11 rounded-xl bg-black/[0.05] dark:bg-white/[0.07]" />
          </div>
        </ProfileSectionCard>
      </div>
    );
  }

  if (loadError) {
    return (
      <ProfileSectionCard>
        <p className="text-[13px] text-destructive">{loadError}</p>
        <Button
          type="button"
          variant="ghost"
          className="mt-3 h-10 rounded-xl"
          onClick={() => void loadProfile()}
        >
          Try again
        </Button>
      </ProfileSectionCard>
    );
  }

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
          : `Complete all ${COMPLETION_CHECKS.length} sections to enable AI matching.`,
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

  async function handlePincodeLookup(value: string) {
    if (value.length !== 6 || !/^\d{6}$/.test(value)) {
      setPincodeInfo(null);
      return;
    }
    setPincodeLoading(true);
    setPincodeInfo(null);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${value}`);
      const [json] = (await res.json()) as [
        { Status: string; PostOffice?: { State: string; District: string }[] },
      ];
      if (json.Status === "Success" && json.PostOffice?.length) {
        const po = json.PostOffice[0];
        setPincodeInfo({ state: po.State, district: po.District });
        setCity(po.District);
        const barState = stateToBarCouncil(po.State);
        if (barState) setVerifyState(barState);
        const detectedJurisdictions = stateToJurisdictions(po.State);
        if (detectedJurisdictions.length > 0) {
          setJurisdictions((prev) => [...new Set([...detectedJurisdictions, ...prev])]);
        }
      }
    } catch {
      // silently fail — pincode is a helper, not required
    } finally {
      setPincodeLoading(false);
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
      if (result.status === "success" && result.data?.name) {
        setFullName(result.data.name);
      }
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
    <div className="space-y-4 pb-28 sm:pb-0">

      {/* ── Completion progress ─────────────────────────────── */}
      <ProfileSectionCard>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[13px] font-semibold">Profile completeness</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {isComplete
                ? "Complete — your listing is indexed for AI matching"
                : `${COMPLETION_CHECKS.length - completion.count} section${completion.count === COMPLETION_CHECKS.length - 1 ? "" : "s"} remaining`}
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
            {completion.count}/{COMPLETION_CHECKS.length}
          </span>
        </div>
        <div className="flex gap-1">
          {completion.checks.map((c) => (
            <div
              key={c.label}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                c.done ? "bg-emerald-500" : "bg-black/[0.08] dark:bg-white/10",
              )}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
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
      </ProfileSectionCard>

      {/* ── Professional details ────────────────────────────── */}
      <ProfileSectionCard title="Professional details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="adv-name">
            <Input
              id="adv-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 rounded-xl"
              autoComplete="name"
            />
          </Field>

          <Field label="City" htmlFor="adv-city">
            <Input
              id="adv-city"
              value={city}
              readOnly
              placeholder="Enter pincode to auto-fill"
              className="h-11 cursor-default rounded-xl bg-black/[0.02] text-muted-foreground dark:bg-white/[0.03]"
            />
          </Field>

          <Field label="Hourly rate (INR)" htmlFor="adv-rate">
            <Input
              id="adv-rate"
              type="number"
              min={0}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>

          <Field label="Pincode" htmlFor="adv-pincode">
            <div className="relative">
              <Input
                id="adv-pincode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setPincode(v);
                  void handlePincodeLookup(v);
                }}
                placeholder="6-digit pincode"
                className="h-11 rounded-xl pr-8"
              />
              {pincodeLoading && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                  …
                </span>
              )}
            </div>
            {pincodeInfo && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {pincodeInfo.district} · {pincodeInfo.state}
                {stateToBarCouncil(pincodeInfo.state) && (
                  <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                    · Bar council state set
                  </span>
                )}
              </p>
            )}
          </Field>

          <Field label="Years of experience *" htmlFor="adv-years">
            <Input
              id="adv-years"
              type="number"
              min={0}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Languages" htmlFor="adv-languages">
              <Input
                id="adv-languages"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                className="h-11 rounded-xl"
              />
            </Field>
          </div>
        </div>
      </ProfileSectionCard>

      {/* ── Bar council verification ────────────────────────── */}
      <ProfileSectionCard>
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">Bar council verification</p>
            <p
              className={cn(
                "mt-0.5 flex items-center gap-1 text-[11px]",
                verified
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground",
              )}
            >
              {verified && <BadgeCheck className="h-3 w-3 shrink-0" />}
              {verified
                ? "Verified — visible in search results"
                : "Verify your enrollment number to appear in search"}
            </p>
          </div>
        </div>

        <Field label="Enrollment number" htmlFor="adv-bar-id">
          <div className="flex gap-2">
            <Input
              id="adv-bar-id"
              value={barId}
              onChange={(e) => setBarId(e.target.value)}
              placeholder="e.g. UP1234/25, D/105/2005"
              className="h-11 flex-1 rounded-xl"
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
                className="flex-1 rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-sm text-foreground dark:border-white/10 dark:bg-zinc-900"
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
                className="rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2.5 text-xs font-semibold disabled:opacity-40 hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.02]"
              >
                {verifying ? "Verifying…" : "Verify"}
              </button>
            </div>
          )}

          {verifyResult?.status === "success" && verifyResult.data && (
            <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-3 dark:border-emerald-500/15 dark:bg-emerald-900/10">
              <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                Details from {verifyResult.data.state ?? "bar council"} registry — confirm these match your records
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                {Object.entries(verifyResult.data)
                  .filter(([k, v]) => !SKIP_FIELDS.has(k) && v != null && String(v).trim() !== "")
                  .map(([k, v]) => (
                    <Fragment key={k}>
                      <dt className="whitespace-nowrap text-[11px] text-muted-foreground">
                        {FIELD_LABELS[k] ?? k}
                      </dt>
                      <dd className="text-[11px] font-medium">{v}</dd>
                    </Fragment>
                  ))}
              </dl>
            </div>
          )}
          {verifyResult?.status === "failed" && (
            <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              Not found on bar council records
            </p>
          )}
        </Field>
      </ProfileSectionCard>

      {/* ── Expertise ───────────────────────────────────────── */}
      <ProfileSectionCard title="Expertise">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[12px] font-medium text-muted-foreground">Practice areas *</p>
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

          <div>
            <p className="mb-2 text-[12px] font-medium text-muted-foreground">Jurisdictions *</p>
            <div className="flex flex-wrap gap-1.5">
              {sortedJurisdictions.map((j) => {
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

          <Field label="Bio * (min 50 chars for AI matching)" htmlFor="adv-bio">
            <Textarea
              id="adv-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="rounded-xl text-[13px]"
            />
            {bio.trim().length > 0 && bio.trim().length < 50 && (
              <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                {50 - bio.trim().length} more characters needed
              </p>
            )}
          </Field>
        </div>
      </ProfileSectionCard>

      {/* ── Save — sticky on mobile, inline on desktop ──────── */}
      <div className="mp-profile-sticky-footer sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <Button
          type="button"
          className="mp-btn-accent h-11 w-full rounded-xl text-[13px] font-semibold sm:w-auto sm:min-w-[10rem]"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mp-profile-field">
      <Label htmlFor={htmlFor} className="text-[12px] font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
