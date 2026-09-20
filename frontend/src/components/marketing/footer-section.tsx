import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { CookieSettingsLink } from "@/components/consent/cookie-settings-link";

export function FooterSection() {
  return (
    <footer className="border-t border-black/[0.06] px-4 py-12 dark:border-white/10 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="brand-lockup-tight flex items-center">
              <BrandLogo variant="mark" className="h-7 w-7" />
              <span className="font-semibold tracking-tight">MeraBakil</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Your Legal Saarthi</p>
          </div>

          <div className="flex flex-col items-center gap-3 md:items-end">
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground md:justify-end">
              <Link href="/mera-vakil" className="hover:text-foreground">Saarthi</Link>
              <Link href="/legal-guides" className="hover:text-foreground">Legal Guides</Link>
              <Link href="/faq" className="hover:text-foreground">FAQ</Link>
              <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
              <CookieSettingsLink />
              <a href="mailto:support@merabakil.in" className="hover:text-foreground">Contact</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-black/[0.10] px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-black/[0.15] hover:text-foreground dark:border-white/[0.12] dark:hover:border-white/20"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-foreground px-3.5 py-1.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-black/[0.05] pt-6 dark:border-white/[0.06]">
          <p className="text-center text-[11px] text-muted-foreground">
            © 2025 MeraBakil · For informational purposes only — not a substitute for licensed legal advice
          </p>
        </div>
      </div>
    </footer>
  );
}
