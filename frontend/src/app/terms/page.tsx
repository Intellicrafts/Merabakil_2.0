import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { loadLegalMarkdown } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Terms of Service",
  description: "Terms governing your use of MeraBakil, including AI disclaimers and beta conditions.",
  path: "/terms",
});

export default function TermsPage() {
  return <LegalPageShell markdown={loadLegalMarkdown("terms.md")} />;
}
