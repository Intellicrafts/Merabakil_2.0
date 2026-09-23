import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Property Law Guide: Disputes, Rights & Solutions in India",
  description: "Complete guide to property law in India. Learn about property disputes, tenant rights, property registration, adverse possession, and how to file property suits.",
  path: "/legal-guides/property-law",
});

export default function PropertyLawPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="mb-8 space-y-3">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Property Law Guide: Disputes, Rights & Solutions
        </h1>
        <p className="text-lg text-muted-foreground">
          Complete resource for understanding property law in India, resolving disputes, and protecting your property rights
        </p>
      </div>

      {/* Table of Contents */}
      <div className="mb-10 rounded-lg border border-black/10 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <h2 className="mb-4 font-semibold">Quick Navigation</h2>
        <ul className="space-y-2">
          <li><a href="#understanding" className="text-primary hover:underline">Understanding Property Law in India</a></li>
          <li><a href="#disputes" className="text-primary hover:underline">Types of Property Disputes</a></li>
          <li><a href="#tenant-rights" className="text-primary hover:underline">Tenant Rights in India</a></li>
          <li><a href="#file-suit" className="text-primary hover:underline">How to File a Property Suit</a></li>
          <li><a href="#adverse-possession" className="text-primary hover:underline">Adverse Possession Explained</a></li>
          <li><a href="#faq" className="text-primary hover:underline">Frequently Asked Questions</a></li>
        </ul>
      </div>

      {/* Section 1 */}
      <section id="understanding" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Understanding Property Law in India</h2>
        <p>
          Property law in India is governed by multiple statutes and common law principles. The primary legislation includes the Transfer of Property Act, 1882, the Limitation Act, 1963, the Indian Succession Act, 1925, and various state-specific tenancy laws.
        </p>
        <p>
          Property disputes are civil matters handled by civil courts at district level. The jurisdiction, procedure, and remedies available depend on the nature of the dispute and the value of the property.
        </p>
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
          <p className="text-sm"><strong>Key Principle:</strong> Property disputes are complex and often require expert legal guidance. Early intervention can save time, money, and emotional stress.</p>
        </div>
      </section>

      {/* Section 2 */}
      <section id="disputes" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Types of Property Disputes in India</h2>
        <p>Property disputes take various forms. Understanding the type of dispute helps determine the appropriate legal remedy and forum.</p>

        <div className="space-y-3">
          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 className="mb-2 font-semibold">Partition of Property</h3>
            <p className="text-sm text-muted-foreground">Division of joint property among co-owners, common in inheritance disputes among family members</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 className="mb-2 font-semibold">Tenant-Landlord Disputes</h3>
            <p className="text-sm text-muted-foreground">Issues between property owners and tenants regarding rent, eviction, maintenance, or security deposits</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 className="mb-2 font-semibold">Adverse Possession</h3>
            <p className="text-sm text-muted-foreground">Claiming ownership through continuous possession for statutory period (typically 12 years)</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 className="mb-2 font-semibold">Property Transfer Issues</h3>
            <p className="text-sm text-muted-foreground">Disputes over sale deeds, ownership transfer, or fraudulent transactions</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 className="mb-2 font-semibold">Neighbor Disputes</h3>
            <p className="text-sm text-muted-foreground">Boundary issues, trespass, or disputes over rights of way and water rights</p>
          </div>
        </div>
      </section>

      {/* Section 3 */}
      <section id="tenant-rights" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Tenant Rights in India: Complete Guide</h2>
        <p>
          Tenants in India have significant legal protection under various state tenancy laws and the Model Tenancy Act, 2021. Understanding your rights as a tenant is crucial for protecting yourself.
        </p>

        <h3 className="text-lg font-semibold">Key Tenant Rights</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Right to Fair Rent:</strong> Rent must be reasonable and as per agreement</li>
          <li className="text-sm"><strong>Right to Safe Housing:</strong> Landlord must maintain property in habitable condition</li>
          <li className="text-sm"><strong>Protection from Illegal Eviction:</strong> Eviction only through court order with proper notice</li>
          <li className="text-sm"><strong>Right to Security Deposit:</strong> Deposit to be refunded with interest after tenancy ends</li>
          <li className="text-sm"><strong>Right to Privacy:</strong> Landlord cannot arbitrarily enter the property</li>
          <li className="text-sm"><strong>Right to Quiet Enjoyment:</strong> Right to use property peacefully without harassment</li>
        </ul>

        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950/20">
          <p className="text-sm"><strong>Protection for Tenants:</strong> Most states require notice of 30-90 days before eviction. Landlords cannot evict without valid reasons and court order.</p>
        </div>
      </section>

      {/* Section 4 */}
      <section id="file-suit" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">How to File a Property Suit in India: Step-by-Step Guide</h2>
        <p>
          Filing a property suit requires proper documentation, understanding of jurisdiction, and procedural compliance. Here&apos;s a comprehensive guide.
        </p>

        <h3 className="text-lg font-semibold">Steps to File a Property Suit</h3>
        <div className="space-y-4">
          <div className="border-l-4 border-primary pl-4">
            <h4 className="font-semibold">Step 1: Determine Jurisdiction and Court</h4>
            <p className="text-sm text-muted-foreground mt-1">Identify which court has jurisdiction based on property location and dispute value. For disputes over ₹20 lakhs, file in civil court.</p>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h4 className="font-semibold">Step 2: Gather Documentation</h4>
            <p className="text-sm text-muted-foreground mt-1">Collect property deed, tax receipts, registered documents, photographs, agreements, and communications proving your claim.</p>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h4 className="font-semibold">Step 3: Try Alternative Dispute Resolution</h4>
            <p className="text-sm text-muted-foreground mt-1">Courts may refer cases to mediation. Resolving through mediation is faster and less expensive than litigation.</p>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h4 className="font-semibold">Step 4: Prepare Case Brief and Plaint</h4>
            <p className="text-sm text-muted-foreground mt-1">Hire a lawyer to draft the plaint (written statement) clearly stating facts, grounds for claim, and relief sought.</p>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h4 className="font-semibold">Step 5: File in Civil Court</h4>
            <p className="text-sm text-muted-foreground mt-1">Submit plaint with supporting documents, court fee (based on claim value), and lawyer&apos;s certificate to court registry.</p>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h4 className="font-semibold">Step 6: Summons and First Hearing</h4>
            <p className="text-sm text-muted-foreground mt-1">Court serves summons to defendant. Both parties attend court and respond to the claim. Discovery process begins.</p>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h4 className="font-semibold">Step 7: Evidence and Arguments</h4>
            <p className="text-sm text-muted-foreground mt-1">Both parties present evidence, cross-examine witnesses, and make legal arguments over multiple hearings.</p>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h4 className="font-semibold">Step 8: Judgment</h4>
            <p className="text-sm text-muted-foreground mt-1">Court delivers judgment. If unsatisfied, parties can appeal to higher court within 30 days.</p>
          </div>
        </div>
      </section>

      {/* Section 5 */}
      <section id="adverse-possession" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Adverse Possession in India: Know Your Rights</h2>
        <p>
          Adverse possession is a legal concept allowing someone to claim ownership of property through long-term continuous possession. Under the Limitation Act, 1963, adverse possession requires 12 years of uninterrupted possession.
        </p>

        <h3 className="text-lg font-semibold">Requirements for Adverse Possession</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Continuous Possession:</strong> Uninterrupted occupation for 12 years (not necessarily physical)</li>
          <li className="text-sm"><strong>Open and Notorious:</strong> Possession must be obvious and known to the owner</li>
          <li className="text-sm"><strong>Exclusive:</strong> Possession must be solely by the adverse possessor</li>
          <li className="text-sm"><strong>Without Permission:</strong> Possession must not be with owner&apos;s consent</li>
          <li className="text-sm"><strong>Against Owner&apos;s Title:</strong> Possession must challenge the owner&apos;s right</li>
        </ul>

        <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/20">
          <p className="text-sm"><strong>Important:</strong> Adverse possession claims are complex and evidence-heavy. The burden of proof is on the person claiming adverse possession. Consult a property lawyer.</p>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="mb-12 space-y-6">
        <h2 className="text-2xl font-bold">Frequently Asked Questions About Property Law</h2>

        <div itemScope itemType="https://schema.org/FAQPage">
          <div itemScope itemProp="mainEntity" itemType="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemProp="name" className="font-semibold">What is the limitation period for filing a property suit in India?</h3>
            <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
              <p itemProp="text" className="text-sm text-muted-foreground">Under Article 65 of the Limitation Act, 1963, the limitation period for a suit to recover possession of immovable property is 12 years from when possession becomes adverse to the owner. However, if the owner files a suit to recover possession within 12 years, they can still recover it after that period if they establish their right.</p>
            </div>
          </div>

          <div itemScope itemProp="mainEntity" itemType="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemProp="name" className="font-semibold">How long can a landlord evict a tenant without notice in India?</h3>
            <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
              <p itemProp="text" className="text-sm text-muted-foreground">A landlord cannot evict a tenant without proper notice and court order. Most states require 30-90 days&apos; notice. The Model Tenancy Act, 2021 mandates 60 days&apos; notice. Eviction is only valid through court order for valid grounds like non-payment of rent or violation of lease terms.</p>
            </div>
          </div>

          <div itemScope itemProp="mainEntity" itemType="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemProp="name" className="font-semibold">What documents are needed for property transfer in India?</h3>
            <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
              <p itemProp="text" className="text-sm text-muted-foreground">Essential documents include: (1) Original property deed and previous sale deeds, (2) Tax receipts/property tax paid receipts, (3) Encumbrance certificate from local authority, (4) Mutation certificate showing ownership records, (5) No-objection certificate if property is mortgaged, (6) Affidavit confirming no disputes, (7) Photo ID and proof of residence of buyer and seller.</p>
            </div>
          </div>

          <div itemScope itemProp="mainEntity" itemType="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemProp="name" className="font-semibold">Can a tenant be evicted for non-payment of rent?</h3>
            <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
              <p itemProp="text" className="text-sm text-muted-foreground">Yes, non-payment of rent is valid grounds for eviction, but landlords must follow legal procedure: (1) Serve notice to pay rent within 15 days, (2) If tenant doesn&apos;t pay, file eviction suit in appropriate court, (3) Tenant gets opportunity to defend or pay pending rent, (4) Court orders eviction if tenant fails to pay. Simply locking out the tenant is illegal.</p>
            </div>
          </div>

          <div itemScope itemProp="mainEntity" itemType="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemProp="name" className="font-semibold">How much does hiring a property lawyer cost in India?</h3>
            <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
              <p itemProp="text" className="text-sm text-muted-foreground">Property lawyer fees vary based on complexity: (1) Simple consultations: ₹500-2000, (2) Document review/drafting: ₹5000-20,000, (3) Representation in court: ₹10,000-50,000+ depending on case complexity and lawyer experience. Many lawyers also charge based on property value or work hours. Some offer free initial consultation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <div className="mt-12 space-y-6 rounded-2xl border border-black/10 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 dark:border-white/10 dark:from-blue-950/20 dark:to-indigo-950/20 sm:p-8">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Need Expert Property Legal Help?</h2>
          <p className="text-sm text-muted-foreground">
            Property disputes require experienced legal guidance. Connect with verified property lawyers or ask Saarthi AI your questions.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button asChild size="lg" className="rounded-full">
            <Link href="/ask?topic=property">
              Ask Saarthi about your property issue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link href="/lawyer-marketplace?area=property">Find a property lawyer</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
