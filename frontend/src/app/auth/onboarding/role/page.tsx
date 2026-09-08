"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { AuthLayout } from "@/components/auth/auth-layout";
import { ProfileAvatar } from "@/components/auth/profile-avatar";
import { RolePicker, type AccountRole } from "@/components/auth/role-picker";
import { Button } from "@/components/ui/button";
import { storeAvatarUrl } from "@/lib/avatar";
import {
  clearGoogleOnboarding,
  completeGoogleOnboarding,
  readGoogleOnboarding,
} from "@/lib/auth/google-flow";

function RoleOnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [role, setRole] = useState<AccountRole>("citizen");
  const [context, setContext] = useState(readGoogleOnboarding());

  useEffect(() => {
    const stored = readGoogleOnboarding();
    if (!stored) {
      router.replace("/register");
      return;
    }
    setContext(stored);
    storeAvatarUrl(stored.picture);
  }, [router]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!context?.onboarding_token) {
        throw new Error("Your Google sign-in session expired. Please try again.");
      }
      storeAvatarUrl(context.picture);
      return completeGoogleOnboarding(context.onboarding_token, role, router, nextPath);
    },
  });

  if (!context) {
    return null;
  }

  return (
    <AuthLayout
      title="Choose your account type"
      subtitle="Tell us how you'll use MeraBakil. You can refine your profile later."
    >
      <div className="mb-5 flex items-center gap-3.5 rounded-2xl border border-black/[0.07] bg-slate-50/80 px-3.5 py-3 dark:border-white/10 dark:bg-white/[0.04]">
        <ProfileAvatar src={context.picture} name={context.full_name} className="h-14 w-14" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Signing in with Google
          </p>
          <p className="truncate text-[15px] font-semibold text-foreground">{context.full_name}</p>
          <p className="truncate text-sm text-muted-foreground">{context.email}</p>
        </div>
      </div>

      <RolePicker value={role} onChange={setRole} disabled={mutation.isPending} />

      {mutation.isError && (
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(mutation.error as Error).message}
        </p>
      )}

      <div className="mt-5 space-y-2">
        <Button
          type="button"
          className="h-11 w-full rounded-xl"
          size="lg"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Creating your account…" : "Continue to dashboard"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full rounded-xl"
          disabled={mutation.isPending}
          onClick={() => {
            clearGoogleOnboarding();
            router.push("/login");
          }}
        >
          Cancel and return to sign in
        </Button>
      </div>
    </AuthLayout>
  );
}

export default function RoleOnboardingPage() {
  return (
    <Suspense fallback={null}>
      <RoleOnboardingForm />
    </Suspense>
  );
}
