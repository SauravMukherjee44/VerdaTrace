import type {
  SpatialAnalysisResult,
  SpatialGeometryPayload,
} from "@/lib/spatial";

export const demoSpatialGeometry: SpatialGeometryPayload = {
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [76.63235, 15.1239],
        [76.63515, 15.1239],
        [76.63515, 15.1267],
        [76.63235, 15.1267],
        [76.63235, 15.1239],
      ],
    ],
  },
  metadata: {
    fileName: "verdatrace-screen2-demo-boundary.geojson",
    geometryType: "Polygon",
    featureCount: 1,
    coordinateCount: 5,
    bbox: [76.63235, 15.1239, 76.63515, 15.1267],
    areaHectares: 9.38,
    hash: "cce5a1adc574838e14a6b2641bf521e89718a0a6163b1b57c687be310081d0ba",
    source: "upload",
  },
};

export const demoSpatialAnalysisSnapshot: SpatialAnalysisResult = {
  id: "demo-snapshot-2021-2025",
  computedAt: "2026-07-29T07:41:17.598Z",
  geometry: demoSpatialGeometry.metadata,
  baselinePeriod: {
    year: 2021,
    startDate: "2021-01-01",
    endDate: "2021-12-31",
    sceneCount: 35,
  },
  currentPeriod: {
    year: 2025,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    sceneCount: 42,
  },
  confidenceThreshold: 0.35,
  coveragePercent: {
    baseline: 99.24,
    current: 99.24,
  },
  lowConfidencePercent: {
    baseline: 6.14,
    current: 15.21,
  },
  classes: [
    {
      id: "water",
      label: "Water",
      color: "#419bdf",
      baseline: 0,
      current: 0,
      delta: 0,
      baselineAreaHectares: 0,
      currentAreaHectares: 0,
    },
    {
      id: "trees",
      label: "Trees",
      color: "#397d49",
      baseline: 1.53,
      current: 22.44,
      delta: 20.91,
      baselineAreaHectares: 0.14,
      currentAreaHectares: 2.09,
    },
    {
      id: "grass",
      label: "Grass",
      color: "#88b053",
      baseline: 0,
      current: 0,
      delta: 0,
      baselineAreaHectares: 0,
      currentAreaHectares: 0,
    },
    {
      id: "flooded_vegetation",
      label: "Flooded vegetation",
      color: "#7a87c6",
      baseline: 0,
      current: 0,
      delta: 0,
      baselineAreaHectares: 0,
      currentAreaHectares: 0,
    },
    {
      id: "crops",
      label: "Crops",
      color: "#e49635",
      baseline: 0,
      current: 0,
      delta: 0,
      baselineAreaHectares: 0,
      currentAreaHectares: 0,
    },
    {
      id: "shrub_and_scrub",
      label: "Shrub & scrub",
      color: "#dfc35a",
      baseline: 92.32,
      current: 62.36,
      delta: -29.96,
      baselineAreaHectares: 8.59,
      currentAreaHectares: 5.8,
    },
    {
      id: "built",
      label: "Built area",
      color: "#c4281b",
      baseline: 0,
      current: 0,
      delta: 0,
      baselineAreaHectares: 0,
      currentAreaHectares: 0,
    },
    {
      id: "bare",
      label: "Bare ground",
      color: "#a59b8f",
      baseline: 0,
      current: 0,
      delta: 0,
      baselineAreaHectares: 0,
      currentAreaHectares: 0,
    },
    {
      id: "snow_and_ice",
      label: "Snow & ice",
      color: "#b39fe1",
      baseline: 0,
      current: 0,
      delta: 0,
      baselineAreaHectares: 0,
      currentAreaHectares: 0,
    },
  ],
  changeSignals: [
    {
      classId: "shrub_and_scrub",
      direction: "decrease",
      delta: -29.96,
      magnitude: "high",
    },
    {
      classId: "trees",
      direction: "increase",
      delta: 20.91,
      magnitude: "high",
    },
    ...[
      "water",
      "grass",
      "flooded_vegetation",
      "crops",
      "built",
      "bare",
      "snow_and_ice",
    ].map((classId) => ({
      classId: classId as
        | "water"
        | "grass"
        | "flooded_vegetation"
        | "crops"
        | "built"
        | "bare"
        | "snow_and_ice",
      direction: "stable" as const,
      delta: 0,
      magnitude: "low" as const,
    })),
  ],
  layers: [
    {
      id: "demo-baseline-satellite",
      label: "2021 Sentinel-2",
      tileUrl: "/api/spatial/tiles/demo-expired/{z}/{x}/{y}",
      opacity: 1,
      kind: "satellite",
      year: 2021,
    },
    {
      id: "demo-current-satellite",
      label: "2025 Sentinel-2",
      tileUrl: "/api/spatial/tiles/demo-expired/{z}/{x}/{y}",
      opacity: 1,
      kind: "satellite",
      year: 2025,
    },
    {
      id: "demo-baseline-land-cover",
      label: "2021 Dynamic World",
      tileUrl: "/api/spatial/tiles/demo-expired/{z}/{x}/{y}",
      opacity: 0.68,
      kind: "land_cover",
      year: 2021,
    },
    {
      id: "demo-current-land-cover",
      label: "2025 Dynamic World",
      tileUrl: "/api/spatial/tiles/demo-expired/{z}/{x}/{y}",
      opacity: 0.68,
      kind: "land_cover",
      year: 2025,
    },
  ],
  tileSessionExpiresAt: "2026-07-29T07:41:17.598Z",
  attribution:
    "Dynamic World Project by Google, National Geographic Society, and World Resources Institute · Sentinel-2 imagery by Copernicus/ESA.",
  methodology:
    "Annual median Dynamic World probability composites at 10 m. The highest-probability class is counted only when it meets the selected confidence threshold; lower-confidence pixels are reported separately.",
  evidenceBoundary:
    "Demo analysis of a synthetic 9.38 ha polygon near the documented Sandur project-area overview. It is not an official parcel boundary or a finding of causation, ecological harm, or legal non-compliance.",
  processingMs: 6_128,
};
