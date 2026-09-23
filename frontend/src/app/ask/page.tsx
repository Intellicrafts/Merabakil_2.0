import type { Metadata } from "next";

import { AskClient } from "@/components/ask/ask-client";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Ask a Legal Question Free — Saarthi AI",
  description:
    "Ask your legal question in plain words — free, in Hindi or English. Saarthi, MeraBakil's AI legal guide, explains your rights with citations from Indian law.",
  path: "/ask",
});

export default function AskPage() {
  return <AskClient />;
}
