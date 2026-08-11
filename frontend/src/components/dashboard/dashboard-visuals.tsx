import { cn } from "@/lib/utils";
import type { ModuleTintKey } from "@/lib/dashboard-meta";

/** Soft decorative motif behind module cards — CSS + light SVG, no heavy assets. */
export function ModuleMotif({
  tint,
  className,
}: {
  tint: ModuleTintKey;
  className?: string;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <div className={cn("absolute -right-8 -top-10 h-36 w-36 rounded-full blur-2xl opacity-70", tintClass(tint))} />
      <svg
        viewBox="0 0 120 120"
        className="absolute -bottom-4 -right-2 h-28 w-28 opacity-[0.12] dark:opacity-[0.18]"
        fill="none"
      >
        {motifPaths(tint)}
      </svg>
    </div>
  );
}

/** Larger decorative block for featured / hero cards. */
export function FeaturedMotif({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative h-full w-full", className)} aria-hidden>
      <div className="aurora absolute inset-0 scale-110 opacity-60" />
      <svg viewBox="0 0 280 220" className="absolute inset-0 h-full w-full opacity-90" fill="none">
        <defs>
          <linearGradient id="dashFeatGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(148,163,184,0.45)" />
            <stop offset="55%" stopColor="rgba(71,85,105,0.55)" />
            <stop offset="100%" stopColor="rgba(226,232,240,0.35)" />
          </linearGradient>
          <linearGradient id="dashFeatGlow" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        {/* Scales of justice */}
        <path
          d="M140 36v96M98 52h84"
          stroke="url(#dashFeatGrad)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M98 52c0 18-14 34-30 38 16 4 30 20 30 38"
          stroke="url(#dashFeatGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="url(#dashFeatGlow)"
          fillOpacity="0.25"
        />
        <path
          d="M182 52c0 18 14 34 30 38-16 4-30 20-30 38"
          stroke="url(#dashFeatGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="url(#dashFeatGlow)"
          fillOpacity="0.25"
        />
        <circle cx="140" cy="34" r="7" fill="url(#dashFeatGrad)" />
        <rect x="118" y="132" width="44" height="10" rx="3" fill="url(#dashFeatGrad)" />
        {/* Soft chat orb */}
        <circle cx="218" cy="168" r="28" fill="url(#dashFeatGlow)" stroke="url(#dashFeatGrad)" strokeWidth="1.5" />
        <path
          d="M206 164h24M206 172h16"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function tintClass(tint: ModuleTintKey): string {
  const map: Record<ModuleTintKey, string> = {
    "mera-vakil": "bg-slate-400/35 dark:bg-slate-300/20",
    research: "bg-sky-400/25 dark:bg-sky-300/15",
    marketplace: "bg-amber-400/20 dark:bg-amber-300/12",
    cases: "bg-emerald-400/20 dark:bg-emerald-300/12",
    documents: "bg-violet-400/20 dark:bg-violet-300/12",
    knowledge: "bg-indigo-400/20 dark:bg-indigo-300/12",
    courtroom: "bg-amber-700/15 dark:bg-amber-600/10",
    users: "bg-rose-400/18 dark:bg-rose-300/10",
  };
  return map[tint];
}

function motifPaths(tint: ModuleTintKey) {
  switch (tint) {
    case "mera-vakil":
      return (
        <>
          <path d="M60 22v55M38 32h44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <circle cx="60" cy="20" r="5" fill="currentColor" />
          <path d="M38 32c0 12-10 22-20 24 10 2 20 12 20 24" stroke="currentColor" strokeWidth="2.5" fill="none" />
          <path d="M82 32c0 12 10 22 20 24-10 2-20 12-20 24" stroke="currentColor" strokeWidth="2.5" fill="none" />
        </>
      );
    case "research":
      return (
        <>
          <circle cx="52" cy="52" r="22" stroke="currentColor" strokeWidth="3" />
          <path d="M68 68l22 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "marketplace":
      return (
        <>
          <rect x="30" y="40" width="60" height="42" rx="6" stroke="currentColor" strokeWidth="3" />
          <path d="M42 40v-8a18 18 0 0 1 36 0v8" stroke="currentColor" strokeWidth="3" />
        </>
      );
    case "cases":
      return (
        <>
          <path
            d="M28 40h64v48H28zM44 40v-8h32v8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M42 58h36M42 70h24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case "documents":
      return (
        <>
          <path d="M38 24h32l20 20v52H38z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" fill="none" />
          <path d="M70 24v20h20" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
          <path d="M50 62h28M50 74h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case "knowledge":
      return (
        <>
          <ellipse cx="60" cy="36" rx="28" ry="10" stroke="currentColor" strokeWidth="3" />
          <path d="M32 36v36c0 6 12 10 28 10s28-4 28-10V36" stroke="currentColor" strokeWidth="3" fill="none" />
          <path d="M32 54c0 6 12 10 28 10s28-4 28-10" stroke="currentColor" strokeWidth="2.5" fill="none" />
        </>
      );
    case "courtroom":
      return (
        <>
          <path d="M30 88h60" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M42 88V52h36v36" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" fill="none" />
          <path d="M60 28v24M48 40h24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="60" cy="26" r="5" fill="currentColor" />
        </>
      );
    case "users":
    default:
      return (
        <>
          <circle cx="48" cy="42" r="12" stroke="currentColor" strokeWidth="3" />
          <circle cx="78" cy="42" r="10" stroke="currentColor" strokeWidth="2.5" />
          <path d="M24 86c4-16 16-22 24-22s20 6 24 22" stroke="currentColor" strokeWidth="3" fill="none" />
          <path d="M72 82c2-12 10-16 16-16s12 4 14 16" stroke="currentColor" strokeWidth="2.5" fill="none" />
        </>
      );
  }
}
