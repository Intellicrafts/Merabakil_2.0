"use client";

import { Building2, Scale, Shield, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

export type AccountRole = "citizen" | "advocate" | "law_firm" | "enterprise";

const ROLE_OPTIONS: {
  id: AccountRole;
  label: string;
  description: string;
  icon: typeof UserRound;
}[] = [
  {
    id: "citizen",
    label: "Citizen",
    description: "Legal research and case tracking",
    icon: UserRound,
  },
  {
    id: "advocate",
    label: "Advocate",
    description: "Practice tools, courtroom, and documents",
    icon: Scale,
  },
  {
    id: "law_firm",
    label: "Law Firm",
    description: "Team workflows and case management",
    icon: Shield,
  },
  {
    id: "enterprise",
    label: "Enterprise",
    description: "Organization legal intelligence",
    icon: Building2,
  },
];

interface RolePickerProps {
  value: AccountRole;
  onChange: (role: AccountRole) => void;
  disabled?: boolean;
}

export function RolePicker({ value, onChange, disabled = false }: RolePickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ROLE_OPTIONS.map((role) => {
        const Icon = role.icon;
        const selected = value === role.id;
        return (
          <button
            key={role.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(role.id)}
            className={cn(
              "group flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all",
              "border-black/[0.08] bg-white/70 hover:border-primary/40 hover:shadow-sm",
              "dark:border-white/10 dark:bg-zinc-900/80 dark:hover:border-primary/50",
              selected && "border-primary ring-2 ring-primary/20 shadow-sm",
              disabled && "pointer-events-none opacity-60",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary",
                selected && "bg-primary text-primary-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{role.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
