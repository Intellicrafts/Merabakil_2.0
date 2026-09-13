import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { loadLegalMarkdown } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How MeraBakil collects, uses, and protects your personal data under the DPDP Act.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return <LegalPageShell markdown={loadLegalMarkdown("privacy.md")} />;
}
