"use client";

import { CircleUserRound, Home, Wallet } from "lucide-react";

import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type MenuAccent = "home" | "profile" | "wallet";

const ACCENT_CLASS: Record<MenuAccent, string> = {
  home: "mp-account-menu-icon-home",
  profile: "mp-account-menu-icon-profile",
  wallet: "mp-account-menu-icon-wallet",
};

export function AccountMenuItem({
  icon: Icon,
  label,
  onClick,
  trailing,
  accent,
}: {
  icon: typeof Home;
  label: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  accent: MenuAccent;
}) {
  return (
    <DropdownMenuItem onClick={onClick} className="mp-account-menu-item min-h-11 py-2.5">
      <span
        className={cn(
          "mp-menu-icon mr-3 flex h-8 w-8 items-center justify-center rounded-xl",
          ACCENT_CLASS[accent],
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>
      <span className="text-[13px] font-medium">{label}</span>
      {trailing}
    </DropdownMenuItem>
  );
}

export { Home, CircleUserRound, Wallet };
