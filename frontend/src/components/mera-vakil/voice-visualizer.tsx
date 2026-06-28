interface VoiceVisualizerProps {
  isActive?: boolean;
}

export function VoiceVisualizer({ isActive = false }: VoiceVisualizerProps) {
  return (
    <div
      className="relative h-24 overflow-hidden rounded-2xl bg-white/40 dark:bg-white/5"
      aria-hidden={!isActive}
      aria-live={isActive ? "polite" : undefined}
    >
      <svg
        viewBox="0 0 400 80"
        className={isActive ? "wave-animate h-full w-full" : "h-full w-full opacity-60"}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#64748B" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#475569" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="wave2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#CBD5E1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <path
          d="M0,50 Q50,20 100,50 T200,50 T300,50 T400,50 L400,80 L0,80 Z"
          fill="url(#wave1)"
        />
        <path
          d="M0,60 Q60,35 120,55 T240,45 T360,58 T400,55 L400,80 L0,80 Z"
          fill="url(#wave2)"
          style={{ animationDelay: "0.5s" }}
        />
        <path
          d="M0,65 Q40,55 80,62 T160,58 T240,65 T320,55 T400,62 L400,80 L0,80 Z"
          fill="url(#wave1)"
          opacity="0.5"
          style={{ animationDelay: "1s" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="rounded-full bg-white/50 px-3 py-1 text-xs font-medium text-slate-600 backdrop-blur-sm dark:bg-black/30 dark:text-slate-300">
          {isActive ? "Speaking…" : "Read aloud"}
        </span>
      </div>
    </div>
  );
}
