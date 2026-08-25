import { Briefcase, FileText, Gavel, MessageSquare, Scale, Search } from "lucide-react";

const SERVICES = [
  {
    icon: MessageSquare,
    title: "Ask any legal question",
    description:
      "Get cited answers on property rights, employment law, consumer protection, criminal procedure, and more — explained in plain language.",
    tag: "Mera Vakil",
  },
  {
    icon: Search,
    title: "Research Indian law",
    description:
      "Search across the Indian Constitution, IPC, CrPC, consumer protection acts, and thousands of Supreme Court and High Court judgments.",
    tag: "Research",
  },
  {
    icon: Briefcase,
    title: "Connect clients and advocates",
    description:
      "Citizens find verified lawyers by practice area and book consultations. Advocates receive curated client opportunities matched to their expertise — with a structured case brief before they commit.",
    tag: "Marketplace",
  },
  {
    icon: FileText,
    title: "Track your legal matters",
    description:
      "Stay on top of active cases, next steps, and key dates. Keep all matter details, documents, and updates organised in one place.",
    tag: "Case Management",
  },
  {
    icon: Scale,
    title: "Manage your documents",
    description:
      "Upload contracts, legal notices, evidence, and correspondence. Query your documents with AI and share securely with your lawyer.",
    tag: "Documents",
  },
  {
    icon: Gavel,
    title: "Practice before a hearing",
    description:
      "Advocates can rehearse oral arguments with an AI judge and opposing counsel — with real-time transcripts and formal written feedback.",
    tag: "AI Courtroom",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="border-y border-black/[0.06] bg-black/[0.02] px-4 py-20 dark:border-white/10 dark:bg-white/[0.02] md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Services
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Everything you need to handle a legal matter
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            From your first question to finding a lawyer, managing your case, and preparing
            for court — one platform covers the full legal journey.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.title}
                className="rounded-2xl border border-black/[0.06] bg-white/60 p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.06] bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.08]">
                    <Icon className="h-[18px] w-[18px] text-slate-600 dark:text-slate-300" strokeWidth={1.75} />
                  </div>
                  <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:bg-white/[0.06]">
                    {service.tag}
                  </span>
                </div>
                <h3 className="font-semibold">{service.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {service.description}
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
            <p className="text-sm text-muted-foreground">Indian laws and judgments indexed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">Every answer</p>
            <p className="text-sm text-muted-foreground">cites its legal source — no guesswork</p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-2xl font-semibold">Your data</p>
            <p className="text-sm text-muted-foreground">stays private — secure, role-controlled access</p>
          </div>
        </div>
      </div>
    </section>
  );
}
