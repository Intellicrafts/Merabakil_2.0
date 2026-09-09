"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { useAnchoredOverlay } from "@/components/ui/use-anchored-overlay";
import { cn } from "@/lib/utils";

type DropdownContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
};

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-flex text-left">{children}</div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");
  return (
    <button
      ref={ctx.triggerRef}
      type="button"
      className={className}
      onClick={() => ctx.setOpen(!ctx.open)}
      aria-expanded={ctx.open}
      aria-haspopup="menu"
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  children,
  className,
  align = "end",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const ctx = React.useContext(DropdownContext);
  const fallbackRef = React.useRef<HTMLButtonElement>(null);
  const { layout, mounted } = useAnchoredOverlay(Boolean(ctx?.open), ctx?.triggerRef ?? fallbackRef, {
    minWidth: 220,
    maxMenuHeight: 360,
    align,
  });

  if (!ctx) throw new Error("DropdownMenuContent must be used within DropdownMenu");
  if (!ctx.open || !mounted || !layout) return null;

  return createPortal(
    <div className="ui-select-layer" data-mode={layout.mode}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close menu"
        className={cn("ui-select-veil", layout.mode === "popover" && "bg-transparent")}
        onClick={() => ctx.setOpen(false)}
      />
      <div
        role="menu"
        style={
          layout.mode === "popover"
            ? {
                top: layout.top,
                bottom: layout.bottom,
                left: layout.left,
                width: layout.width,
                maxHeight: layout.maxHeight,
              }
            : undefined
        }
        className={cn(
          "ui-select-menu",
          layout.mode === "sheet" ? "ui-select-sheet" : "ui-select-popover",
          "p-1.5",
          className,
        )}
      >
        {layout.mode === "sheet" && (
          <div className="mb-1 flex flex-col items-center pt-1">
            <span className="ui-select-handle" />
          </div>
        )}
        <div className="ui-select-list">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function DropdownMenuItem({
  children,
  className,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) throw new Error("DropdownMenuItem must be used within DropdownMenu");
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "ui-select-option min-h-11 text-[13px] sm:min-h-10",
        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive",
        className,
      )}
      onClick={() => {
        onClick?.();
        ctx.setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1.5 h-px bg-black/[0.06] dark:bg-white/[0.08]" />;
}

export function DropdownMenuLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("truncate px-3 py-2.5 text-[11px] font-medium tracking-tight text-muted-foreground", className)}>
      {children}
    </div>
  );
}
