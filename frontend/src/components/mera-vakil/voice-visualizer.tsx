interface VoiceVisualizerProps {
  isActive?: boolean;
}

export function VoiceVisualizer({ isActive = false }: VoiceVisualizerProps) {
  return (
    <div
      className="relative h-24 overflow-hidden rounded-2xl border border-black/[0.05] bg-gradient-to-br from-white/70 to-slate-100/50 dark:border-white/[0.06] dark:from-white/[0.06] dark:to-white/[0.02]"
      aria-hidden={!isActive}
      aria-live={isActive ? "polite" : undefined}
    >
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center gap-1 px-6 pb-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className={
              isActive
                ? "mv-voice-bar w-1 origin-bottom rounded-full bg-gradient-to-t from-slate-500 to-slate-300 dark:from-slate-400 dark:to-slate-200"
                : "h-2 w-1 rounded-full bg-slate-300/60 dark:bg-white/15"
            }
            style={
              isActive
                ? {
                    animation: `mv-voice-bar 0.9s ease-in-out ${i * 0.07}s infinite`,
                    height: `${10 + (i % 4) * 6}px`,
                  }
                : undefined
            }
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="rounded-full border border-black/[0.06] bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-600 backdrop-blur-sm dark:border-white/10 dark:bg-black/30 dark:text-slate-300">
          {isActive ? "Speaking…" : "Read aloud ready"}
        </span>
      </div>
    </div>
  );
}
