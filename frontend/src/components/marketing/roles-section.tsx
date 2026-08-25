import { Building2, Scale, Shield, User } from "lucide-react";

const ROLES = [
  {
    icon: User,
    title: "Citizens",
    scenario: "I received a legal notice. What do I do?",
    description:
      "Understand your rights, get plain-language answers about your situation, and find verified lawyers for your matter — no legal background needed.",
    gradient: "from-blue-600 to-blue-800",
  },
  {
    icon: Scale,
    title: "Advocates",
    scenario: "I want quality clients relevant to my practice.",
    description:
      "Receive curated client case opportunities matched to your practice area. Get a structured case brief before you accept — key facts, relevant statutes, and a document checklist — then research, draft, and advise with confidence.",
    gradient: "from-slate-600 to-slate-800",
  },
  {
    icon: Building2,
    title: "Law Firms",
    scenario: "We're managing 30 active matters across the team.",
    description:
      "Centralise case management, build a firm knowledge base, and equip every team member with AI-powered research tools — in one workspace.",
    gradient: "from-zinc-600 to-zinc-800",
  },
  {
    icon: Shield,
    title: "Enterprises",
    scenario: "We need to comply with the DPDP Act. Where do we start?",
    description:
      "Get AI-powered compliance guidance, review contracts, manage legal documents, and understand regulatory obligations relevant to your business.",
    gradient: "from-emerald-700 to-emerald-900",
  },
];

export function RolesSection() {
  return (
    <section id="roles" className="px-4 py-20 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Who it&apos;s for
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Built for every legal situation
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Whether you&apos;re a citizen facing a dispute or an enterprise managing compliance —
            MeraBakil gives you the right tools for your role.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.title}
                className="group rounded-2xl border border-black/[0.06] bg-white/50 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${role.gradient}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{role.title}</h3>
                <p className="mt-1.5 text-[12px] italic text-muted-foreground/70">
                  &ldquo;{role.scenario}&rdquo;
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {role.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
