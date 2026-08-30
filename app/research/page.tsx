import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Braces,
  CheckCircle2,
  Database,
  FileSearch,
  GitCompareArrows,
  Globe2,
  Layers3,
  MapPinned,
  Scale,
  ShieldCheck,
  Sigma,
} from "lucide-react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../SiteHeader";
import {
  AMENDMENT_URL,
  FINAL_APPROVAL_URL,
  PROPOSAL_URL,
  benchmark,
} from "@/lib/demo-data";
import { ResearchHeroScene } from "./ResearchHeroScene";

export const metadata: Metadata = {
  title: "Research — VerdaTrace",
  description:
    "Methodology, public case evidence, validation design, limitations, and geospatial intelligence architecture for VerdaTrace.",
};

const ontology = [
  ["Actor", "Who is responsible for the action or evidence"],
  ["Action", "What must be done, maintained, submitted, or verified"],
  ["Object", "The parcel, habitat, report, fund, or asset affected"],
  ["Measure", "Area, quantity, unit, threshold, or duration"],
  ["Time", "Deadline, recurrence, or effective date"],
  ["Place", "Named geography or referenced spatial artifact"],
  ["Source", "Document, page, clause, and immutable fingerprint"],
  ["State", "Current, superseded, due, evidenced, or review required"],
] as const;

const benchmarkRows = [
  ["Obligation recall", "Expert-labelled obligation present in extraction", "Pending consultant review"],
  ["Field precision", "Correct values for actor, area, date, place, citation", "Pending consultant review"],
  ["Revision accuracy", "Current and superseded clauses resolved correctly", "100% on chosen demo chain"],
  ["Citation coverage", "Every demonstrated finding links to page + clause", "100% in bundled demo"],
  ["Legal-boundary safety", "No finding states guilt or non-compliance", "Rule-enforced"],
] as const;

export default function ResearchPage() {
  return (
    <main className="enterprise-page research-page">
      <SiteHeader />

      <section className="cc-research-hero">
        <ResearchHeroScene />
        <div className="cc-research-hero-grid" />
        <div className="cc-research-hero-copy">
          <span className="cc-eyebrow">
            <span>
              <BookOpenCheck size={13} />
            </span>
            Research & methodology
          </span>
          <h1>
            Evidence should survive
            <br /> every <em>change.</em>
          </h1>
          <p>
            A public research room for obligation ontology, amendment logic,
            evidence evaluation, and geospatial intelligence—built around
            claims that can be inspected.
          </p>
          <div className="cc-research-hero-actions">
            <a href="#method">
              Explore the method <ArrowRight size={15} />
            </a>
            <Link href="/demo">
              Inspect the public case <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="cc-research-position">
            <ShieldCheck size={19} />
            <div>
              <strong>Research position</strong>
              <span>
                Missing evidence is a workflow state—not a legal conclusion.
              </span>
            </div>
          </div>
        </div>
        <div className="cc-research-hero-metrics" aria-label="Research signals">
          <div>
            <strong>07</strong>
            <span>research chapters</span>
          </div>
          <div>
            <strong>{benchmark.totalLabels}</strong>
            <span>prepared obligation labels</span>
          </div>
          <div>
            <strong>100%</strong>
            <span>demo citation coverage</span>
          </div>
        </div>
        <a className="cc-research-scroll-cue" href="#problem">
          <span />
          Scroll through the evidence architecture
        </a>
      </section>

      <nav className="cc-research-index" aria-label="Research contents">
        <a href="#problem">01 · Problem</a>
        <a href="#ontology">02 · Ontology</a>
        <a href="#method">03 · Case Intelligence</a>
        <a href="#case">04 · Public case</a>
        <a href="#evaluation">05 · Evaluation</a>
        <a href="#spatial">06 · Spatial methods</a>
        <a href="#limits">07 · Limits</a>
      </nav>

      <section className="cc-research-section" id="problem">
        <div className="cc-research-number">01</div>
        <div className="cc-research-copy">
          <span className="cc-overline">Problem statement</span>
          <h2>The obligation lifecycle is structurally fragmented.</h2>
          <p className="lead">
            Environmental commitments begin as prose, change through later
            approvals, and are verified through heterogeneous evidence. Most
            workflows preserve the documents but not the relationships among
            duties, revisions, evidence, geography, and decisions.
          </p>
          <div className="cc-research-claims">
            <article>
              <FileSearch size={20} />
              <h3>Document problem</h3>
              <p>
                Conditions mix action, location, quantity, timing, and
                responsibility in long-form text and annexures.
              </p>
            </article>
            <article>
              <GitCompareArrows size={20} />
              <h3>Temporal problem</h3>
              <p>
                Later amendments may replace only one condition while preserving
                the remainder of the earlier approval.
              </p>
            </article>
            <article>
              <Layers3 size={20} />
              <h3>Evidence problem</h3>
              <p>
                Proof exists in maps, notifications, reports, photos, and field
                observations with uneven integrity metadata.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="cc-research-section alt" id="ontology">
        <div className="cc-research-number">02</div>
        <div className="cc-research-copy">
          <span className="cc-overline">Obligation ontology</span>
          <h2>A shared grammar for what must happen—and what proves it.</h2>
          <p className="lead">
            The ontology separates source-grounded facts from later
            assessments. This makes extraction measurable, revision logic
            deterministic, and human disagreement visible.
          </p>
          <div className="cc-ontology-grid">
            {ontology.map(([title, copy], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="cc-research-equation">
            <Sigma size={20} />
            <span>Obligation</span>
            <b>=</b>
            <code>
              actor + action + object + measure + time + place + source + state
            </code>
          </div>
        </div>
      </section>

      <section className="cc-research-section" id="method">
        <div className="cc-research-number">03</div>
        <div className="cc-research-copy">
          <span className="cc-overline">
            Product 01 · Case Intelligence method
          </span>
          <h2>
            How Screen 1 turns changing documents into current obligations.
          </h2>
          <p className="lead">
            VerdaTrace interprets approvals and evidence into structured
            candidates, resolves amendments through an explicit revision graph,
            and keeps consequential decisions behind expert review.
          </p>
          <div className="cc-method-stack">
            <article>
              <div>
                <span>Model layer</span>
                <Globe2 size={20} />
              </div>
              <h3>Multimodal document interpretation</h3>
              <p>
                Read digital records, scans, and field images, preserve visible
                identifiers, and return structured obligation candidates.
              </p>
              <small>
                Documents · scanned pages · field images · source citations
              </small>
            </article>
            <ArrowRight size={19} />
            <article>
              <div>
                <span>Rule layer</span>
                <Braces size={20} />
              </div>
              <h3>Schema and revision controls</h3>
              <p>
                Reject uncited outputs, normalize fields, connect replacement
                clauses, and prevent simultaneous active states.
              </p>
              <small>
                Dates · areas · clause relationships · confidence · active state
              </small>
            </article>
            <ArrowRight size={19} />
            <article>
              <div>
                <span>Human layer</span>
                <ShieldCheck size={20} />
              </div>
              <h3>Consequential review boundary</h3>
              <p>
                Experts approve, reject, or request changes before outputs enter
                an inspection or compliance workflow.
              </p>
              <small>Reviewer state · reason · audit trail roadmap</small>
            </article>
          </div>
        </div>
      </section>

      <section className="cc-research-section case" id="case">
        <div className="cc-research-number">04</div>
        <div className="cc-research-copy">
          <span className="cc-overline light">Demonstration case</span>
          <h2>Proposal FP/KA/ROAD/7440/2014</h2>
          <p className="lead">
            The case concerns forest land diversion for an approach road in
            Ballari district, Karnataka. It was selected because a later public
            amendment changes the ecological treatment of a 9.54-hectare parcel,
            creating a clear test of temporal reasoning.
          </p>
          <div className="cc-case-timeline">
            <article>
              <span>15 May 2025</span>
              <h3>Final approval</h3>
              <p>
                The approval contains project conditions including compensatory
                afforestation treatment for the identified parcel.
              </p>
              <a href={FINAL_APPROVAL_URL} target="_blank" rel="noreferrer">
                Open public PDF <ArrowUpRight size={13} />
              </a>
            </article>
            <div>
              <GitCompareArrows size={20} />
              <span>replacement condition</span>
            </div>
            <article className="current">
              <span>03 September 2025</span>
              <h3>Amendment</h3>
              <p>
                The parcel is instead to be conserved for natural growth and
                wildlife habitat; unchanged conditions continue.
              </p>
              <a href={AMENDMENT_URL} target="_blank" rel="noreferrer">
                Open public PDF <ArrowUpRight size={13} />
              </a>
            </article>
          </div>
          <div className="cc-case-source">
            <Database size={18} />
            <div>
              <strong>Proposal and spatial record index</strong>
              <span>
                The source portal provides project records and a KML entry point.
                The demo does not invent the amended parcel boundary when the
                precise geometry is absent from the review set.
              </span>
            </div>
            <a href={PROPOSAL_URL} target="_blank" rel="noreferrer">
              View portal <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      </section>

      <section className="cc-research-section" id="evaluation">
        <div className="cc-research-number">05</div>
        <div className="cc-research-copy">
          <span className="cc-overline">Evaluation design</span>
          <h2>Measured claims only.</h2>
          <p className="lead">
            The bundled gold set contains {benchmark.totalLabels} prepared
            obligation labels. Consultant review remains outstanding, so
            precision and recall are deliberately unpublished.
          </p>
          <div className="cc-benchmark-table">
            <div className="head">
              <span>Metric</span>
              <span>Definition</span>
              <span>Current evidence</span>
            </div>
            {benchmarkRows.map(([metric, definition, result]) => (
              <div key={metric}>
                <strong>{metric}</strong>
                <span>{definition}</span>
                <span>{result}</span>
              </div>
            ))}
          </div>
          <div className="cc-validation-note">
            <AlertTriangle size={18} />
            <p>{benchmark.note}</p>
          </div>
        </div>
      </section>

      <section className="cc-research-section alt" id="spatial">
        <div className="cc-research-number">06</div>
        <div className="cc-research-copy">
          <span className="cc-overline">
            Products 02 + 03 · Spatial methods
          </span>
          <h2>How spatial observations become review-ready evidence.</h2>
          <p className="lead">
            Both spatial products begin with verified project geometry. One
            measures interpretable land-cover change; the other is a calibrated
            research track for finding comparable landscapes and unusual
            change. Neither converts a remote observation into a legal or
            ecological conclusion.
          </p>
          <div className="cc-spatial-roadmap">
            <article>
              <span>Foundation</span>
              <MapPinned size={22} />
              <h3>Source geometry</h3>
              <p>
                Polygon validation, coordinate checks, area limits, geometry
                fingerprinting, and explicit missing-boundary states.
              </p>
            </article>
            <article>
              <span>Operational</span>
              <Layers3 size={22} />
              <h3>Dynamic World Spatial Evidence</h3>
              <p>
                Ten-metre annual land-cover probabilities, confidence-aware
                area statistics, and baseline-versus-current change signals.
              </p>
            </article>
            <article>
              <span>Research track</span>
              <Globe2 size={22} />
              <h3>AlphaEarth Similarity Intelligence</h3>
              <p>
                Annual parcel representations for comparable-site retrieval,
                historical deviation, and expert-calibrated anomaly ranking.
              </p>
            </article>
          </div>

          <div className="cc-spatial-method-grid">
            <article>
              <header>
                <span>Product 02 · Operational method</span>
                <Layers3 size={24} />
                <h3>Dynamic World Spatial Evidence</h3>
                <p>
                  Converts a verified project boundary and two selected years
                  into a transparent, nine-class land-cover comparison.
                </p>
              </header>
              <ol>
                <li>
                  <b>01</b>
                  <div>
                    <strong>Validate the analysis boundary</strong>
                    <p>
                      Accept only area geometry, normalize coordinates, check
                      vertices and area, and retain a geometry fingerprint for
                      the result.
                    </p>
                  </div>
                </li>
                <li>
                  <b>02</b>
                  <div>
                    <strong>Build annual probability composites</strong>
                    <p>
                      Combine the available observations for each year into a
                      ten-metre median probability surface across nine
                      land-cover classes.
                    </p>
                  </div>
                </li>
                <li>
                  <b>03</b>
                  <div>
                    <strong>Separate confidence from classification</strong>
                    <p>
                      Assign a class only when the strongest probability clears
                      the selected threshold. Report uncertain pixels
                      separately instead of forcing a label.
                    </p>
                  </div>
                </li>
                <li>
                  <b>04</b>
                  <div>
                    <strong>Measure and compare</strong>
                    <p>
                      Sum pixel area for every class, calculate parcel
                      percentages, subtract baseline from current, and rank
                      changes by magnitude.
                    </p>
                  </div>
                </li>
              </ol>
              <footer>
                <strong>Result</strong>
                <span>
                  Nine-class area table · coverage · uncertainty · acquisition
                  period · change signals
                </span>
              </footer>
            </article>

            <article>
              <header>
                <span>Product 03 · Calibration method</span>
                <Globe2 size={24} />
                <h3>AlphaEarth Similarity Intelligence</h3>
                <p>
                  Turns each project area into an annual landscape
                  representation that can be compared with its own history and
                  a relevant reference pool.
                </p>
              </header>
              <ol>
                <li>
                  <b>01</b>
                  <div>
                    <strong>Create an annual parcel representation</strong>
                    <p>
                      Aggregate the multidimensional signal inside the verified
                      boundary while retaining the year, coverage, and geometry
                      context.
                    </p>
                  </div>
                </li>
                <li>
                  <b>02</b>
                  <div>
                    <strong>Construct a defensible comparison pool</strong>
                    <p>
                      Restrict candidate sites by comparable geography,
                      ecological setting, observation quality, and project
                      context before similarity is calculated.
                    </p>
                  </div>
                </li>
                <li>
                  <b>03</b>
                  <div>
                    <strong>Retrieve peers and measure deviation</strong>
                    <p>
                      Rank nearby representations by vector similarity, then
                      compare the current parcel with its historical baseline
                      and matched peers.
                    </p>
                  </div>
                </li>
                <li>
                  <b>04</b>
                  <div>
                    <strong>Calibrate before showing risk</strong>
                    <p>
                      Experts label useful and misleading matches, validate
                      thresholds, and review the underlying imagery before any
                      anomaly becomes an inspection signal.
                    </p>
                  </div>
                </li>
              </ol>
              <footer>
                <strong>Planned result</strong>
                <span>
                  Comparable sites · similarity ranking · historical deviation
                  · calibration state
                </span>
              </footer>
            </article>
          </div>
        </div>
      </section>

      <section className="cc-research-section limits" id="limits">
        <div className="cc-research-number">07</div>
        <div className="cc-research-copy">
          <span className="cc-overline light">Limitations & safeguards</span>
          <h2>What the system does not claim.</h2>
          <div className="cc-limit-grid">
            <article>
              <Scale size={20} />
              <strong>No legal determination</strong>
              <p>
                Evidence gaps are triage signals. They are not proof of
                non-compliance, negligence, or ecological harm.
              </p>
            </article>
            <article>
              <MapPinned size={20} />
              <strong>No invented geography</strong>
              <p>
                Approximate locations are labelled. Missing parcels remain
                missing until a valid spatial artifact is supplied.
              </p>
            </article>
            <article>
              <CheckCircle2 size={20} />
              <strong>No unreviewed benchmark claim</strong>
              <p>
                Prepared labels are not presented as expert-validated accuracy
                until an external reviewer confirms them.
              </p>
            </article>
          </div>
          <div className="cc-research-actions">
            <Link href="/demo">
              Inspect the public case <ArrowRight size={15} />
            </Link>
            <Link href="/contact">
              Discuss a validation partnership <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
