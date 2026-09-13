import Link from "next/link";
import { ArrowLeft, HelpCircle, MessageSquare } from "lucide-react";

import { ErrorPageTracker } from "@/components/analytics/error-page-tracker";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Page not found",
  description: "The page you are looking for does not exist on MeraBakil.",
  path: "/404",
  noIndex: true,
});

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ErrorPageTracker />
      <header className="app-topbar border-b border-black/[0.06] px-4 py-4 dark:border-white/10 md:px-6">
        <Link href="/" className="inline-flex items-center gap-2" aria-label="Mera Bakil home">
          <BrandLogo variant="mark" className="h-8 w-8" />
          <span className="font-semibold tracking-tight">MeraBakil</span>
        </Link>
      </header>

      <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-6xl font-semibold tracking-tight text-muted-foreground/40">404</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          The page you are looking for does not exist or may have been moved.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-full">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/mera-vakil">
              <MessageSquare className="mr-2 h-4 w-4" />
              Ask Saarthi
            </Link>
          </Button>
          <Button asChild variant="ghost" className="rounded-full">
            <Link href="/faq">
              <HelpCircle className="mr-2 h-4 w-4" />
              FAQ
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
