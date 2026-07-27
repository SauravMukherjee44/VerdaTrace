import { z } from "zod";

export const assessmentStatusSchema = z.enum([
  "verified",
  "partial",
  "missing_evidence",
  "not_yet_due",
  "superseded",
  "expert_review",
]);

export const citationSchema = z.object({
  documentId: z.string().min(1),
  documentTitle: z.string().min(1),
  page: z.number().int().positive(),
  clause: z.string().min(1),
  sourceUrl: z.string().url(),
});

export const obligationSchema = z.object({
  id: z.string().min(1),
  clause: z.string().min(1),
  category: z.string().min(1),
  requirement: z.string().min(1),
  responsibleParty: z.string().min(1),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  deadline: z.string().nullable(),
  geography: z.string().nullable(),
  citation: citationSchema,
  confidence: z.number().min(0).max(1),
  status: assessmentStatusSchema.default("expert_review"),
  reason: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
  reviewerState: z.enum(["pending", "approved", "needs_changes"]).default("pending"),
});

export const analysisResultSchema = z.object({
  document: z.object({
    title: z.string().min(1),
    authority: z.string().min(1),
    date: z.string().nullable(),
    hash: z.string().min(8),
  }),
  obligations: z.array(obligationSchema).max(80),
  warnings: z.array(z.string()).default([]),
  processingMs: z.number().nonnegative(),
  model: z.string().min(1),
});

export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type Obligation = z.infer<typeof obligationSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export type SourceDocument = {
  id: string;
  title: string;
  date: string;
  authority: string;
  sourceUrl: string;
  pages: number;
  role: "approval" | "amendment" | "proposal_record";
};

export type Revision = {
  id: string;
  originalObligationId: string;
  replacementObligationId: string;
  effectiveDate: string;
  amendmentCitation: Citation;
  rationale: string;
};

export type EvidenceItem = {
  id: string;
  type: "approval" | "amendment" | "proposal_record" | "spatial_record";
  title: string;
  date: string;
  sourceUrl: string;
  integrity: string;
  note: string;
};

export type InspectionTask = {
  id: string;
  priority: 1 | 2 | 3;
  title: string;
  location: string;
  requiredEvidence: string[];
  rationale: string;
  safetyNote: string;
  obligationIds: string[];
};
