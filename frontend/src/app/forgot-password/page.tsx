"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";

import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { requestPasswordReset } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: () => requestPasswordReset(email),
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <AuthLayout
        title={t("auth.checkYourEmail")}
        subtitle={t("auth.resetSent")}
        footer={
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("auth.backToSignIn")}
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-muted-foreground">
            For security, we don&apos;t reveal whether an email is registered. If you have an
            account, you&apos;ll receive a reset link shortly.
          </p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/login">{t("auth.backToSignIn")}</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.resetPassword")}
      subtitle={t("auth.resetInstructions")}
      footer={
        <>
          {t("auth.rememberPassword")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("auth.signIn")}
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          track(AnalyticsEvents.PASSWORD_RESET_STARTED);
          mutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            required
            autoComplete="email"
          />
        </div>

        {mutation.isError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {(mutation.error as Error).message}
          </p>
        )}

        <Button type="submit" className="w-full rounded-xl" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? t("auth.sending") : t("auth.sendResetLink")}
        </Button>
      </form>
    </AuthLayout>
  );
}
