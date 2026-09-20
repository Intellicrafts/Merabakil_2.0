import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { loadLegalMarkdown } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";
import { getFAQPageSchema } from "@/lib/schema-markup";

export const metadata = pageMetadata({
  title: "FAQ",
  description: "Frequently asked questions about MeraBakil, Saarthi AI, accounts, privacy, and the advocate marketplace.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(getFAQPageSchema()),
        }}
      />
      <LegalPageShell markdown={loadLegalMarkdown("faq.md")} />
    </>
  );
}
