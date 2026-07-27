export type DynamicWorldClass = {
  id: "tree" | "shrub" | "bare" | "built";
  label: string;
  color: string;
  baseline: number;
  current: number;
};

export type DynamicWorldEvidence = {
  parcelLabel: string;
  baselineYear: number;
  currentYear: number;
  confidence: number;
  classes: DynamicWorldClass[];
  summary: string;
  disclaimer: string;
};

export type SpatialGeometryMetadata = {
  fileName: string;
  geometryType: string;
  featureCount: number;
  coordinateCount: number;
  bbox: [number, number, number, number];
};

export type SpatialInsight = {
  headline: string;
  answer: string;
  riskSignal: "review" | "monitor" | "insufficient_evidence";
  confidenceSummary: string;
  evidenceBoundary: string;
  actions: Array<{
    priority: 1 | 2 | 3;
    title: string;
    rationale: string;
    requiredEvidence: string[];
  }>;
};

export const dynamicWorldEvidence: DynamicWorldEvidence = {
  parcelLabel: "Illustrative calibration parcel",
  baselineYear: 2021,
  currentYear: 2024,
  confidence: 0.86,
  classes: [
    {
      id: "tree",
      label: "Tree cover",
      color: "#2f7652",
      baseline: 54.2,
      current: 48.7,
    },
    {
      id: "shrub",
      label: "Shrub & grass",
      color: "#8eb579",
      baseline: 21.8,
      current: 24.3,
    },
    {
      id: "bare",
      label: "Bare ground",
      color: "#d2a65e",
      baseline: 18.1,
      current: 17.2,
    },
    {
      id: "built",
      label: "Built area",
      color: "#7e8f98",
      baseline: 5.9,
      current: 9.8,
    },
  ],
  summary:
    "Tree-cover share decreased while built-area share increased between the selected annual composites. The signal is prioritised for expert review, not treated as a compliance finding.",
  disclaimer:
    "Illustrative Dynamic World calibration data. The public case record does not include a verified parcel polygon, so these values are not presented as evidence for FP/KA/ROAD/7440/2014.",
};
