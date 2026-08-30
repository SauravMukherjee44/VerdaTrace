import type { Metadata } from "next";
import { FileCheck2, Mail, ShieldCheck } from "lucide-react";
import { SiteFooter, SiteHeader } from "../SiteHeader";

export const metadata: Metadata = {
  title: "Terms — VerdaTrace",
  description:
    "Terms governing the VerdaTrace website, public demonstration, administrator access, generated findings, and project materials.",
};

const effectiveDate = "1 August 2026";

export default function TermsPage() {
  return (
    <main className="enterprise-page legal-page">
      <SiteHeader />

      <header className="cc-legal-hero">
        <div>
          <span className="cc-overline">Terms of use</span>
          <h1>Review support with a clear human decision boundary.</h1>
          <p>
            These terms govern access to the VerdaTrace website, public demo,
            administrator workspace, and associated analysis and reporting
            features.
          </p>
        </div>
        <div className="cc-legal-summary">
          <FileCheck2 size={24} />
          <strong>Operator</strong>
          <span>VerdaTrace, India</span>
          <strong>Effective date</strong>
          <time dateTime="2026-08-01">{effectiveDate}</time>
          <a href="mailto:privacy@verdatrace.com">
            <Mail size={14} /> privacy@verdatrace.com
          </a>
        </div>
      </header>

      <div className="cc-legal-layout">
        <aside aria-label="Terms page contents">
          <span>On this page</span>
          <a href="#acceptance">Acceptance</a>
          <a href="#use">Permitted use</a>
          <a href="#materials">Your materials</a>
          <a href="#decisions">AI and human review</a>
          <a href="#ownership">Ownership</a>
          <a href="#disclaimers">Disclaimers</a>
          <a href="#law">Applicable law</a>
        </aside>

        <article className="cc-legal-content">
          <section id="acceptance">
            <span>01</span>
            <h2>Acceptance and service availability</h2>
            <p>
              By accessing VerdaTrace, you agree to these terms and our Privacy
              Notice. If you use the service for an organization, you represent
              that you are authorized to act for that organization.
            </p>
            <p>
              The public demo is provided for evaluation and research. Features
              may be changed, limited, suspended, or withdrawn as the platform
              evolves.
            </p>
          </section>

          <section id="use">
            <span>02</span>
            <h2>Permitted use and service protection</h2>
            <p>
              You may use VerdaTrace for lawful environmental review,
              evaluation, research, and authorized project work. You must not:
            </p>
            <ul>
              <li>Upload material you are not authorized to process.</li>
              <li>
                Attempt to bypass rate limits, authentication, or access
                controls.
              </li>
              <li>
                Probe, disrupt, scrape, overload, reverse engineer, or misuse
                the service or its interfaces.
              </li>
              <li>
                Misrepresent generated findings as a regulatory verdict or
                approved expert conclusion.
              </li>
              <li>
                Use the service to violate law, privacy, intellectual-property
                rights, or contractual duties.
              </li>
            </ul>
            <p>
              Administrator credentials are confidential and may only be used
              by the person or organization to whom they were issued.
            </p>
          </section>

          <section id="materials">
            <span>03</span>
            <h2>User-provided and public-source materials</h2>
            <p>
              You retain your rights in materials you provide. You grant
              VerdaTrace the limited permission needed to transmit, process,
              temporarily store, structure, and display those materials to
              provide the requested service. Signed-in durable workflows use
              encrypted temporary source storage with the retention described
              in the Privacy Notice.
            </p>
            <p>
              Public demonstration records remain attributable to their
              original public sources. VerdaTrace does not claim ownership of
              those source records. You are responsible for confirming that
              your use of any public or third-party material is lawful and
              appropriate.
            </p>
          </section>

          <section id="decisions">
            <span>04</span>
            <h2>AI-assisted findings and human review</h2>
            <div className="cc-legal-callout">
              <ShieldCheck size={20} />
              <div>
                <strong>No automated legal or regulatory determination</strong>
                <p>
                  VerdaTrace identifies obligations, evidence coverage, change
                  signals, and review priorities. It does not determine guilt,
                  legal compliance, permit validity, or regulatory approval.
                </p>
              </div>
            </div>
            <p>
              Generated content may be incomplete, inaccurate, or unsuitable
              for a particular project. Consequential findings require review
              by a qualified professional using the underlying source
              materials. You remain responsible for decisions and actions taken
              from VerdaTrace output.
            </p>
            <p>
              Applying proposed project changes, finalizing an approved report,
              and delivering material through Gmail, Drive, or a webhook each
              require an explicit recorded decision. You are responsible for
              verifying recipients, destinations, links, and payload summaries
              before approving an external action.
            </p>
          </section>

          <section id="ownership">
            <span>05</span>
            <h2>VerdaTrace ownership</h2>
            <p>
              VerdaTrace and its licensors retain rights in the platform,
              software, interface, workflows, reports, visual design,
              trademarks, and branding, excluding user-provided and
              public-source materials. These terms do not transfer ownership or
              grant a right to reproduce the platform or branding.
            </p>
          </section>

          <section id="disclaimers">
            <span>06</span>
            <h2>Disclaimers and limitation of liability</h2>
            <p>
              The service is provided on an “as available” basis without a
              guarantee that extracted information is complete, current,
              uninterrupted, error-free, or legally sufficient. To the maximum
              extent permitted by applicable law, VerdaTrace disclaims implied
              warranties and is not liable for indirect, incidental, special,
              consequential, or punitive losses arising from use of the
              service.
            </p>
            <p>
              Nothing in these terms excludes liability that cannot lawfully be
              excluded. If a separate written pilot or commercial agreement
              applies, that agreement controls where it conflicts with these
              public terms.
            </p>
          </section>

          <section id="law">
            <span>07</span>
            <h2>Changes, applicable law, and contact</h2>
            <p>
              We may update these terms as VerdaTrace evolves. Continued use
              after an updated effective date means the revised terms apply to
              subsequent use. These terms are governed by the applicable laws
              of India, without limiting any mandatory rights available under
              applicable law.
            </p>
            <p>
              Questions about these terms can be sent to{" "}
              <a href="mailto:privacy@verdatrace.com">
                privacy@verdatrace.com
              </a>
              .
            </p>
          </section>
        </article>
      </div>

      <SiteFooter />
    </main>
  );
}
