# VerdaTrace — Accelerator application draft

## One-line description

VerdaTrace turns environmental approvals, amendments, maps, and field evidence
into source-cited obligations and prioritized action.

## Problem

Forest-clearance conditions are dispersed across long approval documents,
later amendments, geospatial files, notifications, and field evidence. A
consultant must reconstruct which clause is current before deciding whether the
available evidence is sufficient. The work is slow, easy to duplicate, and
especially fragile when an amendment changes the ecological treatment of a
specific parcel.

## Solution

VerdaTrace creates a cited obligation ledger, resolves amendments, matches
evidence, and produces a prioritized human-editable inspection plan. It measures
evidence coverage and review priority—not legal guilt or regulatory compliance.
Every consequential output remains subject to consultant approval.

## Public demonstration

The MVP covers proposal `FP/KA/ROAD/7440/2014`. The May 2025 final approval
required compensatory afforestation over 9.54 ha of non-forest land. The
September 2025 amendment replaces that duty with conservation of the same 9.54
ha for natural growth and wildlife habitat, while restating 9.40 ha of degraded
forest as the operative compensatory-afforestation site. All other conditions
remain unchanged.

The demo:

- preserves the two original clauses as `superseded`;
- keeps only the amended replacements active;
- cites every finding to document, page, and clause;
- calls absent proof `missing_evidence`, never “non-compliant”;
- shows the documented project location while flagging unavailable parcel geometry;
- converts unresolved ecological obligations into a practical inspection checklist.

## Why AI is essential

Rule-based parsing alone cannot reliably connect paraphrased amendments,
multimodal PDFs, scanned clauses, spatial references, and evidence documents.
Gemini 3.1 Flash-Lite provides native PDF understanding and structured
obligation extraction. Deterministic logic then validates citations, dates,
areas, status vocabulary, and revision relationships.

## Google AI roadmap

- **Gemini:** multimodal extraction, amendment reasoning, evidence matching,
  multilingual field briefs, and calibrated uncertainty.
- **AlphaEarth:** landscape representations for establishment and habitat
  similarity under sparse labels.
- **Dynamic World / Earth Engine:** interpretable land-cover evidence and
  repeatable geospatial processing.
- **Gemma:** offline field capture and evidence assistance where connectivity is
  unreliable.

Perch is intentionally excluded until a partner site has an acoustic
biodiversity monitoring need.

## Initial user and expansion

The initial user is an EIA or forest consultant reviewing compensatory-
afforestation projects. Expansion paths include project proponents, independent
auditors, restoration funders, regulators, mine rehabilitation, infrastructure
permits, biodiversity offsets, and nature-finance portfolios.

## Three-month milestones

1. Build a 100-document expert-labelled benchmark and formalize the obligation
   ontology.
2. Add PostGIS plus AlphaEarth / Dynamic World evidence layers and validate
   change signals on two partner-reviewed sites.
3. Run the inspection-planning loop with a partner and measure reviewer time,
   discrepancy yield, hectares assessed, and evidence coverage.

## Validation status

The product includes a 24-obligation review set and automated amendment tests.
Consultant precision, recall, and time-saved results are deliberately left
unpublished until the scheduled review is completed. This wording must be
updated only with measured outcomes.

## Global potential

The product ontology is jurisdiction-configurable: source authority, obligation,
responsible party, geography, evidence, revision, and reviewer decision. The
first wedge is Indian forest clearance, but the same obligation-to-evidence
problem exists across mining rehabilitation, biodiversity offsets, restoration
finance, infrastructure permits, and nature-related disclosure. Expansion is
therefore a data and policy adaptation problem—not a new product category.
