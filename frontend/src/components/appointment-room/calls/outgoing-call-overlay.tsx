"use client";

import { Loader2, PhoneOff } from "lucide-react";

import type { CallMode } from "@/lib/appointment-types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface OutgoingCallOverlayProps {
  counterpartName: string;
  mode: CallMode;
  onCancel: () => void;
  cancelling?: boolean;
}

export function OutgoingCallOverlay({
  counterpartName,
  mode,
  onCancel,
  cancelling = false,
}: OutgoingCallOverlayProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-slate-950/95 p-6 text-center text-white shadow-2xl sm:rounded-3xl">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/15">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
        <p className="text-lg font-semibold">{t("room.calling").replace("{{name}}", counterpartName)}</p>
        <p className="mt-1 text-sm text-white/65">
          {mode === "video" ? t("room.videoConsultation") : t("room.audioConsultation")}
        </p>
        <button
          type="button"
          disabled={cancelling}
          onClick={onCancel}
          className={cn(
            "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/90 px-4 py-3 text-sm font-semibold",
            cancelling && "opacity-70",
          )}
        >
          <PhoneOff className="h-4 w-4" />
          {cancelling ? t("room.cancellingCall") : t("room.cancelCall")}
        </button>
      </div>
    </div>
  );
}
