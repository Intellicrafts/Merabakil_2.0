import { Briefcase, FileText, Gavel, MessageSquare, Scale, Search } from "lucide-react";

const SERVICES = [
  {
    icon: MessageSquare,
    title: "Your AI legal guide, always available",
    description:
      "Describe your situation — by text or voice. Saarthi asks the right follow-up questions, explains your rights and options, cites the relevant laws and judgments, and helps you decide whether and when to engage a lawyer.",
    tag: "Saarthi",
  },
  {
    icon: Search,
    title: "Cite-ready search across Indian law",
    description:
      "Instantly search the Indian Constitution, IPC, CrPC, consumer protection acts, and thousands of Supreme Court and High Court judgments. Every result is source-linked — reliable enough to share with your advocate.",
    tag: "Research",
  },
  {
    icon: Briefcase,
    title: "Find the right lawyer, not just any lawyer",
    description:
      "Browse verified advocates by practice area, city, and availability. Book a timed consultation, review a structured case brief before committing, and meet in a built-in video consultation room — all without leaving the platform.",
    tag: "Marketplace",
  },
  {
    icon: FileText,
    title: "Keep every case organised",
    description:
      "Create a case file for each legal matter, log key dates and milestones, attach documents, and track next steps — so nothing slips through during a long legal process.",
    tag: "Case Management",
    upcoming: true,
  },
  {
    icon: Scale,
    title: "One secure registry for all your legal documents",
    description:
      "Store contracts, notices, evidence, and correspondence in one place. Query any document with AI, and share selected files directly and securely with your lawyer — with full access control.",
    tag: "Documents",
    upcoming: true,
  },
  {
    icon: Gavel,
    title: "Rehearse before you argue in court",
    description:
      "Advocates can run full oral-argument sessions against an AI judge and opposing counsel. Receive a real-time transcript and a formal written critique of your arguments after every round.",
    tag: "AI Courtroom",
    upcoming: true,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="border-y border-black/[0.06] bg-black/[0.02] px-4 py-20 dark:border-white/10 dark:bg-white/[0.02] md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="text-xs font-medium text-muted-foreground">
            The platform
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-3xl">
            Everything your matter needs — now and next
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[13px] text-muted-foreground sm:text-base">
            The guidance and matching you just saw are the start; MeraBakil grows with your matter.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.title}
                className={`rounded-2xl border p-4 backdrop-blur-sm sm:p-6 ${
                  service.upcoming
                    ? "border-black/[0.05] bg-black/[0.01] dark:border-white/[0.07] dark:bg-white/[0.02]"
                    : "border-black/[0.06] bg-white/60 dark:border-white/10 dark:bg-white/[0.04]"
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm ${
                    service.upcoming
                      ? "border-black/[0.04] bg-white/70 dark:border-white/[0.07] dark:bg-white/[0.05]"
                      : "border-black/[0.06] bg-white dark:border-white/10 dark:bg-white/[0.08]"
                  }`}>
                    <Icon className={`h-[18px] w-[18px] ${service.upcoming ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-300"}`} strokeWidth={1.75} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {service.upcoming && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                        Coming soon
                      </span>
                    )}
                    <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground dark:bg-white/[0.06]">
                      {service.tag}
                    </span>
                  </div>
                </div>
                <h3 className={`font-semibold ${service.upcoming ? "text-foreground/60" : ""}`}>{service.title}</h3>
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
        <div className="mb-8 text-center">
          <p className="text-xs font-medium text-muted-foreground">Why MeraBakil</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-3xl">
            Built to be trusted with your matter
          </h2>
        </div>
        <div className="grid gap-6 rounded-2xl border border-black/[0.06] bg-gradient-to-br from-slate-50 to-white p-8 dark:border-white/10 dark:from-zinc-900 dark:to-zinc-950 sm:grid-cols-2 md:grid-cols-4">
          <div className="text-center sm:text-left">
            <p className="text-xl font-semibold sm:text-2xl">1,250+</p>
            <p className="text-xs text-muted-foreground sm:text-sm">Indian laws and judgments indexed</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold sm:text-2xl">Every answer</p>
            <p className="text-xs text-muted-foreground sm:text-sm">cites its legal source — no guesswork</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold sm:text-2xl">Your data</p>
            <p className="text-xs text-muted-foreground sm:text-sm">stays private — secure, role-controlled access</p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-xl font-semibold sm:text-2xl">Every advocate</p>
            <p className="text-xs text-muted-foreground sm:text-sm">verified before they appear in a match</p>
          </div>
        </div>
      </div>
    </section>
  );
}
