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

function getLogoSrc(force?: "light" | "dark"): string {
  if (force === "dark") return "/brand/dark_logo.svg";
  if (force === "light") return "/brand/normal_logo.svg";
  return "var(--logo-src)";
}

export function BrandMark({
  className,
  force,
}: {
  className?: string;
  force?: "light" | "dark";
}) {
  const isDarkMode = force === "dark" || (!force && typeof window !== "undefined" && document.documentElement.classList.contains("dark"));
  const src = force ? getLogoSrc(force) : (isDarkMode ? "/brand/dark_logo.svg" : "/brand/normal_logo.svg");

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={cn("shrink-0 object-contain", className)}
      aria-hidden
    />
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
