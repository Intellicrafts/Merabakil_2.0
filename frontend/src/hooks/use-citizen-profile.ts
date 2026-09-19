"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getCitizenProfile, getStoredUser, updateCitizenProfile, updateStoredUser } from "@/lib/api";
import type { CitizenProfile, CitizenProfileInput } from "@/lib/types";

export interface CitizenProfileFormState {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  address: string;
}

function toFormState(profile: CitizenProfile): CitizenProfileFormState {
  return {
    full_name: profile.full_name ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    date_of_birth: profile.date_of_birth ?? "",
    address: profile.address ?? "",
  };
}

function toPayload(form: CitizenProfileFormState): CitizenProfileInput {
  return {
    full_name: form.full_name.trim(),
    phone: form.phone.trim() || null,
    date_of_birth: form.date_of_birth || null,
    address: form.address.trim() || null,
  };
}

export function profilesEqual(a: CitizenProfileFormState, b: CitizenProfileFormState): boolean {
  return (
    a.full_name.trim() === b.full_name.trim() &&
    a.phone.trim() === b.phone.trim() &&
    a.date_of_birth === b.date_of_birth &&
    a.address.trim() === b.address.trim()
  );
}

function initialFormFromStored(): CitizenProfileFormState {
  const stored = getStoredUser();
  return {
    full_name: stored?.full_name ?? "",
    email: stored?.email ?? "",
    phone: "",
    date_of_birth: "",
    address: "",
  };
}

export function useCitizenProfile(enabled = true) {
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CitizenProfile | null>(null);
  const [baseline, setBaseline] = useState<CitizenProfileFormState | null>(null);
  const [form, setForm] = useState<CitizenProfileFormState>(initialFormFromStored);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const data = await getCitizenProfile();
      const nextForm = toFormState(data);
      setProfile(data);
      setBaseline(nextForm);
      setForm(nextForm);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load profile");
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  const isDirty = useMemo(() => {
    if (!baseline) return false;
    return !profilesEqual(form, baseline);
  }, [form, baseline]);

  const setField = useCallback(
    <K extends keyof CitizenProfileFormState>(key: K, value: CitizenProfileFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateProfile = useCallback(async () => {
    if (!form.full_name.trim()) {
      throw new Error("Please enter your name");
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCitizenProfile(toPayload(form));
      const nextForm = toFormState(updated);
      setProfile(updated);
      setBaseline(nextForm);
      setForm(nextForm);
      updateStoredUser({ full_name: updated.full_name, avatar_url: updated.avatar_url ?? null });
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update profile";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [form]);

  return {
    loading,
    saving,
    error,
    profile,
    form,
    isDirty,
    setField,
    refresh,
    updateProfile,
  };
}
