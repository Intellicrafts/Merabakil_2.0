"use client";

import { getStoredUser } from "@/lib/api";
import { getPrimaryRole, type PrimaryRole } from "@/lib/dashboard-config";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Prompts stay in English — they go to the AI. Titles are translated via i18n keys.
export const STARTER_ACTIONS_BY_ROLE: Record<PrimaryRole, { titleKey: string; prompt: string }[]> = {
  citizen: [
    { titleKey: "suggestions.knowRights", prompt: "What are my fundamental rights under the Indian Constitution?" },
    { titleKey: "suggestions.draftComplaint", prompt: "Help me draft a consumer complaint under the Consumer Protection Act, 2019." },
    { titleKey: "suggestions.explainNotice", prompt: "I received a legal notice. What does it mean and what should I do?" },
    { titleKey: "suggestions.findLawyer", prompt: "How do I find and evaluate a lawyer in India for my matter?" },
  ],
  advocate: [
    { titleKey: "suggestions.draftNotice", prompt: "Draft a legal notice for breach of contract under Indian law." },
    { titleKey: "suggestions.explainSection", prompt: "What is Article 21 of the Constitution of India?" },
    { titleKey: "suggestions.reviewClause", prompt: "Review this indemnity clause for risks under Indian contract law." },
    { titleKey: "suggestions.findCaseLaw", prompt: "What are the leading Supreme Court judgments on the right to privacy?" },
  ],
  law_firm: [
    { titleKey: "suggestions.findPrecedent", prompt: "Leading Supreme Court and High Court judgments on wrongful termination in India." },
    { titleKey: "suggestions.reviewContract", prompt: "Identify the key risk clauses in this commercial contract under Indian law." },
    { titleKey: "suggestions.firOutline", prompt: "Draft a professional FIR outline with likely sections and documents to annex." },
    { titleKey: "suggestions.explainSection", prompt: "Explain the relevant statutory section with leading Supreme Court interpretation." },
  ],
  enterprise: [
    { titleKey: "suggestions.dppdCompliance", prompt: "What are our key obligations under the Digital Personal Data Protection Act, 2023?" },
    { titleKey: "suggestions.reviewClause", prompt: "Review this vendor indemnity clause for risks under Indian contract law." },
    { titleKey: "suggestions.employmentLaw", prompt: "Summarise key Indian employment obligations for a technology company." },
    { titleKey: "suggestions.regulatoryUpdate", prompt: "What recent SEBI or RBI changes must listed companies or NBFCs comply with?" },
  ],
  admin: [
    { titleKey: "suggestions.draftNotice", prompt: "Draft a legal notice for breach of contract under Indian law." },
    { titleKey: "suggestions.explainSection", prompt: "What is Article 21 of the Constitution of India?" },
    { titleKey: "suggestions.reviewClause", prompt: "Review this indemnity clause for risks under Indian contract law." },
    { titleKey: "suggestions.findCaseLaw", prompt: "What are the leading Supreme Court judgments on the right to privacy?" },
  ],
};

export function StarterSuggestions({
  onSelect,
  disabled,
  hideBooking,
}: {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  /** Guests can't book — drop the "Find a lawyer" chip. */
  hideBooking?: boolean;
}) {
  const role = getPrimaryRole(getStoredUser());
  const actions = STARTER_ACTIONS_BY_ROLE[role].filter(
    (a) => !hideBooking || a.titleKey !== "suggestions.findLawyer",
  );
  const { t } = useTranslation();

  return (
    <div className="saarthi-starters mx-auto max-w-3xl">
      <div className="saarthi-starters-track" aria-label={t("suggestions.suggestedQuestions")}>
        {actions.map((action) => (
          <button
            key={action.titleKey}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(action.prompt)}
            className={cn(
              "saarthi-starter-chip",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            {t(action.titleKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
