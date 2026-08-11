import Link from "next/link";

export function FooterSection() {
  return (
    <footer className="border-t border-black/[0.06] px-4 py-12 dark:border-white/10 md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="text-center md:text-left">
          <p className="font-semibold">AI Legal OS for India</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Bakilat · Mera Vakil · Enterprise legal intelligence
          </p>
        </div>
        <nav className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
          <Link href="/login" className="hover:text-foreground">
            Sign In
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Register
          </Link>
          <Link href="/mera-vakil" className="hover:text-foreground">
            Mera Vakil
          </Link>
        </nav>
        <p className="text-center text-[11px] text-muted-foreground md:text-right">
          Informational only · Not a substitute for licensed legal advice
        </p>
      </div>
    </footer>
  );
}
