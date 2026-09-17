"use client";

import { Suspense, useEffect, useState } from "react";
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
import { AnalyticsEvents, track, utmAsAnalyticsParams } from "@/lib/analytics";
import { login, probeAuthService, setSession, syncAdvocateListing } from "@/lib/api";
import { isGoogleAuthEnabled } from "@/lib/auth/google-flow";
import { useTranslation } from "@/lib/i18n";
import { loginRedirectForUser } from "@/lib/permissions";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session-expired";
  const nextPath = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [authOffline, setAuthOffline] = useState(false);
  const googleEnabled = isGoogleAuthEnabled();
  const { t } = useTranslation();

  useEffect(() => {
    void probeAuthService().then((ok) => setAuthOffline(!ok));
  }, []);

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: async (auth) => {
      track(AnalyticsEvents.LOGIN_COMPLETED, {
        authentication_method: "email",
        account_type: auth.user.roles?.[0] ?? "citizen",
        ...utmAsAnalyticsParams(),
      });
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
      title={t("auth.welcomeBack")}
      subtitle={t("auth.signInToAccount")}
      footer={
        <>
          {t("auth.dontHaveAccount")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("auth.createOne")}
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
        className="space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          setGoogleError(null);
          track(AnalyticsEvents.LOGIN_STARTED, { authentication_method: "email" });
          mutation.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            required
            autoComplete="email"
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-11 rounded-xl"
          />
        </div>

        {sessionExpired && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            {t("auth.sessionExpired")}
          </p>
        )}
        {authOffline && process.env.NODE_ENV === "development" && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            Auth service is offline. From the project root run: make native
          </p>
        )}
        {displayError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {displayError}
          </p>
        )}

        <Button type="submit" className="mt-1 h-11 w-full rounded-xl" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? t("auth.signingIn") : t("auth.signIn")}
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
