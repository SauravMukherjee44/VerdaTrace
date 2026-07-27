import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  ChevronRight,
  CircleDot,
  FileCheck2,
  FileSearch,
  Fingerprint,
  GitCompareArrows,
  Globe2,
  Layers3,
  MapPinned,
  Network,
  Radar,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Trees,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "./SiteHeader";

const stages = [
  ["01", "Extract", "Obligations + citations", FileSearch],
  ["02", "Resolve", "Amendments + precedence", GitCompareArrows],
  ["03", "Link", "Evidence + geography", Network],
  ["04", "Assess", "Coverage + uncertainty", ScanSearch],
  ["05", "Act", "Inspection priorities", MapPinned],
] as const;

const moat = [
  {
    icon: GitCompareArrows,
    label: "Revision intelligence",
    title: "A living obligation graph",
    copy: "Conditions are versioned as a connected system. Replacements supersede old requirements without erasing their history.",
    signal: "Clause → revision → current duty",
  },
  {
    icon: Fingerprint,
    label: "Evidence provenance",
    title: "Traceability by construction",
    copy: "Every finding carries its document, page, clause, evidence links, model confidence, and reviewer state.",
    signal: "Zero uncited findings in the demo",
  },
  {
    icon: Radar,
    label: "Spatial readiness",
    title: "Honest geometry, useful gaps",
    copy: "Available boundaries and evidence are mapped. Missing geometry is a first-class risk signal—not a polygon the model invents.",
    signal: "KML + GeoJSON + Earth Engine roadmap",
  },
  {
    icon: ShieldCheck,
    label: "Bounded agency",
    title: "AI proposes. Experts decide.",
    copy: "Small agents produce structured handoffs while deterministic rules protect dates, quantities, revisions, and legal boundaries.",
    signal: "Consequential outputs require approval",
  },
] as const;

export function MarketingHome() {
  return (
    <main className="enterprise-page">
      <SiteHeader />

      <section className="cc-hero">
        <div className="cc-ambient cc-ambient-one" />
        <div className="cc-ambient cc-ambient-two" />
        <div className="cc-hero-grid" />
        <div className="cc-hero-copy">
          <div className="cc-eyebrow">
            <span>
              <Sparkles size={13} />
            </span>
            AI-native environmental accountability
          </div>
          <h1>
            Every ecological
            <br />
            obligation,
            <br />
            <em>traceable.</em>
          </h1>
          <p>
            VerdaTrace turns environmental approvals, amendments, maps, and
            field evidence into source-cited obligations and prioritized
            action.
          </p>
          <div className="cc-hero-actions">
            <Link className="cc-cta-primary" href="/demo">
              Explore the live case <ArrowRight size={17} />
            </Link>
            <Link className="cc-cta-secondary" href="/research">
              Read the research <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="cc-hero-assurance">
            <span>
              <Check size={13} /> Clause-level citations
            </span>
            <span>
              <Check size={13} /> Human-reviewed decisions
            </span>
            <span>
              <Check size={13} /> No fabricated geometry
            </span>
          </div>
        </div>

        <div className="cc-hero-visual">
          <img
            src="/brand/verdatrace/hero-product-transparent.png"
            width="1672"
            height="941"
            fetchPriority="high"
            alt="VerdaTrace obligation ledger connected to approval documents, amendment history, project mapping, inspection priorities, and human review."
          />
        </div>
      </section>

      <section className="cc-context-bar">
        <span>Designed for evidence-heavy environmental workflows</span>
        <div>
          <strong>Forest clearance</strong>
          <i />
          <strong>Biodiversity offsets</strong>
          <i />
          <strong>Restoration finance</strong>
          <i />
          <strong>Infrastructure permits</strong>
        </div>
      </section>

      <section className="cc-problem-section">
        <div className="cc-section-intro">
          <span className="cc-overline">The accountability gap</span>
          <h2 className="cc-problem-headline">
            A promise is not proof.
            <br />
            <span>Make every obligation traceable.</span>
          </h2>
          <p>
            Reviewers reconstruct the same chain repeatedly—across long PDFs,
            later amendments, maps, inspection notes, and disconnected proof.
            The result is slow review and broad field work with little shared
            memory.
          </p>
        </div>
        <div className="cc-fracture-grid">
          <article>
            <span>01</span>
            <FileSearch size={23} />
            <h3>Conditions are buried</h3>
            <p>
              Quantities, deadlines, responsible parties, and locations sit
              across pages and annexures.
            </p>
            <small>Approval documents</small>
          </article>
          <article>
            <span>02</span>
            <GitCompareArrows size={23} />
            <h3>Amendments break continuity</h3>
            <p>
              Replacement clauses can remain active beside the wording they
              superseded.
            </p>
            <small>Revision drift</small>
          </article>
          <article>
            <span>03</span>
            <Layers3 size={23} />
            <h3>Evidence stays fragmented</h3>
            <p>
              Reports, notifications, field photos, and geometry have no common
              obligation index.
            </p>
            <small>Evidence silos</small>
          </article>
          <article>
            <span>04</span>
            <TimerReset size={23} />
            <h3>Inspections start too broad</h3>
            <p>
              Teams visit without a ranked set of unresolved, high-value
              verification questions.
            </p>
            <small>Review cost</small>
          </article>
        </div>
      </section>

      <section className="cc-video-section" aria-labelledby="intro-video-title">
        <div className="cc-video-copy">
          <span className="cc-overline">Meet VerdaTrace</span>
          <h2 id="intro-video-title">
            See how ecological promises become traceable action.
          </h2>
          <p>
            A short introduction to the obligation ledger, amendment-aware
            reasoning, evidence mapping, and human review behind VerdaTrace.
          </p>
          <div className="cc-video-sound-note">
            <Volume2 size={18} />
            <span>
              <strong>This video includes audio.</strong>
              Press play and turn your sound on for the full introduction.
            </span>
          </div>
        </div>
        <div className="cc-video-frame">
          <div className="cc-video-frame-top">
            <span>
              <i /> VerdaTrace introduction
            </span>
            <small>Press play · sound on</small>
          </div>
          <video
            controls
            playsInline
            preload="metadata"
            poster="/media/verdatrace-introduction-poster.jpg"
            aria-label="VerdaTrace introductory video with audio"
          >
            <source
              src="/media/verdatrace-introduction.mp4"
              type="video/mp4"
            />
            Your browser does not support embedded video playback.
          </video>
        </div>
      </section>

      <section className="cc-platform-section" id="platform">
        <div className="cc-platform-heading">
          <div>
            <span className="cc-overline light">The VerdaTrace system</span>
            <h2>From document archive to accountable action.</h2>
          </div>
          <p>
            Five bounded agents produce a structured, inspectable handoff. Rules
            and reviewers control the points where errors would matter most.
          </p>
        </div>
        <div className="cc-agent-pipeline">
          {stages.map(([number, title, copy, Icon], index) => (
            <article key={number}>
              <div className="cc-stage-icon">
                <Icon size={19} />
                <span>{number}</span>
              </div>
              <strong>{title}</strong>
              <p>{copy}</p>
              {index < stages.length - 1 && (
                <ChevronRight className="cc-stage-arrow" size={18} />
              )}
            </article>
          ))}
          <div className="cc-pipeline-line">
            <span />
          </div>
        </div>
        <div className="cc-platform-proof">
          <div className="cc-proof-copy">
            <span className="cc-overline">Public demonstration case</span>
            <h3>See the obligation chain, not another generic dashboard.</h3>
            <p>
              The demo uses real public records for a Karnataka forest-clearance
              proposal. It shows how an amendment changes the treatment of a
              9.54-hectare parcel while every unchanged condition remains in
              force.
            </p>
            <ul>
              <li>
                <FileCheck2 size={15} /> 25 structured ledger entries
              </li>
              <li>
                <GitCompareArrows size={15} /> Correct supersession chain
              </li>
              <li>
                <MapPinned size={15} /> Explicit spatial evidence gap
              </li>
              <li>
                <ShieldCheck size={15} /> Human approval controls
              </li>
            </ul>
            <Link href="/demo">
              Open the case workspace <ArrowRight size={15} />
            </Link>
          </div>
          <div className="cc-proof-console">
            <div className="cc-console-head">
              <span>
                <i /> Evidence coverage
              </span>
              <small>Updated from public record set</small>
            </div>
            <div className="cc-coverage-ring">
              <div>
                <strong>2%</strong>
                <span>evidence coverage</span>
              </div>
            </div>
            <div className="cc-proof-bars">
              <div>
                <span>Missing evidence</span>
                <b>13</b>
                <i style={{ "--bar": "81%" } as React.CSSProperties} />
              </div>
              <div>
                <span>Expert review</span>
                <b>7</b>
                <i style={{ "--bar": "49%" } as React.CSSProperties} />
              </div>
              <div>
                <span>Not yet due</span>
                <b>2</b>
                <i style={{ "--bar": "22%" } as React.CSSProperties} />
              </div>
            </div>
            <div className="cc-console-foot">
              <Radar size={16} />
              Geometry gap: amended parcel boundary unavailable
            </div>
          </div>
        </div>
      </section>

      <section className="cc-moat-section">
        <div className="cc-section-intro compact">
          <span className="cc-overline">Why this compounds</span>
          <h2>A defensible intelligence layer for ecological obligations.</h2>
          <p>
            The product advantage is not document summarization. It is the
            accumulated graph connecting obligations, revisions, evidence,
            geography, decisions, and field outcomes.
          </p>
        </div>
        <div className="cc-moat-grid">
          {moat.map(({ icon: Icon, label, title, copy, signal }) => (
            <article key={title}>
              <div>
                <Icon size={21} />
                <span>{label}</span>
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <small>
                <CircleDot size={12} /> {signal}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section className="cc-governance-section" id="governance">
        <div className="cc-governance-visual">
          <div className="cc-governance-core">
            <ShieldCheck size={30} />
            <strong>Human decision boundary</strong>
            <span>No automated legal verdict</span>
          </div>
          <div className="cc-orbit orbit-one">
            <span>Source citations</span>
          </div>
          <div className="cc-orbit orbit-two">
            <span>Schema validation</span>
          </div>
          <div className="cc-orbit orbit-three">
            <span>Reviewer approval</span>
          </div>
        </div>
        <div className="cc-governance-copy">
          <span className="cc-overline light">Enterprise controls</span>
          <h2>Built for reviewable decisions, not opaque automation.</h2>
          <p>
            Consequential findings remain proposals until an expert approves
            them. Missing evidence is never converted into a guilt or
            non-compliance claim.
          </p>
          <div className="cc-control-list">
            <article>
              <Braces size={18} />
              <div>
                <strong>Structured outputs</strong>
                <span>Zod validation and deterministic field rules</span>
              </div>
            </article>
            <article>
              <Fingerprint size={18} />
              <div>
                <strong>Source integrity</strong>
                <span>Document hash, page, clause, and evidence provenance</span>
              </div>
            </article>
            <article>
              <ShieldCheck size={18} />
              <div>
                <strong>Controlled access</strong>
                <span>Rate-limited public demo and secure admin sessions</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="cc-sector-section">
        <div className="cc-section-intro compact">
          <span className="cc-overline">One obligation model, many mandates</span>
          <h2>Start with forest clearance. Expand across nature risk.</h2>
        </div>
        <div className="cc-sector-grid">
          <article>
            <Trees size={22} />
            <span>01</span>
            <h3>Compensatory afforestation</h3>
            <p>Approval conditions, plantation evidence, and inspection planning.</p>
          </article>
          <article>
            <Globe2 size={22} />
            <span>02</span>
            <h3>Biodiversity offsets</h3>
            <p>Habitat commitments, monitoring plans, and outcome evidence.</p>
          </article>
          <article>
            <MapPinned size={22} />
            <span>03</span>
            <h3>Infrastructure permits</h3>
            <p>Location-bound mitigation duties across long project lifecycles.</p>
          </article>
          <article>
            <Network size={22} />
            <span>04</span>
            <h3>Nature-finance portfolios</h3>
            <p>Comparable evidence coverage across projects, partners, and sites.</p>
          </article>
        </div>
      </section>

      <section className="cc-research-cta">
        <div>
          <span className="cc-overline light">Research before rhetoric</span>
          <h2>Explore the methodology, limitations, and public source chain.</h2>
          <p>
            Read how the obligation ontology works, what the current benchmark
            does and does not prove, and where AlphaEarth and Dynamic World fit
            into the validation roadmap.
          </p>
        </div>
        <Link href="/research">
          Open the research room <ArrowUpRight size={18} />
        </Link>
      </section>

      <section className="cc-final-cta">
        <div className="cc-final-grid" />
        <div>
          <span className="cc-overline">Make the next inspection count</span>
          <h2>Bring one project. Leave with a traceable review plan.</h2>
          <p>
            Start with the public case or discuss a partner-reviewed pilot for
            your environmental workflow.
          </p>
        </div>
        <div>
          <Link className="cc-cta-primary" href="/demo">
            Explore the demo <ArrowRight size={17} />
          </Link>
          <Link className="cc-cta-secondary" href="/contact">
            Request a pilot
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
