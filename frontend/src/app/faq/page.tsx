import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { loadLegalMarkdown } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "FAQ",
  description: "Frequently asked questions about MeraBakil, Saarthi AI, accounts, privacy, and the advocate marketplace.",
  path: "/faq",
});

export default function FaqPage() {
  return <LegalPageShell markdown={loadLegalMarkdown("faq.md")} />;
}
