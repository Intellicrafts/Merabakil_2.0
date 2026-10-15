"use client";

import { Scale, Users } from "lucide-react";

import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type AccountRole = "citizen" | "advocate" | "law_firm" | "enterprise";

const ROLE_OPTIONS = [
  {
    id: "citizen" as const,
    labelKey: "auth.citizen" as const,
    descriptionKey: "auth.citizenDesc" as const,
    icon: Users,
  },
  {
    id: "advocate" as const,
    labelKey: "auth.advocate" as const,
    descriptionKey: "auth.advocateDesc" as const,
    icon: Scale,
  },
];

interface RolePickerProps {
  value: AccountRole | null;
  onChange: (role: AccountRole) => void;
  disabled?: boolean;
}

export function RolePicker({ value, onChange, disabled = false }: RolePickerProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label>{t("auth.iAm")}</Label>
      <div className="grid grid-cols-2 gap-2">
        {ROLE_OPTIONS.map(({ id, labelKey, descriptionKey, icon: Icon }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(id)}
              className={cn(
                "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                selected
                  ? "border-primary/40 bg-primary/[0.06] ring-1 ring-primary/20"
                  : "border-black/[0.08] bg-white hover:border-black/[0.14] hover:bg-slate-50 dark:border-white/[0.10] dark:bg-zinc-800 dark:hover:border-white/[0.18]",
                disabled && "pointer-events-none opacity-60",
              )}
              aria-pressed={selected}
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-black/[0.06] text-muted-foreground dark:bg-white/[0.10]",
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </div>
              <div>
                <p className={cn("text-[13px] font-semibold", selected && "text-primary")}>
                  {t(labelKey)}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {t(descriptionKey)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
