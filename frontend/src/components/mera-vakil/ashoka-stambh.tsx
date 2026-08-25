import { cn } from "@/lib/utils";

type AshokaStambhProps = {
  className?: string;
  size?: "hero" | "avatar";
};

const ASSETS = {
  hero: {
    light: "/mera-vakil/ashoka-stambh-light.webp",
    dark: "/mera-vakil/ashoka-stambh-dark.webp",
  },
  avatar: {
    light: "/mera-vakil/ashoka-stambh-emblem-light.webp",
    dark: "/mera-vakil/ashoka-stambh-emblem-dark.webp",
  },
} as const;

export function AshokaStambh({ className, size = "hero" }: AshokaStambhProps) {
  const src = ASSETS[size];

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      role="img"
      aria-label="Ashoka Stambh"
    >
      <img
        src={src.light}
        alt=""
        draggable={false}
        className="h-full w-full object-contain object-bottom mix-blend-multiply dark:hidden"
      />
      <img
        src={src.dark}
        alt=""
        draggable={false}
        className="hidden h-full w-full object-contain object-bottom mix-blend-screen dark:block"
      />
    </span>
  );
}
