import { MeraVakilClientLayout } from "@/app/mera-vakil/client-layout";
import { pageMetadata } from "@/lib/site-metadata";
import { getSoftwareApplicationSchema } from "@/lib/schema-markup";

export const metadata = pageMetadata({
  title: "Saarthi — AI Legal Assistant",
  description:
    "Ask legal questions in plain language. Get cited answers grounded in Indian law from MeraBakil's Saarthi AI assistant.",
  path: "/mera-vakil",
});

export default function MeraVakilLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(getSoftwareApplicationSchema()),
        }}
      />
      <MeraVakilClientLayout>{children}</MeraVakilClientLayout>
    </>
  );
}
