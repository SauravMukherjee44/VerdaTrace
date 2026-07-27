import type { Metadata } from "next";
import {
  ArrowRight,
  Building2,
  Clock3,
  FileSearch,
  FlaskConical,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../SiteHeader";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact — VerdaTrace",
  description:
    "Discuss a pilot, research collaboration, regulator workflow, or accelerator partnership with VerdaTrace.",
};

export default function ContactPage() {
  return (
    <main className="enterprise-page contact-page">
      <SiteHeader />
      <section className="cc-contact-hero">
        <div className="cc-contact-copy">
          <span className="cc-eyebrow">
            <span>
              <Sparkles size={13} />
            </span>
            Start with one real workflow
          </span>
          <h1>Let&apos;s make environmental review more actionable.</h1>
          <p>
            We are looking for consultants, project teams, regulators, funders,
            and research partners who can validate VerdaTrace against real
            evidence workflows.
          </p>
          <div className="cc-contact-paths">
            <article>
              <Building2 size={20} />
              <div>
                <strong>Pilot a project</strong>
                <span>Bring an approval set and a real review bottleneck.</span>
              </div>
            </article>
            <article>
              <FlaskConical size={20} />
              <div>
                <strong>Validate the research</strong>
                <span>Help label obligations or assess geospatial signals.</span>
              </div>
            </article>
            <article>
              <FileSearch size={20} />
              <div>
                <strong>Shape a workflow</strong>
                <span>Map reviewer decisions, evidence standards, and handoffs.</span>
              </div>
            </article>
          </div>
          <div className="cc-response-note">
            <Clock3 size={16} />
            <span>
              <strong>Best first message</strong>
              Include your document types, geography, project volume, and who
              reviews the findings.
            </span>
          </div>
        </div>
        <div className="cc-contact-panel">
          <div className="cc-contact-panel-head">
            <div>
              <span className="cc-overline">Partnership inquiry</span>
              <h2>Tell us what evidence must become actionable.</h2>
            </div>
            <ShieldCheck size={22} />
          </div>
          <ContactForm />
        </div>
      </section>
      <section className="cc-contact-bottom">
        <div>
          <span className="cc-overline">Prefer to explore first?</span>
          <h2>Walk through the complete public case.</h2>
        </div>
        <Link href="/demo">
          Open the demonstration <ArrowRight size={16} />
        </Link>
      </section>
      <SiteFooter />
    </main>
  );
}
