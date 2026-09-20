"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Family Law Guide: Divorce, Custody & Marriage Rights in India",
  description: "Complete guide to family law in India. Understand divorce procedures, child custody laws, maintenance rights, marriage registration, and inheritance.",
  path: "/legal-guides/family-law",
});

export default function FamilyLawPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 space-y-3">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Family Law Guide: Divorce, Custody & Marriage Rights
        </h1>
        <p className="text-lg text-muted-foreground">
          Comprehensive resource for understanding family law in India, marriage registration, divorce procedures, custody, and inheritance
        </p>
      </div>

      <div className="mb-10 rounded-lg border border-black/10 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <h2 className="mb-4 font-semibold">Quick Navigation</h2>
        <ul className="space-y-2">
          <li><a href="#marriage-laws" className="text-primary hover:underline">Marriage Laws in India</a></li>
          <li><a href="#divorce" className="text-primary hover:underline">Divorce in India: Complete Process</a></li>
          <li><a href="#custody" className="text-primary hover:underline">Child Custody Laws</a></li>
          <li><a href="#maintenance" className="text-primary hover:underline">Alimony & Maintenance Rights</a></li>
          <li><a href="#inheritance" className="text-primary hover:underline">Succession & Inheritance</a></li>
          <li><a href="#faq" className="text-primary hover:underline">Frequently Asked Questions</a></li>
        </ul>
      </div>

      <section id="marriage-laws" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Marriage Laws in India</h2>
        <p>
          India has multiple personal laws governing marriage based on religion: Hindu Marriage Act for Hindus, Muslims, Sikhs, and Buddhists; Christian Marriage Act for Christians; Parsi Marriage and Divorce Act for Parsis; and the Special Marriage Act for inter-faith marriages or those seeking secular marriage.
        </p>

        <h3 className="text-lg font-semibold">Marriage Registration</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Mandatory:</strong> Marriage registration is compulsory under law in all states</li>
          <li className="text-sm"><strong>Timeline:</strong> Must be done within 30 days of marriage; possible up to one year with magistrate permission</li>
          <li className="text-sm"><strong>Benefits:</strong> Provides legal proof of marriage, essential for inheritance, passport, visa, insurance claims</li>
          <li className="text-sm"><strong>Process:</strong> Apply at local registrar with birth certificate, age proof, identity, address, and two witnesses</li>
        </ul>

        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
          <p className="text-sm"><strong>Legal Validity:</strong> Registered marriages are recognized by courts and government for all purposes including insurance, succession, and legal proceedings.</p>
        </div>
      </section>

      <section id="divorce" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Divorce in India: Complete Process & Rights</h2>
        <p>
          Divorce terminates a valid marriage. In India, grounds for divorce differ based on personal law, but modern laws increasingly allow no-fault divorce (mutual divorce by consent).
        </p>

        <h3 className="text-lg font-semibold">Types of Divorce</h3>

        <div className="space-y-3">
          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Contested Divorce</h4>
            <p className="text-sm text-muted-foreground mt-1">One spouse initiates divorce claiming valid grounds (cruelty, adultery, desertion, mental disorder). Requires court proceedings and judicial decision.</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Uncontested/Mutual Divorce</h4>
            <p className="text-sm text-muted-foreground mt-1">Both spouses agree to divorce and settle property, custody, and maintenance terms. Faster and less expensive than contested divorce.</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">No-Fault Divorce</h4>
            <p className="text-sm text-muted-foreground mt-1">Either spouse can file for divorce after living separately for 6 months (in mutual divorce) or proving irretrievable breakdown of marriage.</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold mt-6">Grounds for Contested Divorce</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Adultery:</strong> Consensual sexual relationship with another person</li>
          <li className="text-sm"><strong>Cruelty:</strong> Physical or mental cruelty making it impossible to live together</li>
          <li className="text-sm"><strong>Desertion:</strong> Without reasonable cause and consent for 2 years continuously</li>
          <li className="text-sm"><strong>Mental Disorder:</strong> Spouse suffering from incurable mental disorder</li>
          <li className="text-sm"><strong>Leprosy/Venereal Disease:</strong> Spouse suffering from these conditions</li>
          <li className="text-sm"><strong>Conversion:</strong> Spouse converting to another religion</li>
          <li className="text-sm"><strong>Presumed Death:</strong> No news of spouse for 7 years</li>
        </ul>

        <h3 className="text-lg font-semibold mt-6">Divorce Timeline</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Mutual Divorce:</strong> 6 months to 2 years (with 6-month cooling period)</li>
          <li className="text-sm"><strong>Contested Divorce:</strong> 2-5 years or more depending on complexity and court load</li>
          <li className="text-sm"><strong>No-Fault Divorce:</strong> 6 months separation plus court proceedings (1-2 years)</li>
        </ul>
      </section>

      <section id="custody" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Child Custody Laws in India</h2>
        <p>
          Indian courts prioritize the child's best interests when deciding custody. The primary principle is "Tender Years Doctrine" - children below 5 years are presumed to be with mother unless she is unfit.
        </p>

        <h3 className="text-lg font-semibold">Types of Custody</h3>
        <div className="space-y-3">
          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Legal Custody</h4>
            <p className="text-sm text-muted-foreground mt-1">Right to make decisions about child's education, healthcare, religion, and major life decisions</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Physical Custody</h4>
            <p className="text-sm text-muted-foreground mt-1">Right to child's daily care, residence, and living arrangements</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Joint Custody</h4>
            <p className="text-sm text-muted-foreground mt-1">Both parents share legal and/or physical custody, working together for child's welfare</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold mt-6">Factors Considered in Custody Decisions</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm">Child's age and gender</li>
          <li className="text-sm">Parent's financial stability and ability to provide</li>
          <li className="text-sm">Parent-child relationship and affection</li>
          <li className="text-sm">Child's preference (if above 7 years)</li>
          <li className="text-sm">Moral character and lifestyle of parents</li>
          <li className="text-sm">Educational opportunities available</li>
          <li className="text-sm">Any history of domestic violence or abuse</li>
        </ul>
      </section>

      <section id="maintenance" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Alimony & Maintenance Rights in India</h2>
        <p>
          Maintenance (alimony) is financial support one spouse provides to the other after separation or divorce. Both husband and wife can claim maintenance depending on circumstances.
        </p>

        <h3 className="text-lg font-semibold">Types of Maintenance</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Interim Maintenance:</strong> Support during divorce proceedings</li>
          <li className="text-sm"><strong>Permanent Maintenance:</strong> Support after divorce finalization</li>
          <li className="text-sm"><strong>Child Maintenance:</strong> Support for children's education and living expenses</li>
          <li className="text-sm"><strong>Restitution of Conjugal Rights:</strong> In some cases, restoration of marital status with support</li>
        </ul>

        <h3 className="text-lg font-semibold mt-6">Factors in Calculating Maintenance</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm">Earning capacity of both spouses</li>
          <li className="text-sm">Age and health of the dependent spouse</li>
          <li className="text-sm">Standard of living during marriage</li>
          <li className="text-sm">Duration of marriage</li>
          <li className="text-sm">Contributions to marriage (homemaking, career sacrifice)</li>
          <li className="text-sm">Child custody and associated expenses</li>
        </ul>

        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950/20">
          <p className="text-sm"><strong>Recent Trend:</strong> Courts increasingly recognize contributions of homemakers and award substantial maintenance. No gender bias in modern judgments.</p>
        </div>
      </section>

      <section id="inheritance" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Succession & Inheritance Laws in India</h2>
        <p>
          Inheritance in India is governed by personal laws. If someone dies with a valid will, succession follows the will. Without a will (intestate succession), succession follows statutory rules.
        </p>

        <h3 className="text-lg font-semibold">Succession by Will</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Requirements:</strong> Must be in writing, signed by testator, witnessed by 2 persons</li>
          <li className="text-sm"><strong>Registration:</strong> While not mandatory, registration ensures authenticity and safekeeping</li>
          <li className="text-sm"><strong>Revocation:</strong> Can be revoked or modified during testator's lifetime</li>
          <li className="text-sm"><strong>Probate:</strong> Will must be proved in court to be enforceable</li>
        </ul>

        <h3 className="text-lg font-semibold mt-6">Intestate Succession (Without Will)</h3>
        <p className="text-sm text-muted-foreground mb-3">Succession follows statutory order (varies by personal law). Generally priority is:</p>
        <ul className="list-inside space-y-2">
          <li className="text-sm">Spouse and children</li>
          <li className="text-sm">Parents and siblings</li>
          <li className="text-sm">Extended family members</li>
          <li className="text-sm">Government (if no heirs)</li>
        </ul>
      </section>

      <section id="faq" className="mb-12 space-y-6">
        <h2 className="text-2xl font-bold">Frequently Asked Questions About Family Law</h2>

        <div itemscope itemtype="https://schema.org/FAQPage">
          <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemprop="name" className="font-semibold">How long does divorce take in India?</h3>
            <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
              <p itemprop="text" className="text-sm text-muted-foreground">Uncontested divorce: 6 months to 2 years (with mandatory 6-month cooling-off period). Contested divorce: 2-5 years or more depending on case complexity, evidence disputes, and court backlog. Some courts expedite mutual divorces to 4-6 months.</p>
            </div>
          </div>

          <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemprop="name" className="font-semibold">Does divorce automatically give custody to mother in India?</h3>
            <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
              <p itemprop="text" className="text-sm text-muted-foreground">No. While younger children (below 5) are traditionally with mothers (Tender Years Doctrine), courts now apply "best interest of child" principle. Fathers can get custody if they prove it's better for the child. Gender is not the determining factor anymore.</p>
            </div>
          </div>

          <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemprop="name" className="font-semibold">How is maintenance (alimony) calculated in India?</h3>
            <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
              <p itemprop="text" className="text-sm text-muted-foreground">There's no fixed formula. Courts consider: (1) Earning capacity of both spouses, (2) Standard of living during marriage, (3) Age and health, (4) Contributions to marriage, (5) Responsibility for child care. Typically 20-40% of earning spouse's income for dependent spouse, plus child maintenance.</p>
            </div>
          </div>

          <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemprop="name" className="font-semibold">Can unmarried couples get legal protection for their children?</h3>
            <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
              <p itemprop="text" className="text-sm text-muted-foreground">Yes. Unmarried parents can seek custody, succession, and maintenance rights through courts. However, legitimacy laws vary by state and personal law. Marriage registration provides clarity and legal protection for both parents and children.</p>
            </div>
          </div>

          <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemprop="name" className="font-semibold">What happens to shared property in divorce?</h3>
            <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
              <p itemprop="text" className="text-sm text-muted-foreground">Shared property is divided based on contribution and personal law applicable. In Hindu marriage: 50-50 split is common unless one spouse proves greater contribution. Islamic law: Wife gets dower and 1/8 or 1/4 of property. Modern courts ensure fair division reflecting both spouses' contributions to marriage.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-12 space-y-6 rounded-2xl border border-black/10 bg-gradient-to-br from-pink-50 to-red-50 p-6 dark:border-white/10 dark:from-pink-950/20 dark:to-red-950/20 sm:p-8">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Need Expert Family Law Help?</h2>
          <p className="text-sm text-muted-foreground">
            Family law matters are sensitive and complex. Get expert guidance from experienced family law advocates.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button asChild size="lg" className="rounded-full">
            <Link href="/lawyer-marketplace?area=family">
              Find Family Lawyer
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link href="/mera-vakil">Ask Saarthi AI</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
