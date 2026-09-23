"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";

import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type EmailOtpStepProps = {
  email: string;
  otp: string;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  onResend: () => void;
  onChangeEmail?: () => void;
  verifying?: boolean;
  resending?: boolean;
  verified?: boolean;
  error?: string | null;
  autoFocus?: boolean;
};

const RESEND_SECONDS = 60;

export function EmailOtpStep({
  email,
  otp,
  onOtpChange,
  onVerify,
  onResend,
  onChangeEmail,
  verifying = false,
  resending = false,
  verified = false,
  error,
  autoFocus = true,
}: EmailOtpStepProps) {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const handleResend = () => {
    onResend();
    setSecondsLeft(RESEND_SECONDS);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-black/[0.08] bg-primary/[0.04] px-4 py-3 dark:border-white/[0.10]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{t("auth.enterOtpSentTo")}</p>
            <p {...CLARITY_MASK} className="truncate text-sm text-muted-foreground">
              {email}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("auth.checkInboxHint")}</p>
            {onChangeEmail ? (
              <button
                type="button"
                onClick={onChangeEmail}
                className="mt-1 text-xs font-medium text-primary hover:underline"
              >
                {t("auth.changeEmail")}
              </button>
            ) : null}
          </div>
          {verified ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.75} />
          ) : null}
        </div>
      </div>

      {!verified ? (
        <>
          <OtpInput
            value={otp}
            onChange={onOtpChange}
            disabled={verifying}
            autoFocus={autoFocus}
          />

          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}

          <Button
            type="button"
            className="h-11 w-full rounded-xl"
            size="lg"
            disabled={verifying || otp.length !== 6}
            onClick={onVerify}
          >
            {verifying ? t("auth.verifyingCode") : t("auth.verifyCode")}
          </Button>

          <div className="text-center">
            {secondsLeft > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("auth.resendIn")} {secondsLeft}s
              </p>
            ) : (
              <button
                type="button"
                disabled={resending}
                onClick={handleResend}
                className={cn(
                  "text-xs font-medium text-primary hover:underline",
                  resending && "opacity-60",
                )}
              >
                {resending ? t("auth.sendingCode") : t("auth.resendCode")}
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {t("auth.emailVerified")}
        </p>
      )}
    </div>
  );
}
