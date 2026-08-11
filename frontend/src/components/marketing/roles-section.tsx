import { Building2, Scale, Shield, User } from "lucide-react";

const ROLES = [
  {
    icon: User,
    title: "Citizens",
    description:
      "Understand your rights, explore legal questions, and get clear guidance grounded in Indian law.",
    gradient: "from-slate-600 to-slate-800",
  },
  {
    icon: Scale,
    title: "Advocates",
    description:
      "Accelerate research, review documents, and deliver citation-backed advice to clients faster.",
    gradient: "from-zinc-600 to-zinc-800",
  },
  {
    icon: Building2,
    title: "Law Firms",
    description:
      "Centralize firm knowledge, manage cases and documents, and scale legal intelligence across teams.",
    gradient: "from-gray-600 to-gray-800",
  },
  {
    icon: Shield,
    title: "Enterprise",
    description:
      "Compliance workflows, document operations, and audit-ready legal research for in-house teams.",
    gradient: "from-slate-700 to-slate-900",
  },
];

export function RolesSection() {
  return (
    <section id="roles" className="px-4 py-20 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Built for every legal stakeholder
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Role-based intelligence</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            From citizens seeking clarity to enterprises managing compliance — one platform,
            tailored access.
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
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
