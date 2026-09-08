"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

function DefaultProfessionalPortrait({ gradientId }: { gradientId: string }) {
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#163A5C" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="40" fill={`url(#${gradientId})`} />
      <circle cx="40" cy="31" r="13" fill="#E8DCC8" />
      <path d="M26 26c2.2-9 8.4-13.5 14-13.5S51.8 17 54 26c-3.2 2.2-8 3.4-14 3.4S29.2 28.2 26 26Z" fill="#1E293B" />
      <path d="M16 72c3-16 12.5-24 24-24s21 8 24 24" fill="#2ECC8A" />
      <path d="M32 48h16l3 8H29l3-8Z" fill="#F8FAFC" />
    </svg>
  );
}

export function ProfileAvatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const gradientId = useId().replace(/:/g, "");
  const showPhoto = Boolean(src) && !failed;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-slate-800 ring-1 ring-black/10 dark:ring-white/15",
        className,
      )}
      role="img"
      aria-label={`${name} profile photo`}
    >
      <DefaultProfessionalPortrait gradientId={gradientId} />
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
}
