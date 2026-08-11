"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DemoCardShellProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  footer: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Shared floating glass card used by every home-hero module demo.
 * Owns the 3D float, mouse tilt, depth orbs, window chrome, and footer,
 * so the chatbot / consultation / document demos read as one product surface.
 */
export function DemoCardShell({
  icon,
  title,
  subtitle,
  badge = "Live demo",
  footer,
  children,
  className,
}: DemoCardShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      setTilt({
        x: Math.max(-8, Math.min(8, -dy * 6)),
        y: Math.max(-10, Math.min(10, dx * 8)),
      });
    }

    function onLeave() {
      setTilt({ x: 0, y: 0 });
    }

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("demo-scene relative select-none", className)}>
      {/* Depth layers — soft ambient glow (no hard frame) */}
      <div className="pointer-events-none absolute -left-8 top-8 h-32 w-32 rounded-full bg-slate-400/20 blur-3xl demo-orb-1" />
      <div className="pointer-events-none absolute -right-6 bottom-12 h-40 w-40 rounded-full bg-slate-500/15 blur-3xl demo-orb-2" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 blur-2xl demo-orb-3 dark:bg-white/10" />

      {/* Main 3D surface — outer float, inner tilt, edgeless */}
      <div className="demo-main-card relative">
        <div
          className="demo-tilt-layer relative"
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          }}
        >
          <div className="overflow-hidden rounded-[28px] bg-white/75 backdrop-blur-2xl shadow-[0_24px_70px_-12px_rgba(15,23,42,0.16)] dark:bg-zinc-900/70 dark:shadow-[0_28px_80px_-10px_rgba(0,0,0,0.55)]">
            {/* Window chrome */}
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-md dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
                  {icon}
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900">
                    <span className="demo-live-pulse absolute inset-0 rounded-full bg-emerald-400" />
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{title}</p>
                  <p className="text-[11px] text-muted-foreground">{subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="hidden rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 sm:inline">
                  {badge}
                </span>
                <div className="flex gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                </div>
              </div>
            </div>

            {children}

            <div className="border-t border-black/[0.04] px-5 py-3 text-center dark:border-white/[0.04]">
              <p className="text-[11px] text-muted-foreground">{footer}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
