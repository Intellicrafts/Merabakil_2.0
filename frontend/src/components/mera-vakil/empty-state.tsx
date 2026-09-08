"use client";

import { getStoredUser } from "@/lib/api";
import { getPrimaryRole, type PrimaryRole } from "@/lib/dashboard-config";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS_BY_ROLE: Record<PrimaryRole, { title: string; prompt: string }[]> = {
  citizen: [
    { title: "Know my rights", prompt: "What are my fundamental rights under the Indian Constitution?" },
    { title: "Draft a complaint", prompt: "Help me draft a consumer complaint under the Consumer Protection Act, 2019." },
    { title: "Explain a notice", prompt: "I received a legal notice. What does it mean and what should I do?" },
    { title: "Find a lawyer", prompt: "How do I find and evaluate a lawyer in India for my matter?" },
  ],
  advocate: [
    { title: "Draft a notice", prompt: "Draft a legal notice for breach of contract under Indian law." },
    { title: "Explain a section", prompt: "What is Article 21 of the Constitution of India?" },
    { title: "Review a clause", prompt: "Review this indemnity clause for risks under Indian contract law." },
    { title: "Find case law", prompt: "What are the leading Supreme Court judgments on the right to privacy?" },
  ],
  law_firm: [
    { title: "Find precedent", prompt: "Leading Supreme Court and High Court judgments on wrongful termination in India." },
    { title: "Review a contract", prompt: "Identify the key risk clauses in this commercial contract under Indian law." },
    { title: "FIR outline", prompt: "Draft a professional FIR outline with likely sections and documents to annex." },
    { title: "Explain a section", prompt: "Explain the relevant statutory section with leading Supreme Court interpretation." },
  ],
  enterprise: [
    { title: "DPDP compliance", prompt: "What are our key obligations under the Digital Personal Data Protection Act, 2023?" },
    { title: "Review a clause", prompt: "Review this vendor indemnity clause for risks under Indian contract law." },
    { title: "Employment law", prompt: "Summarise key Indian employment obligations for a technology company." },
    { title: "Regulatory update", prompt: "What recent SEBI or RBI changes must listed companies or NBFCs comply with?" },
  ],
  admin: [
    { title: "Draft a notice", prompt: "Draft a legal notice for breach of contract under Indian law." },
    { title: "Explain a section", prompt: "What is Article 21 of the Constitution of India?" },
    { title: "Review a clause", prompt: "Review this indemnity clause for risks under Indian contract law." },
    { title: "Find case law", prompt: "What are the leading Supreme Court judgments on the right to privacy?" },
  ],
};

interface EmptyStateProps {
  onQuickAction: (prompt: string) => void;
}

export function EmptyState({ onQuickAction }: EmptyStateProps) {
  const role = getPrimaryRole(getStoredUser());
  const quickActions = QUICK_ACTIONS_BY_ROLE[role];

  return (
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
      <div className="saarthi-welcome" aria-label="Saarthi">
        <div className="saarthi-welcome-mark">
          <span className="saarthi-welcome-glow" aria-hidden />
          <span className="saarthi-welcome-ring" aria-hidden />
          <span className="saarthi-welcome-ring saarthi-welcome-ring-slow" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/app-icon-192.png"
            alt=""
            width={192}
            height={192}
            draggable={false}
            className="saarthi-welcome-icon"
          />
          <span className="saarthi-welcome-sheen" aria-hidden />
        </div>
        <h1 className="saarthi-welcome-title">Saarthi</h1>
      </div>

      <div
        className="mt-10 grid w-full max-w-md grid-cols-2 gap-2"
        aria-label="Suggested questions"
      >
        {quickActions.map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={() => onQuickAction(action.prompt)}
            className={cn(
              "rounded-xl border border-black/[0.06] bg-transparent px-3.5 py-3 text-left text-[13px] font-medium leading-snug text-foreground/80",
              "transition-colors hover:border-black/[0.12] hover:bg-black/[0.02] hover:text-foreground",
              "dark:border-white/[0.08] dark:hover:border-white/[0.16] dark:hover:bg-white/[0.03]",
            )}
          >
            {action.title}
          </button>
        ))}
      </div>
    </div>
  );
}
