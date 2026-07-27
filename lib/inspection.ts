import type { InspectionTask, Obligation } from "./schema";

const priorityWeights: Record<string, number> = {
  Biodiversity: 9,
  Hydrology: 8,
  "Slope stability": 8,
  "Soil conservation": 7,
  "Soil and moisture": 7,
  Trees: 7,
  Boundary: 6,
  Geospatial: 6,
  Plantation: 5,
  Reporting: 4,
};

export function createInspectionPlan(obligations: Obligation[]): InspectionTask[] {
  const unresolved = obligations
    .filter((obligation) =>
      ["missing_evidence", "partial", "expert_review"].includes(obligation.status),
    )
    .map((obligation) => ({
      obligation,
      score:
        (priorityWeights[obligation.category] ?? 3) +
        (obligation.status === "missing_evidence" ? 3 : 1),
    }))
    .sort((a, b) => b.score - a.score);

  const top = unresolved.slice(0, 6);
  return top.map(({ obligation, score }, index) => ({
    id: `task-${obligation.id}`,
    priority: (score >= 10 ? 1 : score >= 7 ? 2 : 3) as 1 | 2 | 3,
    title: `Verify ${obligation.category.toLowerCase()} evidence`,
    location: obligation.geography ?? "Project records / responsible office",
    requiredEvidence: evidenceFor(obligation),
    rationale: `${obligation.clause}: ${obligation.reason}`,
    safetyNote:
      index < 3
        ? "Confirm site access, weather, mine traffic, and Forest Department escort before field work."
        : "Desk review first; schedule a field visit only if documentary evidence remains insufficient.",
    obligationIds: [obligation.id],
  }));
}

function evidenceFor(obligation: Obligation): string[] {
  const lookup: Record<string, string[]> = {
    Biodiversity: [
      "Geotagged habitat or nest photographs",
      "Species / observation log",
      "Maintenance and monitoring record",
    ],
    Hydrology: [
      "Crossing inventory and coordinates",
      "Culvert / bridge drawings",
      "Drainage and wildlife-passage photographs",
    ],
    Boundary: [
      "Pillar register with serial numbers",
      "GPS coordinate file",
      "Geotagged boundary photographs",
    ],
    Trees: [
      "Tree inventory",
      "Translocation feasibility log",
      "Forest Department supervision record",
    ],
    Geospatial: [
      "Authoritative KML / GeoJSON",
      "Portal upload receipt",
      "Area calculation report",
    ],
  };
  return (
    lookup[obligation.category] ?? [
      "Signed implementation record",
      "Dated geotagged photographs",
      "Responsible-officer review note",
    ]
  );
}
