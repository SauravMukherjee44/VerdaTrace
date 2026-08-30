import type { Metadata } from "next";
import { Mail, ShieldCheck } from "lucide-react";
import { SiteFooter, SiteHeader } from "../SiteHeader";

export const metadata: Metadata = {
  title: "Privacy — VerdaTrace",
  description:
    "How VerdaTrace handles uploaded materials, browser-stored workspace context, contact inquiries, rate limits, and administrator sessions.",
};

const effectiveDate = "1 August 2026";

export default function PrivacyPage() {
  return (
    <main className="enterprise-page legal-page">
      <SiteHeader />

      <header className="cc-legal-hero">
        <div>
          <span className="cc-overline">Privacy at VerdaTrace</span>
          <h1>Your evidence should remain under your control.</h1>
          <p>
            This notice explains what VerdaTrace collects, why it is used, and
            the choices available when you use our website, public demo, and
            contact services.
          </p>
        </div>
        <div className="cc-legal-summary">
          <ShieldCheck size={24} />
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
        <aside aria-label="Privacy page contents">
          <span>On this page</span>
          <a href="#information">Information we process</a>
          <a href="#uploads">Documents and images</a>
          <a href="#browser">Browser storage and cookies</a>
          <a href="#providers">Service providers</a>
          <a href="#retention">Retention and security</a>
          <a href="#rights">Your choices</a>
        </aside>

        <article className="cc-legal-content">
          <section id="information">
            <span>01</span>
            <h2>Information we process</h2>
            <p>
              VerdaTrace processes information that you deliberately provide,
              information needed to operate the service, and device-local
              workspace context.
            </p>
            <ul>
              <li>
                <strong>Project materials:</strong> documents, images, text,
                maps, and project context submitted for analysis.
              </li>
              <li>
                <strong>Contact inquiries:</strong> your name, work email,
                organization, role, inquiry type, and message.
              </li>
              <li>
                <strong>Demo activity:</strong> analysis results, chat context,
                selected filters, generated tasks, reviewer interactions, and
                remaining demo allowance stored on your device.
              </li>
              <li>
                <strong>Operational data:</strong> pseudonymous request
                counters used to protect the public service from abuse.
              </li>
              <li>
                <strong>Workflow identity and audit data:</strong> a verified
                Google account, workflow definitions, run events, approvals,
                artifact metadata, and workspace versions for signed-in pilot
                users.
              </li>
            </ul>
          </section>

          <section id="uploads">
            <span>02</span>
            <h2>Documents, images, and analysis</h2>
            <p>
              The public Screen 1 and Screen 2 demo processes original files in
              memory and does not persist those original uploads in its
              application database. If a signed-in pilot user explicitly starts
              a durable Screen 3 workflow, source files and geometry are
              encrypted before temporary blob storage and deleted seven days
              after the run completes. Raw content is never placed in database
              rows or browser storage. Structured results, integrity hashes,
              audit events, approvals, workspace versions, and generated reports
              remain until the user deletes them or an applicable pilot agreement
              provides otherwise.
            </p>
            <p>
              Do not upload materials you are not authorized to use. Avoid
              submitting unnecessary personal data, confidential information,
              or sensitive records to the public demo.
            </p>
          </section>

          <section id="browser">
            <span>03</span>
            <h2>Browser storage and administrator cookies</h2>
            <p>
              The public demo uses local browser storage for workspace
              continuity. This can include extracted findings, conversations,
              filters, tasks, and the locally displayed rate-limit state. The
              information remains on that browser until it is replaced or you
              clear the site&apos;s browser data.
            </p>
            <p>
              Administrator sign-in uses a signed, HttpOnly, SameSite Strict
              session cookie. The cookie is used only for authentication and
              expires after eight hours. VerdaTrace does not currently use
              advertising cookies, advertising trackers, or marketing
              analytics.
            </p>
            <p>
              Signed-in workflow pilots use a signed, HttpOnly session cookie.
              Device-local storage is limited to preferences, tour state, and
              recorded-sample replay state; existing local workspaces are not
              silently uploaded into a durable workflow.
            </p>
          </section>

          <section id="providers">
            <span>04</span>
            <h2>Infrastructure and AI service providers</h2>
            <p>
              VerdaTrace uses contracted hosting, database, security, and AI
              infrastructure providers to deliver the service. Submitted
              materials may be transmitted to those providers when required to
              complete an analysis, operate rate limits, store an inquiry, or
              secure the platform.
            </p>
            <p>
              Google account identity is requested separately from optional
              Gmail or Drive access. Integration permissions are requested only
              when the user connects that capability. Refresh tokens are
              encrypted server-side and deleted when the connection is revoked.
              Gmail delivery, Drive upload, and signed webhooks remain subject
              to a visible human approval step.
            </p>
            <p>
              We do not sell personal information. We do not use submitted
              project materials for advertising.
            </p>
          </section>

          <section id="retention">
            <span>05</span>
            <h2>Retention and security</h2>
            <p>
              Contact inquiries are retained while reasonably necessary to
              respond, manage the requested relationship, and maintain
              operational records. Pseudonymous rate-limit counters are kept as
              operational records; the application counter does not store your
              raw IP address. Device-local workspace data follows your
              browser&apos;s storage lifecycle.
            </p>
            <p>
              Durable workflow source files and raw parcel geometry have a
              seven-day post-completion retention deadline. Generated reports,
              structured project results, and approval audit records remain
              available to the signed-in owner until deletion.
            </p>
            <p>
              We use access controls, request limits, signed sessions, and
              server-side secrets to reduce risk. No online system can promise
              absolute security, and the public demo should not be treated as a
              repository for highly sensitive information.
            </p>
          </section>

          <section id="rights">
            <span>06</span>
            <h2>Your choices and requests</h2>
            <p>
              You can clear demo workspace context through your browser
              settings. You may also request access to, correction of, or
              deletion of personal information held by VerdaTrace by emailing{" "}
              <a href="mailto:privacy@verdatrace.com">
                privacy@verdatrace.com
              </a>
              . We may need to verify your identity before completing a request.
            </p>
            <p>
              VerdaTrace is not directed to children under 18, and we do not
              knowingly collect their personal information. We may update this
              notice as the product and applicable requirements evolve. A
              revised effective date will be shown on this page.
            </p>
          </section>
        </article>
      </div>

      <SiteFooter />
    </main>
  );
}
