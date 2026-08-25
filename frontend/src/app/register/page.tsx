"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Briefcase, Building2, Scale, Users } from "lucide-react";

import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register, setSession, syncAdvocateListing } from "@/lib/api";
import { loginRedirectForUser } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const ROLES = [
  {
    id: "citizen",
    label: "Citizen",
    description: "I need legal guidance or help finding a lawyer",
    icon: Users,
  },
  {
    id: "advocate",
    label: "Advocate",
    description: "I'm a practising lawyer or independent advocate",
    icon: Scale,
  },
  {
    id: "law_firm",
    label: "Law Firm",
    description: "I represent a law firm or chambers",
    icon: Briefcase,
  },
  {
    id: "enterprise",
    label: "Enterprise",
    description: "I'm from a company or organisation",
    icon: Building2,
  },
] as const;

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
      subtitle="Join MeraBakil — choose the role that fits you"
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
            placeholder="Your full name"
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
          <Label>I am a</Label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(({ id, label, description, icon: Icon }) => {
              const selected = role === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRole(id)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    selected
                      ? "border-primary/40 bg-primary/[0.06] ring-1 ring-primary/20"
                      : "border-black/[0.08] bg-white hover:border-black/[0.14] hover:bg-slate-50 dark:border-white/[0.10] dark:bg-zinc-800 dark:hover:border-white/[0.18]",
                  )}
                  aria-pressed={selected}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-black/[0.06] text-muted-foreground dark:bg-white/[0.10]",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className={cn("text-[13px] font-semibold", selected && "text-primary")}>
                      {label}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
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
