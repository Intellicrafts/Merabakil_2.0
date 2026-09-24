"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";

import { AuthDivider } from "@/components/auth/auth-divider";
import { EmailOtpStep } from "@/components/auth/email-otp-step";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acquisitionPayload, AnalyticsEvents, track, utmAsAnalyticsParams } from "@/lib/analytics";
import {
  register,
  sendOtp,
  setSession,
  syncAdvocateListing,
  verifyLoginOtp,
  verifyRegisterOtp,
} from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { LEGAL_VERSIONS } from "@/lib/site-metadata";
import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";

/** Where the visitor lands after auth — Saarthi auto-sends the stashed question. */
const NEXT = "/mera-vakil";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Tab = "register" | "login";
type Step = "email" | "otp" | "details";

/**
 * Inline auth for /ask: Google (primary) + a compact email OTP flow (register a
 * citizen, or sign in). On success we route to Saarthi, which auto-sends the
 * question the visitor already typed. The question + gclid/utm are already in
 * sessionStorage before this opens, so they survive the round trip.
 */
export function AskAuthSheet({
  open,
  onClose,
  title,
  subtitle,
}: {
  open: boolean;
  onClose: () => void;
  /** Optional overrides — e.g. the "you've used today's free chats" wall. */
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("register");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  function reset(nextTab: Tab) {
    setTab(nextTab);
    setStep("email");
    setOtp("");
    setVerificationToken(null);
    setPassword("");
    setError(null);
  }

  async function goToSaarthi() {
    await syncAdvocateListing().catch(() => {});
    router.push(NEXT);
  }

  async function handleSendCode() {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      track(AnalyticsEvents.SIGNUP_STARTED, { method: tab === "register" ? "email" : "email_login" });
      await sendOtp(trimmed, tab === "register" ? "register" : "login");
      setOtp("");
      setStep("otp");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setBusy(true);
    setError(null);
    try {
      if (tab === "login") {
        const auth = await verifyLoginOtp(email.trim(), otp);
        setSession(auth);
        track(AnalyticsEvents.LOGIN_COMPLETED, {
          authentication_method: "otp",
          account_type: auth.user.roles?.[0] ?? "citizen",
          ...utmAsAnalyticsParams(),
        });
        await goToSaarthi();
        return;
      }
      const result = await verifyRegisterOtp(email.trim(), otp);
      setVerificationToken(result.verification_token);
      setStep("details");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAccount() {
    if (!verificationToken) return;
    if (password.length < 8) {
      setError(t("ask.passwordHint"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const auth = await register(
        email.trim(),
        fullName.trim() || email.split("@")[0],
        password,
        "citizen",
        verificationToken,
        { terms_version: LEGAL_VERSIONS.terms, privacy_version: LEGAL_VERSIONS.privacy },
        acquisitionPayload(),
      );
      setSession(auth);
      track(AnalyticsEvents.SIGNUP_COMPLETED, {
        signup_method: "email",
        account_type: "citizen",
        ...utmAsAnalyticsParams(),
      });
      await goToSaarthi();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-auth-title"
        className="relative z-[96] w-full max-w-md rounded-t-[1.6rem] border border-black/[0.08] bg-background p-5 shadow-[0_-12px_60px_rgba(15,23,42,0.18)] dark:border-white/10 sm:rounded-[1.4rem] sm:shadow-[0_12px_60px_rgba(15,23,42,0.25)]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15 dark:bg-white/20 sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 id="ask-auth-title" className="text-[15px] font-semibold">
              {title ?? t("ask.authTitle")}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle ?? t("ask.authSubtitle")}</p>
          </div>
        </div>

        <SocialLoginButtons nextPath={NEXT} disabled={busy} onError={(m) => setError(m)} />
        <AuthDivider />

        {step === "email" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ask-email">{t("auth.email")}</Label>
              <Input
                id="ask-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder={t("auth.emailPlaceholder")}
                autoComplete="email"
                className="h-11 rounded-xl"
              />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}
            <Button
              type="button"
              className="h-11 w-full rounded-xl"
              disabled={busy || !email.trim()}
              onClick={handleSendCode}
            >
              {busy ? t("auth.sendingCode") : t("auth.sendVerificationCode")}
            </Button>
            <p className="text-center text-[12px] text-muted-foreground">
              {tab === "register" ? t("auth.alreadyHaveAccount") : t("auth.dontHaveAccount")}{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => reset(tab === "register" ? "login" : "register")}
              >
                {tab === "register" ? t("auth.signIn") : t("auth.createOne")}
              </button>
            </p>
          </div>
        )}

        {step === "otp" && (
          <EmailOtpStep
            email={email.trim()}
            otp={otp}
            onOtpChange={(v) => {
              setOtp(v);
              setError(null);
            }}
            onVerify={handleVerify}
            onResend={handleSendCode}
            onChangeEmail={() => {
              setStep("email");
              setOtp("");
              setError(null);
            }}
            verifying={busy}
            resending={busy}
            verified={Boolean(verificationToken)}
            error={error}
          />
        )}

        {step === "details" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateAccount();
            }}
          >
            <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              {t("auth.emailVerified")} <span {...CLARITY_MASK} className="font-medium">{email.trim()}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="ask-name">{t("auth.fullName")}</Label>
              <Input
                id="ask-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ask-password">{t("auth.password")}</Label>
              <Input
                id="ask-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                autoComplete="new-password"
                className="h-11 rounded-xl"
              />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy || !password}>
              {busy ? t("auth.creatingAccount") : t("auth.createAccount")}
            </Button>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              {t("ask.consentPrefix")}{" "}
              <Link href="/terms" className="underline underline-offset-2">
                {t("ask.termsLink")}
              </Link>{" "}
              {t("ask.and")}{" "}
              <Link href="/privacy" className="underline underline-offset-2">
                {t("ask.privacyLink")}
              </Link>
              .
            </p>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
