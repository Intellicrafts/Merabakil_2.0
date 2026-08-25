"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthLayout } from "@/components/auth/auth-layout";
import { GoogleOneTapPrompt } from "@/components/auth/google-one-tap-prompt";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, setSession, syncAdvocateListing } from "@/lib/api";
import { isGoogleAuthEnabled } from "@/lib/auth/google-flow";
import { loginRedirectForUser } from "@/lib/permissions";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session-expired";
  const nextPath = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleError, setGoogleError] = useState<string | null>(null);
  const googleEnabled = isGoogleAuthEnabled();

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: async (auth) => {
      setSession(auth);
      await syncAdvocateListing();
      if (nextPath && nextPath.startsWith("/")) {
        router.push(nextPath);
        return;
      }
      router.push(loginRedirectForUser(auth.user));
    },
  });

  const displayError = googleError || (mutation.isError ? (mutation.error as Error).message : null);

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your AI Legal OS account"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {googleEnabled ? <GoogleOneTapPrompt /> : null}
      <SocialLoginButtons
        nextPath={nextPath}
        disabled={mutation.isPending}
        onError={(message) => setGoogleError(message)}
      />
      <AuthDivider />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setGoogleError(null);
          mutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {sessionExpired && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            Your session expired. Please sign in again to continue.
          </p>
        )}
        {displayError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {displayError}
          </p>
        )}

        <Button type="submit" className="w-full rounded-xl" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
