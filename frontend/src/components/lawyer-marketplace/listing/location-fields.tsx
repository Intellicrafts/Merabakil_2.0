"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { FIELD_ERROR_BORDER, FormField, fieldProps } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { highCourtsForState } from "@/lib/courts";
import { INDIAN_STATES } from "@/lib/indian-states";
import { JURISDICTIONS } from "@/lib/mock/lawyers";
import { cn } from "@/lib/utils";

import { PINCODE_RE, type SectionProps } from "./listing-form";

type Lookup =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; district: string; state: string }
  | { status: "not_found" }
  | { status: "unavailable" };

const LOOKUP_TIMEOUT_MS = 5000;

/** India Post: 6-digit pincode → district and state. */
async function lookupPincode(pincode: string, signal: AbortSignal): Promise<Lookup> {
  const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal });
  if (!res.ok) return { status: "unavailable" };
  const [body] = (await res.json()) as [{ Status: string; PostOffice?: { State: string; District: string }[] }];
  const office = body?.Status === "Success" ? body.PostOffice?.[0] : undefined;
  return office ? { status: "found", district: office.District, state: office.State } : { status: "not_found" };
}

/** Office pincode, city and state. The state decides which Bar Council checks the enrolment. */
export function LocationFields({
  form,
  errors,
  onChange,
  disabled,
  onLookupFailed,
}: SectionProps & { onLookupFailed?: () => void }) {
  const [lookup, setLookup] = useState<Lookup>({ status: "idle" });
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  // Courts chosen while the lookup was in flight must not be replaced.
  const courtsRef = useRef(form.courts);
  courtsRef.current = form.courts;

  async function handlePincode(raw: string) {
    const pincode = raw.replace(/\D/g, "").slice(0, 6);
    onChange("pincode", pincode);
    requestRef.current?.abort();
    if (!PINCODE_RE.test(pincode)) {
      setLookup({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    setLookup({ status: "loading" });
    try {
      const result = await lookupPincode(pincode, controller.signal);
      if (requestRef.current !== controller) return; // a newer pincode was typed
      setLookup(result);
      if (result.status === "found") {
        onChange("city", result.district);
        onChange("state", result.state);
        // Preselect the state's High Court only when no court is chosen yet.
        if (courtsRef.current.length === 0) {
          const courts = highCourtsForState(result.state).filter((c) => (JURISDICTIONS as readonly string[]).includes(c));
          if (courts.length) onChange("courts", courts);
        }
      } else {
        onLookupFailed?.();
      }
    } catch {
      if (requestRef.current !== controller) return;
      setLookup({ status: "unavailable" });
      onLookupFailed?.();
    } finally {
      clearTimeout(timer);
    }
  }

  const stateOptions =
    form.state && !(INDIAN_STATES as readonly string[]).includes(form.state)
      ? [form.state, ...INDIAN_STATES]
      : INDIAN_STATES;

  const pincodeStatus =
    lookup.status === "loading" ? (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Looking up your pincode…
      </span>
    ) : lookup.status === "found" ? (
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" aria-hidden /> {lookup.district}, {lookup.state}
      </span>
    ) : lookup.status === "not_found" ? (
      "We couldn't find this pincode — check the digits, or enter your city and state."
    ) : lookup.status === "unavailable" ? (
      "We couldn't look up this pincode right now — enter your city and state."
    ) : (
      "Of your office or chamber. Its state decides which Bar Council checks your enrolment."
    );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <FormField id="listing-pincode" label="Office pincode" hint={pincodeStatus} error={errors.pincode}>
        <Input
          {...fieldProps("listing-pincode", { error: errors.pincode, hint: true })}
          value={form.pincode}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="6 digits"
          onChange={(e) => void handlePincode(e.target.value)}
          className={cn("h-11 rounded-xl tracking-widest", errors.pincode && FIELD_ERROR_BORDER)}
        />
      </FormField>
      <FormField id="listing-city" label="City" error={errors.city}>
        <Input
          {...fieldProps("listing-city", { error: errors.city })}
          value={form.city}
          disabled={disabled}
          autoComplete="address-level2"
          onChange={(e) => onChange("city", e.target.value)}
          className={cn("h-11 rounded-xl", errors.city && FIELD_ERROR_BORDER)}
        />
      </FormField>
      <FormField id="listing-state" label="State" error={errors.state}>
        <select
          {...fieldProps("listing-state", { error: errors.state })}
          value={form.state}
          disabled={disabled}
          onChange={(e) => onChange("state", e.target.value)}
          className={cn(
            "h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground",
            errors.state && FIELD_ERROR_BORDER,
          )}
        >
          <option value="">Choose your state</option>
          {stateOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  );
}
