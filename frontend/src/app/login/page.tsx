"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Scale, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { login, register, setSession } from "@/lib/api";
import { loginRedirectForUser } from "@/lib/permissions";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const sessionExpired = searchParams.get("reason") === "session-expired";
  const nextPath = searchParams.get("next");
  const [email, setEmail] = useState("admin@legalos.in");
  const [password, setPassword] = useState("ChangeMe!2026");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("citizen");

  const mutation = useMutation({
    mutationFn: async () =>
      mode === "login"
        ? login(email, password)
        : register(email, fullName || email.split("@")[0], password, role),
    onSuccess: (auth) => {
      setSession(auth);
      if (nextPath && nextPath.startsWith("/")) {
        router.push(nextPath);
        return;
      }
      router.push(loginRedirectForUser(auth.user));
    },
  });

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_55%)]" />
      <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-20 h-72 w-72 rounded-full bg-slate-500/10 blur-3xl" />

      <Card className="relative w-full max-w-md border-border/60 shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Scale className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              AI Legal OS for India
            </CardTitle>
            <CardDescription className="flex items-center justify-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              {mode === "login" ? "Secure sign in" : "Create your account"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Advocate"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
              />
            </div>
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="citizen">Citizen</option>
                  <option value="advocate">Advocate</option>
                  <option value="law_firm">Law Firm</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
              </div>
            )}
            {sessionExpired && (
              <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                Your session expired. Please sign in again to continue.
              </p>
            )}
            {mutation.isError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {(mutation.error as Error).message}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={mutation.isPending}>
              {mutation.isPending ? "Please wait..." : mode === "login" ? "Sign in" : "Register"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "No account?" : "Already registered?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
