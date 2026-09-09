"use client";

import { useId, useState } from "react";

import { resolveLawyerPhotoSrc } from "@/lib/lawyer-avatar";
import { cn } from "@/lib/utils";

function DemoLawyerPortrait({ gradientId }: { gradientId: string }) {
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1B3A55" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="80" height="80" fill={`url(#${gradientId})`} />
      <circle cx="40" cy="31" r="13" fill="#E8D5C0" />
      <path
        d="M26 26c2.2-9 8.4-13.5 14-13.5S51.8 17 54 26c-3.2 2.2-8 3.4-14 3.4S29.2 28.2 26 26Z"
        fill="#1E293B"
      />
      <path d="M16 72c3-16 12.5-24 24-24s21 8 24 24" fill="#2ECC8A" />
      <path d="M32 48h16l3 8H29l3-8Z" fill="#F8FAFC" />
    </svg>
  );
}

export type LawyerAvatarSource = {
  id: string;
  slug?: string | null;
  full_name?: string;
  photo_url?: string | null;
};

export function LawyerAvatar({
  lawyer,
  src,
  name,
  className,
  rounded = "xl",
}: {
  lawyer?: LawyerAvatarSource | null;
  src?: string | null;
  name?: string;
  className?: string;
  rounded?: "xl" | "2xl" | "full";
}) {
  const [failed, setFailed] = useState(false);
  const gradientId = useId().replace(/:/g, "");
  const photo = src || (lawyer ? resolveLawyerPhotoSrc(lawyer) : null);
  const label = name || lawyer?.full_name || "Advocate";
  const showPhoto = Boolean(photo) && !failed;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden bg-slate-800 ring-1 ring-black/10 dark:ring-white/15",
        rounded === "full" && "rounded-full",
        rounded === "xl" && "rounded-xl",
        rounded === "2xl" && "rounded-2xl",
        className,
      )}
      role="img"
      aria-label={`${label} profile photo`}
    >
      <DemoLawyerPortrait gradientId={gradientId} />
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo ?? undefined}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
}
