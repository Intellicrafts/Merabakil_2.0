"use client";

import { useState } from "react";

import { DEFAULT_LAWYER_AVATAR, lawyerInitials, resolveLawyerPhotoSrc } from "@/lib/lawyer-avatar";
import { cn } from "@/lib/utils";

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
  rounded = "full",
  ring = true,
}: {
  lawyer?: LawyerAvatarSource | null;
  src?: string | null;
  name?: string;
  className?: string;
  rounded?: "xl" | "2xl" | "full";
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [defaultFailed, setDefaultFailed] = useState(false);
  const label = name || lawyer?.full_name || "Advocate";
  const remotePhoto = src || (lawyer ? resolveLawyerPhotoSrc(lawyer) : null);
  const photoSrc = failed || defaultFailed ? null : remotePhoto || DEFAULT_LAWYER_AVATAR;
  const fallbackSrc = failed && !defaultFailed ? DEFAULT_LAWYER_AVATAR : null;
  const initials = lawyerInitials(label);
  const showInitials = defaultFailed && Boolean(initials);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800",
        ring && "mp-avatar-ring",
        rounded === "full" && "rounded-full",
        rounded === "xl" && "rounded-xl",
        rounded === "2xl" && "rounded-2xl",
        className,
      )}
      role="img"
      aria-label={`${label} profile photo`}
    >
      {showInitials ? (
        <span
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-bold text-white/90"
          aria-hidden
        >
          {initials}
        </span>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoSrc ?? fallbackSrc ?? DEFAULT_LAWYER_AVATAR}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => {
              if (!failed) setFailed(true);
              else setDefaultFailed(true);
            }}
            className="h-full w-full object-cover"
          />
        </>
      )}
    </span>
  );
}
