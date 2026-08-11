import type { LegalCase } from "@/lib/types";

export const SEED_CASES: LegalCase[] = [
  {
    id: "case-seed-001",
    title: "Property title dispute — Sector 45 plot",
    description:
      "Civil suit regarding ownership and possession of residential plot. Seeking declaration and injunction.",
    case_number: "CS/214/2025",
    court: "District Court, Gurugram",
    jurisdiction: "Haryana",
    practice_area: "Property",
    status: "open",
    created_at: "2025-11-12T09:30:00.000Z",
    updated_at: "2026-06-20T11:00:00.000Z",
    timeline: [
      {
        id: "ev-1",
        label: "Case filed",
        description: "Plaint registered and notice issued to respondents.",
        at: "2025-11-12T09:30:00.000Z",
      },
      {
        id: "ev-2",
        label: "Hearing scheduled",
        description: "Next hearing listed for arguments on interim injunction.",
        at: "2026-06-20T11:00:00.000Z",
      },
    ],
  },
  {
    id: "case-seed-002",
    title: "Employment termination challenge",
    description:
      "Challenge to wrongful termination under Industrial Disputes Act; seeking reinstatement and back wages.",
    case_number: "ID/88/2026",
    court: "Labour Court, Bengaluru",
    jurisdiction: "Karnataka",
    practice_area: "Labour",
    status: "in_progress",
    created_at: "2026-02-03T08:00:00.000Z",
    updated_at: "2026-06-28T14:20:00.000Z",
    timeline: [
      {
        id: "ev-3",
        label: "Case filed",
        description: "Statement of claim filed with Labour Court.",
        at: "2026-02-03T08:00:00.000Z",
      },
      {
        id: "ev-4",
        label: "Document uploaded",
        description: "Appointment letter and termination notice added to record.",
        at: "2026-03-15T10:00:00.000Z",
      },
      {
        id: "ev-5",
        label: "Hearing scheduled",
        description: "Evidence stage listed for next sitting.",
        at: "2026-06-28T14:20:00.000Z",
      },
    ],
  },
  {
    id: "case-seed-003",
    title: "Cheque bounce — Section 138 NI Act",
    description:
      "Complaint under Section 138 of the Negotiable Instruments Act for dishonoured cheque.",
    case_number: "CC/1502/2024",
    court: "Metropolitan Magistrate, Mumbai",
    jurisdiction: "Maharashtra",
    practice_area: "Criminal",
    status: "closed",
    created_at: "2024-08-19T07:45:00.000Z",
    updated_at: "2026-01-10T16:00:00.000Z",
    timeline: [
      {
        id: "ev-6",
        label: "Case filed",
        description: "Complaint registered after statutory notice period.",
        at: "2024-08-19T07:45:00.000Z",
      },
      {
        id: "ev-7",
        label: "Hearing scheduled",
        description: "Accused appeared; matter proceeded to trial.",
        at: "2025-01-22T09:00:00.000Z",
      },
      {
        id: "ev-8",
        label: "Case closed",
        description: "Matter settled; complaint withdrawn with leave of court.",
        at: "2026-01-10T16:00:00.000Z",
      },
    ],
  },
];
