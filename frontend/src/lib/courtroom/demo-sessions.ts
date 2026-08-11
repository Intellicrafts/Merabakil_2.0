import type { CourtroomSessionConfig, Exhibit, LegalAuthority } from "@/lib/courtroom/types";

export interface DemoSessionPreset {
  id: string;
  label: string;
  subtitle: string;
  config: Omit<CourtroomSessionConfig, "exhibits"> & { exhibits: Exhibit[] };
  authorities: LegalAuthority[];
}

export const DEMO_SESSION_PRESETS: DemoSessionPreset[] = [
  {
    id: "contract-breach",
    label: "Contractual Breach",
    subtitle: "Service agreement dispute — specific performance and damages.",
    config: {
      matterTitle: "Sharma Industries v. Delta Logistics Pvt. Ltd.",
      matterType: "Commercial",
      petitionerName: "Adv. Priya Sharma",
      respondentName: "Adv. Rajesh Mehta",
      presetId: "contract-breach",
      exhibits: [
        {
          id: "ex-1",
          title: "Master Service Agreement (2024)",
          type: "Contract",
          status: "marked",
          source: "Petitioner",
        },
        {
          id: "ex-2",
          title: "SLA Breach Notice dated 12 Jan 2026",
          type: "Correspondence",
          status: "marked",
          source: "Petitioner",
        },
        {
          id: "ex-3",
          title: "Delivery Logs — Q3 2025",
          type: "Records",
          status: "pending",
          source: "Respondent",
        },
      ],
    },
    authorities: [
      {
        id: "auth-1",
        marker: "A1",
        title: "Indian Contract Act, 1872",
        citation: "Section 73 — Compensation for loss or damage",
      },
      {
        id: "auth-2",
        marker: "A2",
        title: "Specific Relief Act, 1963",
        citation: "Section 10 — Cases in which specific performance enforceable",
      },
    ],
  },
  {
    id: "article-21-writ",
    label: "Article 21 Writ",
    subtitle: "Constitutional challenge — personal liberty and due process.",
    config: {
      matterTitle: "Citizen Welfare Forum v. State of Maharashtra",
      matterType: "Constitutional",
      petitionerName: "Adv. Ananya Iyer",
      respondentName: "Adv. State Counsel",
      presetId: "article-21-writ",
      exhibits: [
        {
          id: "ex-4",
          title: "Detention Order dated 3 Mar 2026",
          type: "Order",
          status: "marked",
          source: "Respondent",
        },
        {
          id: "ex-5",
          title: "Medical Examination Report",
          type: "Medical",
          status: "marked",
          source: "Petitioner",
        },
      ],
    },
    authorities: [
      {
        id: "auth-3",
        marker: "B1",
        title: "Constitution of India",
        citation: "Article 21 — Protection of life and personal liberty",
      },
      {
        id: "auth-4",
        marker: "B2",
        title: "Maneka Gandhi v. Union of India",
        citation: "AIR 1978 SC 597",
      },
    ],
  },
];

export function getDemoPreset(id: string): DemoSessionPreset | undefined {
  return DEMO_SESSION_PRESETS.find((p) => p.id === id);
}
