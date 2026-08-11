export interface DemoDocument {
  id: string;
  title: string;
  subtitle: string;
  docType: string;
  image: string;
  suggestedTitle: string;
  samplePrompt: string;
  tags: string[];
}

export const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    id: "demo-service-contract",
    title: "Service Agreement",
    subtitle: "Master services agreement with SLA, indemnity, and termination clauses.",
    docType: "contract",
    image: "/documents/demo-contract.svg",
    suggestedTitle: "Service Agreement 2026",
    samplePrompt: "Summarize the key obligations and liability caps in this document.",
    tags: ["Commercial", "SLA", "Indemnity"],
  },
  {
    id: "demo-writ-petition",
    title: "Writ Petition Draft",
    subtitle: "Sample Article 226 petition structure with parties, grounds, and prayers.",
    docType: "petition",
    image: "/documents/demo-petition.svg",
    suggestedTitle: "Writ Petition — Article 226",
    samplePrompt: "List the main grounds and reliefs prayed for in this petition.",
    tags: ["Constitutional", "High Court", "Draft"],
  },
  {
    id: "demo-nda",
    title: "NDA / Confidentiality",
    subtitle: "Mutual non-disclosure with carve-outs, term, and return-of-materials clauses.",
    docType: "agreement",
    image: "/documents/demo-agreement.svg",
    suggestedTitle: "Mutual NDA — Confidentiality",
    samplePrompt: "What are the exceptions to confidentiality and the survival period?",
    tags: ["NDA", "IP", "Mutual"],
  },
];

export function formatDocStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function docTypeLabel(docType?: string | null): string {
  if (!docType || docType === "user_upload") return "Upload";
  return docType.replace(/_/g, " ");
}
