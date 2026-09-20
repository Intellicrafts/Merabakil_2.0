"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Labour Law Guide: Employee Rights & Workplace Protections in India",
  description: "Complete guide to labour law in India. Learn about employee rights, minimum wages, wrongful termination, gratuity, workplace harassment, and labour disputes.",
  path: "/legal-guides/labour-law",
});

export default function LabourLawPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 space-y-3">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Labour Law Guide: Employee Rights & Workplace Protections
        </h1>
        <p className="text-lg text-muted-foreground">
          Comprehensive resource for understanding labour law in India, employee rights, workplace protections, and resolution of employment disputes
        </p>
      </div>

      <div className="mb-10 rounded-lg border border-black/10 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <h2 className="mb-4 font-semibold">Quick Navigation</h2>
        <ul className="space-y-2">
          <li><a href="#employee-rights" className="text-primary hover:underline">Employee Rights in India</a></li>
          <li><a href="#minimum-wages" className="text-primary hover:underline">Minimum Wages & Working Hours</a></li>
          <li><a href="#termination" className="text-primary hover:underline">Wrongful Termination & Dismissal</a></li>
          <li><a href="#gratuity" className="text-primary hover:underline">Gratuity, Severance & Compensation</a></li>
          <li><a href="#harassment" className="text-primary hover:underline">Workplace Rights & Harassment</a></li>
          <li><a href="#disputes" className="text-primary hover:underline">Industrial Disputes & Resolution</a></li>
          <li><a href="#faq" className="text-primary hover:underline">Frequently Asked Questions</a></li>
        </ul>
      </div>

      <section id="employee-rights" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Employee Rights in India</h2>
        <p>
          Indian labour law provides comprehensive protection to employees. These rights are enshrined in various acts including the Industrial Disputes Act, 1947, the Employees' Provident Fund Act, 1952, the Payment of Gratuity Act, 1972, and the Sexual Harassment of Women at Workplace Act, 2013.
        </p>

        <h3 className="text-lg font-semibold">Core Employee Rights</h3>
        <div className="space-y-3">
          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Right to Fair Wages</h4>
            <p className="text-sm text-muted-foreground mt-1">Minimum wages as per state norms, equal pay for equal work, no arbitrary deductions</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Right to Safe Working Conditions</h4>
            <p className="text-sm text-muted-foreground mt-1">Employer must provide safe workplace, safety equipment, and protection from occupational hazards</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Right to Working Hours Limits</h4>
            <p className="text-sm text-muted-foreground mt-1">Maximum 8 hours/day (48 hours/week), rest periods, overtime compensation</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Right to Leave</h4>
            <p className="text-sm text-muted-foreground mt-1">Earned leave, casual leave, sick leave, maternity leave as per law</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Right to Social Security</h4>
            <p className="text-sm text-muted-foreground mt-1">Provident fund, gratuity, workers' compensation, health insurance</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Right to Non-Discrimination</h4>
            <p className="text-sm text-muted-foreground mt-1">Protection from discrimination based on caste, religion, gender, disability</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Right to Free Speech & Association</h4>
            <p className="text-sm text-muted-foreground mt-1">Freedom to form/join unions, participate in strikes, express views</p>
          </div>
        </div>
      </section>

      <section id="minimum-wages" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Minimum Wages & Working Hours in India</h2>
        <p>
          Every employee is entitled to minimum wage as fixed by state or central government. The Minimum Wages Act, 1948 ensures employees earn at least the statutory minimum.
        </p>

        <h3 className="text-lg font-semibold">Minimum Wage Structure</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Statutory Minimum:</strong> Set by state governments, varies by skill level and occupation</li>
          <li className="text-sm"><strong>Dearness Allowance:</strong> Additional compensation for inflation, provided quarterly/annually</li>
          <li className="text-sm"><strong>Overtime:</strong> 1.5x to 2x wages for work beyond 8 hours/day</li>
          <li className="text-sm"><strong>Holiday Pay:</strong> Double wages for work on public holidays</li>
        </ul>

        <h3 className="text-lg font-semibold mt-6">Working Hours & Rest</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Daily Hours:</strong> Maximum 8 hours per day</li>
          <li className="text-sm"><strong>Weekly Hours:</strong> Maximum 48 hours per week</li>
          <li className="text-sm"><strong>Rest Periods:</strong> Minimum 30 minutes break for 5-hour work</li>
          <li className="text-sm"><strong>Weekly Off:</strong> At least one full day off per week</li>
          <li className="text-sm"><strong>Overtime Limit:</strong> Cannot exceed 50 hours per week without special circumstances</li>
        </ul>

        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
          <p className="text-sm"><strong>Important:</strong> Employees cannot be forced to work beyond legal limits. Employers violating these provisions face penalties and fines.</p>
        </div>
      </section>

      <section id="termination" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Wrongful Termination & Dismissal in India</h2>
        <p>
          Employers cannot arbitrarily terminate employees. Termination must follow legal procedure with valid grounds. Unfair or illegal termination entitles employees to compensation and reinstatement.
        </p>

        <h3 className="text-lg font-semibold">Fair vs. Unfair Dismissal</h3>

        <div className="rounded-lg border border-green-100 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/20">
          <h4 className="font-semibold text-green-900 dark:text-green-100">Fair Dismissal (Valid Grounds)</h4>
          <ul className="list-inside space-y-1 mt-2 text-sm">
            <li>Serious misconduct (theft, violence, insubordination)</li>
            <li>Habitual negligence or poor performance after warnings</li>
            <li>Frequent absenteeism without justification</li>
            <li>Violation of conduct rules repeatedly</li>
            <li>Incompetence after reasonable opportunity to improve</li>
          </ul>
        </div>

        <div className="rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20 mt-4">
          <h4 className="font-semibold text-red-900 dark:text-red-100">Unfair Dismissal (Illegal)</h4>
          <ul className="list-inside space-y-1 mt-2 text-sm">
            <li>Dismissal without notice or opportunity to respond</li>
            <li>Dismissal based on discrimination (caste, religion, gender)</li>
            <li>Dismissal due to union membership or strike participation</li>
            <li>Dismissal during maternity leave or injury absence</li>
            <li>Dismissal without following prescribed procedure</li>
          </ul>
        </div>

        <h3 className="text-lg font-semibold mt-6">Termination Procedure</h3>
        <ol className="list-inside space-y-2">
          <li className="text-sm"><strong>1. Written Notice:</strong> Employer must provide written notice and charges in detail</li>
          <li className="text-sm"><strong>2. Opportunity to Respond:</strong> Employee gets reasonable time to explain/defend</li>
          <li className="text-sm"><strong>3. Inquiry (if required):</strong> For serious misconduct, formal inquiry may be conducted</li>
          <li className="text-sm"><strong>4. Notice Period:</strong> Employer must give 30-60 days notice or pay in lieu</li>
          <li className="text-sm"><strong>5. Final Settlement:</strong> All dues must be paid including gratuity, notice pay, leaves</li>
        </ol>

        <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/20 mt-6">
          <p className="text-sm"><strong>Legal Remedy:</strong> If dismissed unfairly, employees can file complaint with Industrial Tribunal claiming reinstatement or compensation.</p>
        </div>
      </section>

      <section id="gratuity" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Gratuity, Severance & Compensation</h2>
        <p>
          The Payment of Gratuity Act, 1972 ensures employees receive terminal benefits upon retirement, resignation, or termination. Gratuity is a lump-sum payment recognizing years of service.
        </p>

        <h3 className="text-lg font-semibold">Gratuity Entitlement</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Eligibility:</strong> Minimum 5 years continuous service</li>
          <li className="text-sm"><strong>Calculation:</strong> (15 days × average monthly wages) × number of years of service</li>
          <li className="text-sm"><strong>Occasions:</strong> Retirement, resignation after 5 years, termination without misconduct</li>
          <li className="text-sm"><strong>Maximum:</strong> ₹20 lakhs (for service up to 33+ years)</li>
          <li className="text-sm"><strong>Tax:</strong> Gratuity is tax-free up to statutory limit</li>
        </ul>

        <h3 className="text-lg font-semibold mt-6">Severance & Notice Pay</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Notice Period:</strong> 30 days minimum for most employees; can vary by contract</li>
          <li className="text-sm"><strong>Notice Pay:</strong> One month's wages if not serving notice period</li>
          <li className="text-sm"><strong>Retrenchment Compensation:</strong> 45 days' average wages for each year of service (minimum)</li>
          <li className="text-sm"><strong>Pro-rata Gratuity:</strong> Gratuity for service less than 5 years if company has 50+ employees</li>
        </ul>

        <h3 className="text-lg font-semibold mt-6">Example Gratuity Calculation</h3>
        <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-800 text-sm font-mono">
          <p>Average Monthly Wage: ₹50,000</p>
          <p>Years of Service: 10 years</p>
          <p>Gratuity = (15 × 50,000) × 10 = ₹75,000</p>
        </div>

        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950/20 mt-6">
          <p className="text-sm"><strong>Right to Gratuity:</strong> Employees cannot waive gratuity rights. Employer cannot offset gratuity against loans or advances without consent.</p>
        </div>
      </section>

      <section id="harassment" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Workplace Rights & Harassment Protection</h2>
        <p>
          Indian law provides comprehensive protection against workplace harassment, discrimination, and unsafe conditions. The Sexual Harassment of Women at Workplace Act, 2013 specifically protects women employees.
        </p>

        <h3 className="text-lg font-semibold">Types of Workplace Harassment</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Sexual Harassment:</strong> Unwelcome sexual conduct, comments, or advances</li>
          <li className="text-sm"><strong>Gender-Based Harassment:</strong> Discrimination or mistreatment based on gender</li>
          <li className="text-sm"><strong>Caste-Based Harassment:</strong> Discrimination based on caste (illegal under SC/ST Act)</li>
          <li className="text-sm"><strong>Disability Discrimination:</strong> Unfair treatment of employees with disabilities</li>
          <li className="text-sm"><strong>Verbal Abuse:</strong> Abusive language, insults, or derogatory remarks</li>
          <li className="text-sm"><strong>Hostile Work Environment:</strong> Workplace conditions that create fear or humiliation</li>
        </ul>

        <h3 className="text-lg font-semibold mt-6">Employee Protections</h3>
        <div className="space-y-3">
          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Internal Complaint Mechanism</h4>
            <p className="text-sm text-muted-foreground mt-1">Companies must have Internal Complaints Committee (ICC) to hear harassment complaints confidentially</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Right to Complaint</h4>
            <p className="text-sm text-muted-foreground mt-1">Employees can file complaint with ICC (internal), external authority, or police without fear of retaliation</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Protection from Retaliation</h4>
            <p className="text-sm text-muted-foreground mt-1">Employer cannot take action against employees for filing complaints in good faith</p>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h4 className="font-semibold">Remedial Action</h4>
            <p className="text-sm text-muted-foreground mt-1">Employer can be directed to apologize, transfer harasser, suspension, or terminate the harasser</p>
          </div>
        </div>
      </section>

      <section id="disputes" className="mb-12 space-y-4">
        <h2 className="text-2xl font-bold">Industrial Disputes & Resolution</h2>
        <p>
          The Industrial Disputes Act, 1947 provides mechanism for resolving conflicts between employers and employees through negotiation, mediation, and industrial courts.
        </p>

        <h3 className="text-lg font-semibold">Dispute Resolution Process</h3>
        <ol className="list-inside space-y-3">
          <li className="text-sm"><strong>1. Internal Discussion:</strong> Employee raises concern with employer/HR informally</li>
          <li className="text-sm"><strong>2. Formal Complaint:</strong> If unresolved, employee files written complaint with employer and labor department</li>
          <li className="text-sm"><strong>3. Conciliation:</strong> Labor officer mediates between parties to reach settlement</li>
          <li className="text-sm"><strong>4. Arbitration (if mutual consent):</strong> Neutral arbitrator hears both sides and decides</li>
          <li className="text-sm"><strong>5. Industrial Tribunal/Court:</strong> If conciliation fails, case goes to industrial tribunal for adjudication</li>
          <li className="text-sm"><strong>6. Appeal:</strong> Dissatisfied party can appeal to High Court on points of law</li>
        </ol>

        <h3 className="text-lg font-semibold mt-6">Legal Remedies Available</h3>
        <ul className="list-inside space-y-2">
          <li className="text-sm"><strong>Reinstatement:</strong> Return to previous position with back wages</li>
          <li className="text-sm"><strong>Compensation:</strong> Monetary award for damages caused</li>
          <li className="text-sm"><strong>Promotion:</strong> If wrongfully denied</li>
          <li className="text-sm"><strong>Payment of Dues:</strong> Pending wages, gratuity, benefits</li>
          <li className="text-sm"><strong>Declaration:</strong> Court order declaring employee's right</li>
        </ul>
      </section>

      <section id="faq" className="mb-12 space-y-6">
        <h2 className="text-2xl font-bold">Frequently Asked Questions About Labour Law</h2>

        <div itemscope itemtype="https://schema.org/FAQPage">
          <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemprop="name" className="font-semibold">Can an employer terminate an employee without notice in India?</h3>
            <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
              <p itemprop="text" className="text-sm text-muted-foreground">No, employer must follow legal procedure. Except for serious misconduct, employer must give 30 days' notice or pay notice period wages. Termination without procedure is unlawful and gives employee right to compensation and reinstatement.</p>
            </div>
          </div>

          <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemprop="name" className="font-semibold">How is gratuity calculated if service is less than 5 years?</h3>
            <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
              <p itemprop="text" className="text-sm text-muted-foreground">Typically, gratuity is not payable for service less than 5 years. Exception: If company has 50+ employees, pro-rata gratuity is payable. Calculation: (Amount for 5 years) × (Months of service ÷ 60). Example: If 5-year gratuity is ₹100,000 and service is 3 years, pro-rata = 100,000 × 36/60 = ₹60,000.</p>
            </div>
          </div>

          <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemprop="name" className="font-semibold">What should I do if harassed at workplace?</h3>
            <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
              <p itemprop="text" className="text-sm text-muted-foreground">Steps: (1) Document incidents (date, time, details), (2) Inform harasser to stop in writing, (3) File complaint with company's Internal Complaints Committee or HR, (4) If no action, file complaint with external labor authority or police, (5) Seek legal help for compensation. You're protected against retaliation for filing complaints.</p>
            </div>
          </div>

          <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemprop="name" className="font-semibold">Can employer recover loan from gratuity in India?</h3>
            <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
              <p itemprop="text" className="text-sm text-muted-foreground">No, gratuity cannot be forfeited or offset against loans unless employee explicitly consents. Any clause in employment contract forfeiting gratuity is void and unenforceable. Employee has absolute right to gratuity despite any outstanding dues.</p>
            </div>
          </div>

          <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 itemprop="name" className="font-semibold">What is the minimum notice period before resignation?</h3>
            <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
              <p itemprop="text" className="text-sm text-muted-foreground">Typically 30 days for regular employees, but varies by contract and position. Senior positions may require 60-90 days. If employee doesn't serve notice, employer can deduct one month's salary or notice period salary from final settlement. Employee cannot waive this procedure.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-12 space-y-6 rounded-2xl border border-black/10 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 dark:border-white/10 dark:from-blue-950/20 dark:to-cyan-950/20 sm:p-8">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Need Expert Labour Law Help?</h2>
          <p className="text-sm text-muted-foreground">
            Employment disputes require expert legal guidance. Connect with experienced labour law advocates.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button asChild size="lg" className="rounded-full">
            <Link href="/lawyer-marketplace?area=labour">
              Find Labour Lawyer
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
