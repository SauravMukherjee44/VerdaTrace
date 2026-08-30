import { z } from "zod";

export const DYNAMIC_WORLD_ATTRIBUTION =
  "Dynamic World Project by Google, National Geographic Society, and World Resources Institute · Sentinel-2 imagery by Copernicus/ESA.";

export const spatialClassDefinitions = [
  { id: "water", label: "Water", color: "#419bdf" },
  { id: "trees", label: "Trees", color: "#397d49" },
  { id: "grass", label: "Grass", color: "#88b053" },
  { id: "flooded_vegetation", label: "Flooded vegetation", color: "#7a87c6" },
  { id: "crops", label: "Crops", color: "#e49635" },
  { id: "shrub_and_scrub", label: "Shrub & scrub", color: "#dfc35a" },
  { id: "built", label: "Built area", color: "#c4281b" },
  { id: "bare", label: "Bare ground", color: "#a59b8f" },
  { id: "snow_and_ice", label: "Snow & ice", color: "#b39fe1" },
] as const;

export type SpatialClassId = (typeof spatialClassDefinitions)[number]["id"];

const positionSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const linearRingSchema = z
  .array(positionSchema)
  .min(4)
  .refine(
    (ring) =>
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1],
    "Every polygon ring must be closed.",
  );
const polygonCoordinatesSchema = z.array(linearRingSchema).min(1);
const multiPolygonCoordinatesSchema = z.array(polygonCoordinatesSchema).min(1);

export const spatialGeometrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Polygon"),
    coordinates: polygonCoordinatesSchema,
  }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: multiPolygonCoordinatesSchema,
  }),
]);

export const spatialGeometryMetadataSchema = z.object({
  fileName: z.string().min(1).max(180),
  geometryType: z.enum(["Polygon", "MultiPolygon"]),
  featureCount: z.number().int().positive().max(10_000),
  coordinateCount: z.number().int().positive().max(50_000),
  bbox: z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ]),
  areaHectares: z.number().positive().max(100_000),
  hash: z.string().min(16).max(128),
  source: z.enum(["upload", "verified_public_record"]).default("upload"),
});

export const spatialGeometryPayloadSchema = z.object({
  geometry: spatialGeometrySchema,
  metadata: spatialGeometryMetadataSchema,
});

const spatialClassStatisticSchema = z.object({
  id: z.enum(
    spatialClassDefinitions.map((item) => item.id) as [
      SpatialClassId,
      ...SpatialClassId[],
    ],
  ),
  label: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  baseline: z.number().min(0).max(100),
  current: z.number().min(0).max(100),
  delta: z.number().min(-100).max(100),
  baselineAreaHectares: z.number().nonnegative(),
  currentAreaHectares: z.number().nonnegative(),
});

const spatialPeriodSchema = z.object({
  year: z.number().int().min(2015).max(2100),
  startDate: z.string().date(),
  endDate: z.string().date(),
  sceneCount: z.number().int().nonnegative(),
});

const spatialLayerSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  tileUrl: z.string().startsWith("/api/spatial/tiles/"),
  opacity: z.number().min(0).max(1),
  kind: z.enum(["satellite", "land_cover"]),
  year: z.number().int().min(2015).max(2100),
});

export const spatialAnalysisResultSchema = z.object({
  id: z.string().min(8).max(100),
  computedAt: z.string().datetime(),
  geometry: spatialGeometryMetadataSchema,
  baselinePeriod: spatialPeriodSchema,
  currentPeriod: spatialPeriodSchema,
  confidenceThreshold: z.number().min(0.35).max(0.9),
  coveragePercent: z.object({
    baseline: z.number().min(0).max(100),
    current: z.number().min(0).max(100),
  }),
  lowConfidencePercent: z.object({
    baseline: z.number().min(0).max(100),
    current: z.number().min(0).max(100),
  }),
  classes: z.array(spatialClassStatisticSchema).length(9),
  changeSignals: z.array(
    z.object({
      classId: z.enum(
        spatialClassDefinitions.map((item) => item.id) as [
          SpatialClassId,
          ...SpatialClassId[],
        ],
      ),
      direction: z.enum(["increase", "decrease", "stable"]),
      delta: z.number().min(-100).max(100),
      magnitude: z.enum(["low", "moderate", "high"]),
    }),
  ),
  layers: z.array(spatialLayerSchema).length(4),
  tileSessionExpiresAt: z.string().datetime(),
  attribution: z.string().min(1),
  methodology: z.string().min(1),
  evidenceBoundary: z.string().min(1),
  processingMs: z.number().nonnegative(),
});

export const spatialAnalysisRequestSchema = z.object({
  geometry: spatialGeometryPayloadSchema,
  baselineYear: z.number().int().min(2016).max(2099),
  currentYear: z.number().int().min(2016).max(2100),
  confidenceThreshold: z.number().min(0.35).max(0.9),
}).superRefine((value, context) => {
  if (value.currentYear <= value.baselineYear) {
    context.addIssue({
      code: "custom",
      path: ["currentYear"],
      message: "Comparison year must be later than the baseline year.",
    });
  }
  const latestCompleteYear = new Date().getUTCFullYear() - 1;
  if (value.currentYear > latestCompleteYear) {
    context.addIssue({
      code: "custom",
      path: ["currentYear"],
      message: `Comparison year cannot be later than the latest complete year (${latestCompleteYear}).`,
    });
  }
});

export const spatialInsightSchema = z.object({
  headline: z.string().min(1).max(180),
  answer: z.string().min(1).max(2200),
  riskSignal: z.enum(["review", "monitor", "insufficient_evidence"]),
  confidenceSummary: z.string().min(1).max(420),
  evidenceBoundary: z.string().min(1).max(650),
  processingMs: z.number().nonnegative().default(0),
  actions: z
    .array(
      z.object({
        priority: z.number().int().min(1).max(3),
        title: z.string().min(1).max(150),
        rationale: z.string().min(1).max(500),
        requiredEvidence: z.array(z.string().min(1).max(180)).min(1).max(4),
      }),
    )
    .min(1)
    .max(3),
});

export type SpatialGeometry = z.infer<typeof spatialGeometrySchema>;
export type SpatialGeometryMetadata = z.infer<
  typeof spatialGeometryMetadataSchema
>;
export type SpatialGeometryPayload = z.infer<
  typeof spatialGeometryPayloadSchema
>;
export type SpatialAnalysisRequest = z.infer<
  typeof spatialAnalysisRequestSchema
>;
export type SpatialAnalysisResult = z.infer<
  typeof spatialAnalysisResultSchema
>;
export type SpatialInsight = z.infer<typeof spatialInsightSchema>;

export const spatialProjectFallback = {
  label: "Zeenath approach road · project area",
  proposalId: "FP/KA/ROAD/7440/2014",
  location: "Sandur, Ballari district, Karnataka",
  center: [76.55, 15.08] as [number, number],
  zoom: 11,
  notice:
    "Approximate project-area view. Upload a verified polygon to compute parcel statistics.",
};
