import { AlertCircle } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Error styling shared with the booking dialog. */
export const FIELD_ERROR_BORDER = "border-red-300 focus-visible:ring-red-300 dark:border-red-800";

/** id for aria-describedby — whichever of error / hint is on screen (the error replaces the hint). */
export function describedBy(id: string, { hint, error }: { hint?: unknown; error?: string }): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

/** Accessibility props for the control inside a FormField. */
export function fieldProps(
  id: string,
  { hint, error, optional }: { hint?: unknown; error?: string; optional?: boolean },
) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-required": optional ? undefined : true,
    "aria-describedby": describedBy(id, { hint, error }),
  } as const;
}

/**
 * A labelled form control with an optional hint and an error message.
 * Required is the default; optional fields say so in the label.
 * For a group of options (chips), pass `group` — the label becomes the group's name.
 */
export function FormField({
  id,
  label,
  optional,
  hint,
  error,
  group,
  className,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string;
  group?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const labelNode = (
    <>
      {label}
      {optional && <span className="ml-1 font-normal text-muted-foreground/80">(optional)</span>}
    </>
  );
  return (
    <div
      className={cn("mp-profile-field min-w-0 scroll-mt-24", className)}
      {...(group
        ? {
            id,
            role: "group",
            "aria-labelledby": `${id}-label`,
            "aria-describedby": describedBy(id, { hint, error }),
          }
        : {})}
    >
      {group ? (
        <p id={`${id}-label`} className="text-[12px] font-medium text-muted-foreground">
          {labelNode}
        </p>
      ) : (
        <Label htmlFor={id} className="text-[12px] font-medium text-muted-foreground">
          {labelNode}
        </Label>
      )}
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[11px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1 text-[11px] text-red-600 dark:text-red-400">
          <AlertCircle className="mt-px h-3 w-3 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
