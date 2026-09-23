"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Scale, Users } from "lucide-react";

import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthLayout } from "@/components/auth/auth-layout";
import { EmailOtpStep } from "@/components/auth/email-otp-step";
import { RegisterStepIndicator } from "@/components/auth/register-step-indicator";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { TermsConsentCheckbox } from "@/components/legal/terms-consent-checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acquisitionPayload, AnalyticsEvents, track, utmAsAnalyticsParams } from "@/lib/analytics";
import { register, sendOtp, setSession, syncAdvocateListing, verifyRegisterOtp } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { loginRedirectForUser } from "@/lib/permissions";
import { LEGAL_VERSIONS } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

const ROLES = [
  {
    id: "citizen",
    labelKey: "auth.citizen" as const,
    descriptionKey: "auth.citizenDesc" as const,
    icon: Users,
  },
  {
    id: "advocate",
    labelKey: "auth.advocate" as const,
    descriptionKey: "auth.advocateDesc" as const,
    icon: Scale,
  },
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const { t } = useTranslation();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("citizen");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const sendOtpMutation = useMutation({
    mutationFn: () => sendOtp(email.trim(), "register"),
    onSuccess: () => {
      setStepError(null);
      setOtp("");
      setVerificationToken(null);
      setStep(2);
    },
    onError: (error: Error) => setStepError(error.message),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: () => verifyRegisterOtp(email.trim(), otp),
    onSuccess: (result) => {
      setStepError(null);
      setVerificationToken(result.verification_token);
      setStep(3);
    },
    onError: (error: Error) => setStepError(error.message),
  });

  const registerMutation = useMutation({
    mutationFn: () =>
      register(
        email.trim(),
        fullName || email.split("@")[0],
        password,
        role,
        verificationToken!,
        { terms_version: LEGAL_VERSIONS.terms, privacy_version: LEGAL_VERSIONS.privacy },
        acquisitionPayload(),
      ),
    onSuccess: async (auth) => {
      track(AnalyticsEvents.SIGNUP_COMPLETED, {
        signup_method: "email",
        account_type: role,
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

  const displayError =
    googleError ||
    stepError ||
    (registerMutation.isError ? (registerMutation.error as Error).message : null);

  const handleSendCode = () => {
    setGoogleError(null);
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setStepError(t("auth.invalidEmail"));
      return;
    }
    track(AnalyticsEvents.SIGNUP_STARTED, { signup_method: "email", account_type: role });
    sendOtpMutation.mutate();
  };

  const stepLabels: [string, string, string] = [
    t("auth.stepEmail"),
    t("auth.stepVerify"),
    t("auth.stepDetails"),
  ];

  return (
    <AuthLayout
      title={t("auth.createYourAccount")}
      subtitle={step === 1 ? t("auth.verifyEmailDesc") : t("auth.joinMeraBakil")}
      footer={
        <>
          {t("auth.alreadyHaveAccount")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("auth.signIn")}
          </Link>
        </>
      }
    >
      <RegisterStepIndicator currentStep={step} labels={stepLabels} />

      {step === 1 ? (
        <>
          <SocialLoginButtons
            nextPath={nextPath}
            disabled={sendOtpMutation.isPending}
            onError={(message) => setGoogleError(message)}
          />
          <AuthDivider />

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setStepError(null);
                }}
                placeholder={t("auth.emailPlaceholder")}
                required
                autoComplete="email"
                className="h-11 rounded-xl"
              />
            </div>

            {displayError && (
              <div className="space-y-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <p>{displayError}</p>
                {displayError.toLowerCase().includes("already exists") && (
                  <p>
                    <Link href="/login" className="font-medium underline underline-offset-2">
                      {t("auth.signIn")}
                    </Link>
                  </p>
                )}
              </div>
            )}

            <Button
              type="button"
              className="h-11 w-full rounded-xl"
              size="lg"
              disabled={sendOtpMutation.isPending || !email.trim()}
              onClick={handleSendCode}
            >
              {sendOtpMutation.isPending ? t("auth.sendingCode") : t("auth.sendVerificationCode")}
            </Button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <EmailOtpStep
          email={email.trim()}
          otp={otp}
          onOtpChange={(value) => {
            setOtp(value);
            setStepError(null);
          }}
          onVerify={() => verifyOtpMutation.mutate()}
          onResend={() => sendOtpMutation.mutate()}
          onChangeEmail={() => {
            setStep(1);
            setOtp("");
            setStepError(null);
          }}
          verifying={verifyOtpMutation.isPending}
          resending={sendOtpMutation.isPending}
          verified={Boolean(verificationToken)}
          error={displayError}
        />
      ) : null}

      {step === 3 ? (
        <form
          className="space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            setGoogleError(null);
            setStepError(null);
            track(AnalyticsEvents.ONBOARDING_STARTED, { signup_method: "email" });
            registerMutation.mutate();
          }}
        >
          <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {t("auth.emailVerified")} <span className="font-medium">{email.trim()}</span>
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="full_name">{t("auth.fullName")}</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("auth.iAm")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(({ id, labelKey, descriptionKey, icon: Icon }) => {
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
                        {t(labelKey)}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {t(descriptionKey)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <TermsConsentCheckbox
            checked={termsAccepted}
            onChange={setTermsAccepted}
            disabled={registerMutation.isPending}
          />

          {displayError && (
            <div className="space-y-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p>{displayError}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => setStep(2)}
              disabled={registerMutation.isPending}
            >
              {t("common.back")}
            </Button>
            <Button
              type="submit"
              className="h-11 flex-1 rounded-xl"
              size="lg"
              disabled={registerMutation.isPending || !termsAccepted || !verificationToken}
            >
              {registerMutation.isPending ? t("auth.creatingAccount") : t("auth.createAccount")}
            </Button>
          </div>
        </form>
      ) : null}
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
