import { Database, FileText, Search, ShieldCheck, Sparkles } from "lucide-react";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Mera Vakil Chat",
    description: "Conversational legal AI with streaming answers, citations, and read-aloud.",
  },
  {
    icon: Search,
    title: "Research Console",
    description: "Deep legal research with confidence metrics and specialist analysis.",
  },
  {
    icon: FileText,
    title: "Document Hub",
    description: "Upload, index, and query your own legal documents with scoped research.",
  },
  {
    icon: Database,
    title: "Knowledge Hub",
    description: "Ingest and manage firm-wide legal corpora with admin controls.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise RBAC",
    description: "Role-based permissions for citizens, advocates, firms, and administrators.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="border-y border-black/[0.06] bg-black/[0.02] px-4 py-20 dark:border-white/10 dark:bg-white/[0.02] md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Platform
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Everything you need</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="rounded-2xl border border-black/[0.06] bg-white/60 p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04]"
              >
                <Icon className="mb-3 h-5 w-5 text-slate-600 dark:text-slate-300" />
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function TrustSection() {
  return (
    <section id="trust" className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 rounded-2xl border border-black/[0.06] bg-gradient-to-br from-slate-50 to-white p-8 dark:border-white/10 dark:from-zinc-900 dark:to-zinc-950 md:grid-cols-3">
          <div className="text-center md:text-left">
            <p className="text-2xl font-semibold">1,250+</p>
            <p className="text-sm text-muted-foreground">Legal corpus chunks indexed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">Grounded</p>
            <p className="text-sm text-muted-foreground">Citations on every research answer</p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-2xl font-semibold">Secure</p>
            <p className="text-sm text-muted-foreground">JWT auth · RBAC · Audit-ready</p>
          </div>
        </div>
      </div>
    </section>
  );
}
