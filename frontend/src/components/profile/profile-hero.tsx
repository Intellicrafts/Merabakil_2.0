"use client";

import { ShieldCheck, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

export function ProfileHero({ isAdvocate }: { isAdvocate: boolean }) {
  return (
    <header className="mp-card-enter space-y-2 sm:space-y-3">
      <div className="flex items-start gap-3">
        <span className="mp-profile-hero-icon">
          <UserRound className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 pt-0.5">
          <h1 className="text-[20px] font-semibold tracking-tight sm:text-[22px]">My profile</h1>
          <p className="mt-1 hidden text-[13px] leading-relaxed text-muted-foreground sm:block">
            {isAdvocate
              ? "Keep your profile complete so the AI can match you with the right clients."
              : "Update your details and photo anytime."}
          </p>
        </div>
      </div>
      {!isAdvocate && (
        <div className="mp-info-banner hidden sm:flex">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Your information is private and used only within MeraBakil.
        </div>
      )}
    </header>
  );
}

export function ProfileSectionCard({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mp-surface-card rounded-[1.25rem] p-4 sm:p-5", className)}>
      {title ? <h2 className="mp-section-heading mb-4 text-[13px]">{title}</h2> : null}
      {children}
    </section>
  );
}
