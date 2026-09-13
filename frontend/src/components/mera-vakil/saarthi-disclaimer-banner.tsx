import { AlertCircle } from "lucide-react";

export function SaarthiDisclaimerBanner() {
  return (
    <div
      role="note"
      className="flex items-start gap-2 border-b border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-snug text-amber-900 dark:text-amber-200/90 sm:px-4 sm:text-xs"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <p>
        Saarthi provides informational guidance only — not legal advice. Consult a licensed advocate for advice
        specific to your situation.
      </p>
    </div>
  );
}
