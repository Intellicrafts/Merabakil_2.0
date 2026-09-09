"use client";

import { getStoredUser } from "@/lib/api";
import { getPrimaryRole, type PrimaryRole } from "@/lib/dashboard-config";
import { cn } from "@/lib/utils";

export const STARTER_ACTIONS_BY_ROLE: Record<PrimaryRole, { title: string; prompt: string }[]> = {
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

export function StarterSuggestions({
  onSelect,
  disabled,
}: {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  const role = getPrimaryRole(getStoredUser());
  const actions = STARTER_ACTIONS_BY_ROLE[role];

  return (
    <div className="saarthi-starters mx-auto max-w-3xl">
      <div className="saarthi-starters-track" aria-label="Suggested questions">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(action.prompt)}
            className={cn(
              "saarthi-starter-chip",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            {action.title}
          </button>
        ))}
      </div>
    </div>
  );
}
