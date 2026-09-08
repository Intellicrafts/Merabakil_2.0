import { cn } from "@/lib/utils";

export type BrandLogoVariant = "wordmark" | "mark" | "app";
export type BrandLogoSize = "sm" | "md" | "lg";

const WORDMARK_SIZE: Record<BrandLogoSize, { wrap: string; mark: string; title: string; tag: string }> = {
  sm: { wrap: "gap-2", mark: "h-7", title: "text-[13.5px]", tag: "text-[8.5px]" },
  md: { wrap: "gap-2.5", mark: "h-8", title: "text-[15px]", tag: "text-[10px]" },
  lg: { wrap: "gap-3", mark: "h-[3.25rem]", title: "text-[1.45rem]", tag: "text-[12px]" },
};

function markClass(force?: "light" | "dark") {
  if (force === "dark") return "fill-[#2ECC8A]";
  if (force === "light") return "fill-[#163A5C]";
  return "fill-[#163A5C] dark:fill-[#2ECC8A]";
}

function titleClass(force?: "light" | "dark") {
  if (force === "dark") return "text-white";
  if (force === "light") return "text-slate-900";
  return "text-foreground";
}

function tagClass(force?: "light" | "dark") {
  if (force === "dark") return "text-white/65";
  if (force === "light") return "text-slate-500";
  return "text-muted-foreground";
}

export function AppIcon({
  className,
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src="/brand/app-icon-192.png"
      alt={alt}
      draggable={false}
      className={cn(
        "aspect-square rounded-[22%] object-cover shadow-[0_1px_2px_rgba(15,23,42,0.16)] ring-1 ring-black/[0.06] dark:ring-white/10",
        className,
      )}
    />
  );
}

export function BrandMark({
  className,
  force,
}: {
  className?: string;
  force?: "light" | "dark";
}) {
  return (
    <svg
      viewBox="0 0 72 80"
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        className={markClass(force)}
        d="M36 5c14.8 0 26 10.2 26 23.6v18.2c0 10.6-8.4 18.8-20.6 24.4L36 75.2l-5.4-4c-12.2-5.6-20.6-13.8-20.6-24.4V28.6C10 15.2 21.2 5 36 5Z"
      />
      <path className={markClass(force)} d="M15.2 55.2 4 73.6c3.2-1.4 8.4-5.8 12.2-11.8 1.2-1.9 2.2-3.8 3-5.6-1.4-.3-2.8-.6-4-.9Z" />
      <path
        fill="white"
        fillRule="evenodd"
        d="M26.6 23h12.2c6.1 0 10.2 3.7 10.2 9.1 0 3.3-1.7 6-4.6 7.4 3.8 1 6.6 4.2 6.6 8.8 0 6.3-5 10.8-13.2 10.8H26.6V23Zm5.3 4.8v8.2h6.3c2.7 0 4.4-1.6 4.4-4.1s-1.7-4.1-4.4-4.1h-6.3Zm0 13v13.2h7.1c3.6 0 6.1-2.4 6.1-6.6 0-4.1-2.5-6.6-6.1-6.6h-7.1Z"
      />
    </svg>
  );
}

export function BrandLogo({
  variant = "mark",
  className,
  force,
  size = "md",
  alt = "Mera Bakil",
}: {
  variant?: BrandLogoVariant;
  className?: string;
  force?: "light" | "dark";
  size?: BrandLogoSize;
  alt?: string;
}) {
  if (variant === "app" || variant === "mark") {
    return (
      <span className={cn("inline-flex items-center justify-center", className)} role="img" aria-label={alt}>
        <AppIcon alt="" className="h-full w-full" />
      </span>
    );
  }

  const scale = WORDMARK_SIZE[size];
  return (
    <span
      className={cn("inline-flex items-center", scale.wrap, className)}
      role="img"
      aria-label={alt}
    >
      <AppIcon alt="" className={cn(scale.mark, "w-auto")} />
      <span className="flex min-w-0 flex-col justify-center leading-none">
        <span className={cn("font-semibold tracking-tight", scale.title, titleClass(force))}>Mera Bakil</span>
        <span className={cn("mt-1 font-medium tracking-[0.01em]", scale.tag, tagClass(force))}>
          Legal Help. Made Simple.
        </span>
      </span>
    </span>
  );
}
