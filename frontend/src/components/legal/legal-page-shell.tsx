import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { FooterSection } from "@/components/marketing/footer-section";
import { LegalMarkdown } from "@/components/legal/legal-markdown";

interface LegalPageShellProps {
  markdown: string;
}

export function LegalPageShell({ markdown }: LegalPageShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="app-topbar sticky top-0 z-50 border-b border-black/[0.06] dark:border-white/10">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="brand-lockup-tight flex items-center" aria-label="Mera Bakil home">
            <BrandLogo variant="mark" className="h-8 w-8" />
            <span className="font-semibold tracking-tight">MeraBakil</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/faq" className="hover:text-foreground">
              FAQ
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
        <article className="legal-prose">
          <LegalMarkdown content={markdown} />
        </article>
      </main>

      <FooterSection />
    </div>
  );
}
