"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "hi" : "en")}
      aria-label={lang === "en" ? t("lang.switchToHindi") : t("lang.switchToEnglish")}
      className={cn(
        "flex h-8 items-center gap-0 rounded-lg border border-black/[0.07] bg-white/60 px-0 text-[11.5px] font-medium text-muted-foreground transition-all hover:bg-white hover:text-foreground dark:border-white/[0.09] dark:bg-white/[0.05] dark:hover:bg-white/[0.09]",
        className,
      )}
    >
      <span
        className={cn(
          "px-2.5 py-1 transition-colors",
          lang === "en"
            ? "font-semibold text-foreground"
            : "text-muted-foreground/60",
        )}
      >
        EN
      </span>
      <span className="text-muted-foreground/40">|</span>
      <span
        className={cn(
          "px-2.5 py-1 transition-colors",
          lang === "hi"
            ? "font-semibold text-foreground"
            : "text-muted-foreground/60",
        )}
      >
        हि
      </span>
    </button>
  );
}
