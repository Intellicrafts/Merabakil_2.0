import Link from "next/link";
import { Scale } from "lucide-react";

export function FooterSection() {
  return (
    <footer className="border-t border-black/[0.06] px-4 py-12 dark:border-white/10 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
                <Scale className="h-3.5 w-3.5" />
              </div>
              <span className="font-semibold tracking-tight">MeraBakil</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Legal guidance for every Indian</p>
          </div>

          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground md:justify-end">
            <Link href="/login" className="hover:text-foreground">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-foreground">
              Get Started
            </Link>
            <Link href="/mera-vakil" className="hover:text-foreground">
              Mera Vakil
            </Link>
            <Link href="/lawyer-marketplace" className="hover:text-foreground">
              Find a Lawyer
            </Link>
          </nav>
        </div>

        <div className="border-t border-black/[0.05] pt-6 dark:border-white/[0.06]">
          <p className="text-center text-[11px] text-muted-foreground">
            © MeraBakil · For informational purposes only — not a substitute for licensed legal advice
          </p>
        </div>
      </div>
    </footer>
  );
}
