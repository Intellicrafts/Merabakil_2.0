import Link from "next/link";
import { ArrowRight, BookOpen, Users, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Legal Guides & Resources",
  description: "Comprehensive guides on property law, family law, labour law, criminal law, and corporate law in India. Get instant answers to legal questions.",
  path: "/legal-guides",
});

export default function LegalGuidesPage() {
  const guides = [
    {
      id: "property-law",
      title: "Property Law Guide",
      description: "Property disputes, tenant rights, property registration, adverse possession, and property transfer",
      icon: BookOpen,
      href: "/legal-guides/property-law",
      keywords: ["property lawyer", "property dispute", "tenant rights"],
    },
    {
      id: "family-law",
      title: "Family Law Guide",
      description: "Divorce, custody, marriage, maintenance, alimony, and inheritance in India",
      icon: Users,
      href: "/legal-guides/family-law",
      keywords: ["family lawyer", "divorce", "custody"],
    },
    {
      id: "labour-law",
      title: "Labour Law Guide",
      description: "Employment rights, wrongful termination, gratuity, workplace harassment, and labour disputes",
      icon: Briefcase,
      href: "/legal-guides/labour-law",
      keywords: ["labour lawyer", "employment rights", "termination"],
    },
    // criminal-law and corporate-law guides are not published yet — omitted to
    // avoid broken internal links to 404 pages (bad for SEO/crawl budget).
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Legal Guides for India
        </h1>
        <p className="mx-auto max-w-2xl text-[15px] text-muted-foreground sm:text-[16px]">
          Comprehensive guides on major areas of Indian law. Get answers to common legal questions, understand your rights, and learn when to hire a lawyer.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => {
          const Icon = guide.icon;
          return (
            <Link
              key={guide.id}
              href={guide.href}
              className="group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/50 p-6 transition-all hover:border-primary/50 hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
            >
              <div className="relative z-10 space-y-3">
                <div className="inline-flex rounded-lg bg-primary/10 p-2.5">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">
                  {guide.title}
                </h2>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {guide.description}
                </p>
                <div className="flex flex-wrap gap-1 pt-2">
                  {guide.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground dark:bg-white/[0.05]"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
              <ArrowRight className="absolute right-4 top-6 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
          );
        })}
      </div>

      <div className="mt-12 rounded-2xl border border-black/[0.06] bg-gradient-to-br from-blue-50 to-indigo-50 px-6 py-8 dark:border-white/10 dark:from-blue-950/20 dark:to-indigo-950/20 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-3 text-xl font-semibold">Can&apos;t Find Your Answer?</h2>
          <p className="mb-6 text-[14px] text-muted-foreground">
            Ask Saarthi AI any legal question. Get instant answers grounded in Indian law with citations to relevant acts and case law.
          </p>
          <Button asChild size="lg" className="rounded-full">
            <Link href="/mera-vakil">Ask Saarthi AI</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
