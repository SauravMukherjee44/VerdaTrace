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
        <div className="cc-research-hero-grid" />
        <div className="cc-research-hero-copy">
          <span className="cc-eyebrow">
            <span>
              <BookOpenCheck size={13} />
            </span>
            Research & methodology
          </span>
          <h1>
            An evidence architecture
            <br />
            for ecological obligations.
          </h1>
          <p>
            This research room documents the problem framing, ontology,
            amendment logic, evaluation design, spatial intelligence
            architecture, and explicit limits behind VerdaTrace.
          </p>
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
        <figure className="cc-research-hero-banner">
          <img
            src="/brand/verdatrace/banner-enterprise.webp"
            width="1672"
            height="941"
            alt="VerdaTrace connects environmental approvals, evidence, maps, and reviewed action."
          />
        </figure>
      </section>

      <nav className="cc-research-index" aria-label="Research contents">
        <a href="#problem">01 · Problem</a>
        <a href="#ontology">02 · Ontology</a>
        <a href="#method">03 · Method</a>
        <a href="#case">04 · Public case</a>
        <a href="#evaluation">05 · Evaluation</a>
        <a href="#spatial">06 · Spatial intelligence</a>
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
          <span className="cc-overline">System method</span>
          <h2>Probabilistic reading, deterministic boundaries.</h2>
          <p className="lead">
            VerdaTrace Intelligence handles multimodal document understanding
            and structured extraction. Rules handle the conditions where a
            plausible automated answer is not sufficient.
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
              <small>VerdaTrace Intelligence · multimodal input · schema controls</small>
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
              <small>Zod · dates · area · supersession · confidence</small>
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
          <span className="cc-overline">Geospatial intelligence architecture</span>
          <h2>Evidence layers without false precision.</h2>
          <p className="lead">
            VerdaTrace anchors spatial analysis to documented geometry and
            treats missing boundaries as evidence gaps. Remote-sensing layers
            enter operational workflows through reproducible methods,
            project-level calibration, and expert-reviewed thresholds.
          </p>
          <div className="cc-spatial-roadmap">
            <article>
              <span>Foundation</span>
              <MapPinned size={22} />
              <h3>Source geometry</h3>
              <p>KML/GeoJSON validation, area discrepancy flags, and explicit gaps.</p>
            </article>
            <article>
              <span>Integration ready</span>
              <Layers3 size={22} />
              <h3>Dynamic World</h3>
              <p>Ten-metre land-cover probabilities, temporal baselines, and interpretable change signals.</p>
            </article>
            <article>
              <span>Calibration track</span>
              <Globe2 size={22} />
              <h3>AlphaEarth</h3>
              <p>Annual landscape embeddings for site similarity, anomaly ranking, and sparse-label modelling.</p>
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
