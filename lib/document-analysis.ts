import { Buffer } from "node:buffer";
import { z } from "zod";
import { analysisResultSchema, obligationSchema, type AnalysisResult } from "@/lib/schema";

const MODEL = "gemini-3.1-flash-lite";

const modelResultSchema = z.object({
  document: z.object({ title: z.string().min(1), authority: z.string().min(1), date: z.string().nullable() }),
  obligations: z.array(z.object({
    clause: z.string().min(1), category: z.string().min(1), requirement: z.string().min(1),
    responsibleParty: z.string().min(1), quantity: z.number().nullable(), unit: z.string().nullable(),
    deadline: z.string().nullable(), geography: z.string().nullable(), page: z.number().int().positive(),
    confidence: z.number().min(0).max(1),
  })).max(80),
  warnings: z.array(z.string()).default([]),
});

const responseSchema = {
  type: "OBJECT",
  properties: {
    document: { type: "OBJECT", properties: { title: { type: "STRING" }, authority: { type: "STRING" }, date: { type: "STRING", nullable: true } }, required: ["title", "authority", "date"] },
    obligations: { type: "ARRAY", items: { type: "OBJECT", properties: {
      clause: { type: "STRING" }, category: { type: "STRING" }, requirement: { type: "STRING" },
      responsibleParty: { type: "STRING" }, quantity: { type: "NUMBER", nullable: true }, unit: { type: "STRING", nullable: true },
      deadline: { type: "STRING", nullable: true }, geography: { type: "STRING", nullable: true }, page: { type: "INTEGER" }, confidence: { type: "NUMBER" },
    }, required: ["clause", "category", "requirement", "responsibleParty", "quantity", "unit", "deadline", "geography", "page", "confidence"] } },
    warnings: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["document", "obligations", "warnings"],
} as const;

function apiKey() {
  const env = (globalThis as typeof globalThis & { __CANOPY_RUNTIME_ENV__?: { GEMINI_API_KEY?: string } }).__CANOPY_RUNTIME_ENV__;
  return env?.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
}

export function isDocumentAnalysisConfigured() {
  return Boolean(apiKey());
}

export async function analyzeDocumentBytes(input: {
  bytes: Uint8Array;
  mimeType: string;
  hash: string;
  projectContext?: string;
}): Promise<AnalysisResult> {
  const startedAt = Date.now();
  const key = apiKey();
  if (!key) throw new Error("ANALYSIS_NOT_CONFIGURED");
  const prompt = [
    "You are the Document Extractor in a human-reviewed environmental evidence workflow.",
    "Extract only explicit obligations from the attached document or image. Never decide legal compliance.",
    "Every obligation must contain a visible clause identifier and one-indexed page or frame number.",
    "Preserve quantities, units, dates, geography, and responsible parties exactly. Return null for unstated fields.",
    "If the document amends earlier conditions, extract replacement wording and note the amendment in warnings.",
    "Potential applicant contact details are outside scope and must not be returned.",
    input.projectContext ? `Project context: ${input.projectContext.slice(0, 2000)}` : "",
  ].filter(Boolean).join("\n");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40_000);
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: input.mimeType, data: Buffer.from(input.bytes).toString("base64") } }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema },
      }),
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(response.status >= 500 ? "ANALYSIS_TRANSIENT_FAILURE" : "ANALYSIS_PROVIDER_REJECTED");
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
  if (!text) throw new Error("ANALYSIS_EMPTY_RESPONSE");
  const parsed = modelResultSchema.parse(JSON.parse(text));
  const obligations = parsed.obligations.map((obligation, index) => obligationSchema.parse({
    id: `upload-${input.hash.slice(0, 10)}-${index + 1}`,
    ...obligation,
    citation: {
      documentId: input.hash,
      documentTitle: parsed.document.title,
      page: obligation.page,
      clause: obligation.clause,
      sourceUrl: `session://${input.hash}`,
    },
    status: "expert_review",
    reason: "VerdaTrace-extracted finding awaiting human evidence review.",
    evidenceIds: [], reviewerState: "pending",
  }));
  return analysisResultSchema.parse({
    document: { ...parsed.document, hash: input.hash }, obligations,
    warnings: [...parsed.warnings, "Automated extraction is not a legal compliance determination."],
    processingMs: Date.now() - startedAt,
    model: "VerdaTrace Intelligence",
  });
}
