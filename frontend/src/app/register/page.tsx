"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { register, setSession, syncAdvocateListing } from "@/lib/api";
import { loginRedirectForUser } from "@/lib/permissions";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("citizen");
  const [googleError, setGoogleError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => register(email, fullName || email.split("@")[0], password, role),
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
      title="Create your account"
      subtitle="Join AI Legal OS — choose the role that fits you"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
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
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Advocate"
            autoComplete="name"
          />
        </div>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">I am a</Label>
          <Select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="citizen">Citizen</option>
            <option value="advocate">Advocate</option>
            <option value="law_firm">Law Firm</option>
            <option value="enterprise">Enterprise</option>
          </Select>
        </div>

        {displayError && (
          <div className="space-y-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p>{displayError}</p>
            {displayError.toLowerCase().includes("already exists") && (
              <p>
                <Link href="/login" className="font-medium underline underline-offset-2">
                  Go to sign in
                </Link>
              </p>
            )}
          </div>
        )}

        <Button type="submit" className="w-full rounded-xl" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
