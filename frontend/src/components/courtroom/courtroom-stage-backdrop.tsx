"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

interface CourtroomStageBackdropProps {
  className?: string;
}

export function CourtroomStageBackdrop({ className }: CourtroomStageBackdropProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-2xl opacity-40 dark:opacity-25",
        className,
      )}
      aria-hidden
    >
      <Image
        src="/courtroom/stage-backdrop.svg"
        alt=""
        fill
        className="object-cover object-bottom cs-stage-enter"
        sizes="100vw"
        priority={false}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent dark:from-stone-950/80" />
    </div>
  );
}
