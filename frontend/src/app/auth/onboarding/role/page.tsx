"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { AuthLayout } from "@/components/auth/auth-layout";
import { RolePicker, type AccountRole } from "@/components/auth/role-picker";
import { Button } from "@/components/ui/button";
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
    if (!readGoogleOnboarding()) {
      router.replace("/register");
    } else {
      setContext(readGoogleOnboarding());
    }
  }, [router]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!context?.onboarding_token) {
        throw new Error("Your Google sign-in session expired. Please try again.");
      }
      return completeGoogleOnboarding(context.onboarding_token, role, router, nextPath);
    },
  });

  if (!context) {
    return null;
  }

  return (
    <AuthLayout
      title="Choose your account type"
      subtitle="Select how you'll use MeraBakil — you can update your profile details later"
    >
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-black/[0.08] bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.05]">
        {context.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={context.picture}
            alt=""
            className="h-12 w-12 rounded-full border border-black/10 object-cover dark:border-white/10"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {context.full_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{context.full_name}</p>
          <p className="truncate text-sm text-muted-foreground">{context.email}</p>
        </div>
      </div>

      <RolePicker value={role} onChange={setRole} disabled={mutation.isPending} />

      {mutation.isError && (
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(mutation.error as Error).message}
        </p>
      )}

      <div className="mt-6 space-y-3">
        <Button
          type="button"
          className="w-full rounded-xl"
          size="lg"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Creating your account…" : "Continue to dashboard"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full rounded-xl"
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
