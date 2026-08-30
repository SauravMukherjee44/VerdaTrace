"use client";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  FileText,
  GitCompareArrows,
  Layers3,
  Network,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { type KeyboardEvent, useMemo, useState } from "react";
import { demoObligations, evidenceItems, revisions } from "@/lib/demo-data";
import type { Obligation, Revision } from "@/lib/schema";

type GraphNode = {
  id: string;
  kind: "source" | "superseded" | "current" | "summary" | "evidence" | "action";
  title: string;
  eyebrow: string;
  detail: string;
  obligation?: Obligation;
  revision?: Revision;
};

function tokens(value: string) {
  return value.split(/(\s+|[.,;:()])/).filter(Boolean);
}

function clauseDiff(original: string, replacement: string) {
  const oldTokens = tokens(original);
  const newTokens = tokens(replacement);
  const oldSet = new Set(oldTokens.map((item) => item.toLowerCase()));
  const newSet = new Set(newTokens.map((item) => item.toLowerCase()));
  return {
    old: oldTokens.map((token, index) =>
      newSet.has(token.toLowerCase()) || /^\s+$/.test(token) ? (
        token
      ) : (
        <del key={`${token}-${index}`}>{token}</del>
      ),
    ),
    current: newTokens.map((token, index) =>
      oldSet.has(token.toLowerCase()) || /^\s+$/.test(token) ? (
        token
      ) : (
        <mark key={`${token}-${index}`}>{token}</mark>
      ),
    ),
  };
}

function citationUrl(obligation?: Obligation) {
  if (!obligation || obligation.citation.sourceUrl.startsWith("session:")) {
    return null;
  }
  return `${obligation.citation.sourceUrl}#page=${obligation.citation.page}`;
}

export function RevisionEvidenceGraph() {
  const [selectedId, setSelectedId] = useState("current-c2");

  const nodes = useMemo<GraphNode[]>(() => {
    const originalC2 = demoObligations.find((item) => item.id === "final-c2")!;
    const currentC2 = demoObligations.find((item) => item.id === "amend-c2")!;
    const originalC3 = demoObligations.find((item) => item.id === "final-c3")!;
    const currentC3 = demoObligations.find((item) => item.id === "amend-c3")!;
    const unchangedCount = demoObligations.filter(
      (item) =>
        !["final-c2", "amend-c2", "final-c3", "amend-c3"].includes(item.id) &&
        item.status !== "superseded",
    ).length;
    return [
      {
        id: "source-approval",
        kind: "source",
        title: "Final approval",
        eyebrow: "Source document · 15 May 2025",
        detail: "Establishes the original conditions and evidence baseline.",
      },
      {
        id: "source-amendment",
        kind: "source",
        title: "Amendment order",
        eyebrow: "Source document · 03 Sep 2025",
        detail: "Explicitly modifies Conditions 2 and 3.",
      },
      {
        id: "old-c2",
        kind: "superseded",
        title: "Condition 2 · previous",
        eyebrow: "Superseded obligation",
        detail: originalC2.requirement,
        obligation: originalC2,
        revision: revisions[0],
      },
      {
        id: "current-c2",
        kind: "current",
        title: "Condition 2 · current",
        eyebrow: "Operative obligation",
        detail: currentC2.requirement,
        obligation: currentC2,
        revision: revisions[0],
      },
      {
        id: "old-c3",
        kind: "superseded",
        title: "Condition 3 · previous",
        eyebrow: "Superseded obligation",
        detail: originalC3.requirement,
        obligation: originalC3,
        revision: revisions[1],
      },
      {
        id: "current-c3",
        kind: "current",
        title: "Condition 3 · current",
        eyebrow: "Operative obligation",
        detail: currentC3.requirement,
        obligation: currentC3,
        revision: revisions[1],
      },
      {
        id: "unchanged",
        kind: "summary",
        title: `${unchangedCount} unchanged conditions`,
        eyebrow: "Preserved branch",
        detail:
          "The amendment preserves every approval condition it does not explicitly change. This branch remains summarized to keep the graph legible.",
      },
      {
        id: "evidence",
        kind: "evidence",
        title: `${evidenceItems.length} evidence records`,
        eyebrow: "Evidence layer",
        detail:
          "Approval, amendment, proposal metadata, and spatial-record integrity notes stay distinct from the obligations they support.",
      },
      {
        id: "actions",
        kind: "action",
        title: "Inspection actions",
        eyebrow: "Human approval boundary",
        detail:
          "Current duties and evidence gaps produce editable review actions; VerdaTrace does not make an automated legal determination.",
      },
    ];
  }, []);

  const selected =
    nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const sibling =
    selected.id.includes("c2")
      ? nodes.find((node) =>
          selected.id.startsWith("old") ? node.id === "current-c2" : node.id === "old-c2",
        )
      : selected.id.includes("c3")
        ? nodes.find((node) =>
            selected.id.startsWith("old") ? node.id === "current-c3" : node.id === "old-c3",
          )
        : undefined;
  const original =
    selected.kind === "current" ? sibling?.detail : selected.detail;
  const current =
    selected.kind === "superseded" ? sibling?.detail : selected.detail;
  const diff =
    original && current && (selected.id.includes("c2") || selected.id.includes("c3"))
      ? clauseDiff(original, current)
      : null;

  const selectRelative = (direction: number) => {
    const index = nodes.findIndex((node) => node.id === selectedId);
    setSelectedId(nodes[(index + direction + nodes.length) % nodes.length].id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectRelative(1);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectRelative(-1);
    }
  };

  const chains = [
    {
      number: "01",
      label: "Condition 2",
      summary: "Afforestation duty replaced by conservation duty",
      previous: nodes.find((node) => node.id === "old-c2")!,
      current: nodes.find((node) => node.id === "current-c2")!,
    },
    {
      number: "02",
      label: "Condition 3",
      summary: "Plantation duty replaced by habitat restoration",
      previous: nodes.find((node) => node.id === "old-c3")!,
      current: nodes.find((node) => node.id === "current-c3")!,
    },
  ];

  const selectNode = (node: GraphNode) => (
    <button
      key={node.id}
      className={`revision-flow-card type-${node.kind} ${
        selectedId === node.id ? "is-selected" : ""
      }`}
      onClick={() => setSelectedId(node.id)}
      aria-pressed={selectedId === node.id}
    >
      <span className="revision-flow-card-icon">
        {node.kind === "source" ? (
          <FileText size={15} />
        ) : node.kind === "evidence" ? (
          <ScanSearch size={15} />
        ) : node.kind === "action" ? (
          <Check size={15} />
        ) : node.kind === "summary" ? (
          <Layers3 size={15} />
        ) : (
          <FileCheck2 size={15} />
        )}
      </span>
      <span>
        <small>{node.eyebrow}</small>
        <strong>{node.title}</strong>
        <em>{node.detail}</em>
      </span>
    </button>
  );

  return (
    <div className="revision-intelligence">
      <div className="content-header revision-intelligence-header">
        <div>
          <span>Revision intelligence · 2.5D evidence graph</span>
          <h3>Both revision chains, one current source of truth.</h3>
        </div>
        <div className="revision-graph-health">
          <Network size={14} />
          <span>
            <strong>{revisions.length} chains resolved</strong>
            <small>0 ambiguous replacements</small>
          </span>
        </div>
      </div>

      <div className="revision-graph-shell">
        <section className="revision-flow-panel">
          <header className="revision-flow-toolbar">
            <div>
              <span className="revision-live-dot" />
              Two explicit replacement paths
            </div>
            <span>{nodes.length} traceable nodes</span>
          </header>

          <div
            className="revision-flow-board"
            tabIndex={0}
            aria-label="Revision evidence graph. Arrow keys move between nodes."
            onKeyDown={handleKeyDown}
          >
            <div className="revision-source-strip">
              {selectNode(nodes.find((node) => node.id === "source-approval")!)}
              <div className="revision-source-arrow">
                <ChevronRight size={17} />
                <span>Amends</span>
              </div>
              {selectNode(nodes.find((node) => node.id === "source-amendment")!)}
              <div className="revision-source-arrow">
                <ChevronRight size={17} />
                <span>Preserves</span>
              </div>
              {selectNode(nodes.find((node) => node.id === "unchanged")!)}
            </div>

            <div className="revision-lanes">
              {chains.map((chain) => (
                <article className="revision-lane" key={chain.label}>
                  <header>
                    <span>Chain {chain.number}</span>
                    <strong>{chain.label}</strong>
                    <small>{chain.summary}</small>
                  </header>
                  <div className="revision-lane-path">
                    {selectNode(chain.previous)}
                    <div className="revision-replacement-edge">
                      <span />
                      <GitCompareArrows size={15} />
                      <strong>Replaced</strong>
                      <small>03 Sep 2025</small>
                    </div>
                    {selectNode(chain.current)}
                  </div>
                </article>
              ))}
            </div>

            <div className="revision-output-strip">
              {selectNode(nodes.find((node) => node.id === "evidence")!)}
              <div className="revision-source-arrow">
                <ChevronRight size={17} />
                <span>Produces</span>
              </div>
              {selectNode(nodes.find((node) => node.id === "actions")!)}
            </div>
          </div>
        </section>

        <aside className="revision-detail-panel" aria-live="polite">
          <header>
            <span>{selected.eyebrow}</span>
            <h4>{selected.title}</h4>
          </header>

          {selected.revision && (
            <div className="revision-effective-date">
              <CalendarDays size={15} />
              <span>
                <small>Effective date</small>
                <strong>{selected.revision.effectiveDate}</strong>
              </span>
            </div>
          )}

          {diff ? (
            <div className="revision-clause-diff">
              <section>
                <span>Previous clause</span>
                <p>{diff.old}</p>
              </section>
              <div>
                <ChevronRight size={16} />
                Replacement
              </div>
              <section className="is-current">
                <span>Current clause</span>
                <p>{diff.current}</p>
              </section>
            </div>
          ) : (
            <p className="revision-selected-detail">{selected.detail}</p>
          )}

          {selected.revision && (
            <section className="revision-rationale">
              <span>Resolver rationale</span>
              <p>{selected.revision.rationale}</p>
              <div>
                <GitCompareArrows size={14} />
                Replacement edge is explicit; all other conditions are
                preserved.
              </div>
            </section>
          )}

          {selected.obligation && (
            <div className="revision-evidence-state">
              <span>
                <small>Evidence state</small>
                <strong>
                  {selected.obligation.status.replaceAll("_", " ")}
                </strong>
              </span>
              <span>
                <small>Extraction confidence</small>
                <strong>
                  {Math.round(selected.obligation.confidence * 100)}%
                </strong>
              </span>
            </div>
          )}

          {selected.obligation &&
            (citationUrl(selected.obligation) ? (
              <a
                className="revision-citation-link"
                href={citationUrl(selected.obligation)!}
                target="_blank"
                rel="noreferrer"
              >
                <FileText size={14} />
                {selected.obligation.citation.documentTitle} · p.
                {selected.obligation.citation.page} ·{" "}
                {selected.obligation.citation.clause}
                <ExternalLink size={13} />
              </a>
            ) : (
              <span className="revision-citation-link">
                <FileText size={14} /> Session source
              </span>
            ))}

          <div className="revision-inspector-nav">
            <button onClick={() => selectRelative(-1)}>
              <ChevronLeft size={14} /> Previous
            </button>
            <span>
              {nodes.findIndex((node) => node.id === selected.id) + 1} /{" "}
              {nodes.length}
            </span>
            <button onClick={() => selectRelative(1)}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
