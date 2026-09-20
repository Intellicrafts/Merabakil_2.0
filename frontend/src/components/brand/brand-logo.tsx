import { cn } from "@/lib/utils";

export type BrandLogoVariant = "wordmark" | "mark" | "app";
export type BrandLogoSize = "sm" | "md" | "lg";

const WORDMARK_SIZE: Record<BrandLogoSize, { wrap: string; mark: string; title: string; tag: string }> = {
  sm: { wrap: "gap-2", mark: "h-7", title: "text-[13.5px]", tag: "text-[8.5px]" },
  md: { wrap: "gap-2.5", mark: "h-8", title: "text-[15px]", tag: "text-[10px]" },
  lg: { wrap: "gap-3", mark: "h-[3.25rem]", title: "text-[1.45rem]", tag: "text-[12px]" },
};

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
    <>
      <img
        src="/brand/logo-optimized-normal.svg"
        alt={alt}
        draggable={false}
        className={cn("dark:hidden shrink-0 object-contain", className)}
      />
      <img
        src="/brand/logo-optimized-dark.svg"
        alt={alt}
        draggable={false}
        className={cn("hidden dark:block shrink-0 object-contain", className)}
      />
    </>
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
