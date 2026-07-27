import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkAnalysisRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { analysisResultSchema, obligationSchema } from "@/lib/schema";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MODEL = "gemini-3.1-flash-lite";
const SUPPORTED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/rtf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/json",
  "text/plain",
  "text/csv",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
]);

function hasValidSignature(bytes: Uint8Array, mimeType: string) {
  const hex = Array.from(bytes.slice(0, 12))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const text = new TextDecoder().decode(bytes.slice(0, 12));
  if (mimeType === "application/pdf") return text.startsWith("%PDF-");
  if (mimeType === "image/png") return hex.startsWith("89504e470d0a1a0a");
  if (mimeType === "image/jpeg") return hex.startsWith("ffd8ff");
  if (mimeType === "image/webp") {
    return text.startsWith("RIFF") && text.slice(8, 12) === "WEBP";
  }
  if (mimeType === "image/tiff") {
    return hex.startsWith("49492a00") || hex.startsWith("4d4d002a");
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return hex.startsWith("504b0304");
  }
  if (mimeType === "application/msword") {
    return hex.startsWith("d0cf11e0a1b11ae1");
  }
  return !bytes.slice(0, 1024).some((value) => value === 0);
}

const modelResultSchema = z.object({
  document: z.object({
    title: z.string().min(1),
    authority: z.string().min(1),
    date: z.string().nullable(),
  }),
  obligations: z
    .array(
      z.object({
        clause: z.string().min(1),
        category: z.string().min(1),
        requirement: z.string().min(1),
        responsibleParty: z.string().min(1),
        quantity: z.number().nullable(),
        unit: z.string().nullable(),
        deadline: z.string().nullable(),
        geography: z.string().nullable(),
        page: z.number().int().positive(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(80),
  warnings: z.array(z.string()).default([]),
});

const responseSchema = {
  type: "OBJECT",
  properties: {
    document: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        authority: { type: "STRING" },
        date: { type: "STRING", nullable: true },
      },
      required: ["title", "authority", "date"],
    },
    obligations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          clause: { type: "STRING" },
          category: { type: "STRING" },
          requirement: { type: "STRING" },
          responsibleParty: { type: "STRING" },
          quantity: { type: "NUMBER", nullable: true },
          unit: { type: "STRING", nullable: true },
          deadline: { type: "STRING", nullable: true },
          geography: { type: "STRING", nullable: true },
          page: { type: "INTEGER" },
          confidence: { type: "NUMBER" },
        },
        required: [
          "clause",
          "category",
          "requirement",
          "responsibleParty",
          "quantity",
          "unit",
          "deadline",
          "geography",
          "page",
          "confidence",
        ],
      },
    },
    warnings: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["document", "obligations", "warnings"],
} as const;

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const rateLimit = await checkAnalysisRateLimit(request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "This demo allows three live analyses per visitor each hour. Please use the bundled public case or try again after the limit resets.",
          code: "DEMO_RATE_LIMIT",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders(rateLimit),
            "retry-after": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Send the document as multipart form data." },
        { status: 400, headers: rateLimitHeaders(rateLimit) },
      );
    }
    const file = form.get("file");
    const projectContext = String(form.get("projectContext") ?? "").slice(0, 2000);

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Attach one document or image to analyze." },
        { status: 400, headers: rateLimitHeaders(rateLimit) },
      );
    }
    const mimeType = file.type.toLowerCase();
    if (!SUPPORTED_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          error:
            "Unsupported format. Use PDF, Word, RTF, text, CSV, JSON, Markdown, PNG, JPEG, WebP, or TIFF.",
        },
        { status: 415, headers: rateLimitHeaders(rateLimit) },
      );
    }
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Documents must be between 1 byte and 15 MB." },
        { status: 413, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidSignature(bytes, mimeType)) {
      return NextResponse.json(
        { error: "The file contents do not match the selected document format." },
        { status: 400, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const hashBytes = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(hashBytes))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");

    const runtimeEnv = (
      globalThis as typeof globalThis & {
        __CANOPY_RUNTIME_ENV__?: { GEMINI_API_KEY?: string };
      }
    ).__CANOPY_RUNTIME_ENV__;
    const apiKey = runtimeEnv?.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Live document intelligence is not configured for this environment.",
          code: "ANALYSIS_NOT_CONFIGURED",
          hash,
        },
        { status: 503, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40_000);
    const prompt = [
      "You are the Document Extractor in a human-reviewed environmental evidence workflow.",
      "Extract only explicit obligations from the attached document or image. Never decide legal compliance.",
      "Every obligation must contain a visible clause identifier and one-indexed page or frame number. Use page 1 only when the source has no pagination.",
      "Preserve quantities, units, dates, geography, and responsible parties exactly.",
      "If a field is not stated, return null. Do not infer a parcel, deadline, or outcome.",
      "If the document amends earlier conditions, extract the replacement wording and note the amendment in warnings.",
      "Potential applicant contact details are outside scope and must not be returned.",
      projectContext ? `Project context: ${projectContext}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: Buffer.from(bytes).toString("base64"),
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
              responseSchema,
            },
          }),
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const upstream = await response.text();
      console.error("Document intelligence request failed", response.status, upstream.slice(0, 500));
      return NextResponse.json(
        { error: "VerdaTrace Intelligence could not analyze this document. Try again shortly." },
        { status: 502, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("");
    if (!text) {
      return NextResponse.json(
        { error: "VerdaTrace Intelligence returned no structured analysis." },
        { status: 502, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const modelResult = modelResultSchema.parse(JSON.parse(text));
    const obligations = modelResult.obligations.map((obligation, index) =>
      obligationSchema.parse({
        id: `upload-${hash.slice(0, 10)}-${index + 1}`,
        clause: obligation.clause,
        category: obligation.category,
        requirement: obligation.requirement,
        responsibleParty: obligation.responsibleParty,
        quantity: obligation.quantity,
        unit: obligation.unit,
        deadline: obligation.deadline,
        geography: obligation.geography,
        citation: {
          documentId: hash,
          documentTitle: modelResult.document.title,
          page: obligation.page,
          clause: obligation.clause,
          sourceUrl: `session://${hash}`,
        },
        confidence: obligation.confidence,
        status: "expert_review",
        reason: "VerdaTrace-extracted finding awaiting human evidence review.",
        evidenceIds: [],
        reviewerState: "pending",
      }),
    );

    const result = analysisResultSchema.parse({
      document: { ...modelResult.document, hash },
      obligations,
      warnings: [
        ...modelResult.warnings,
        "Automated extraction is not a legal compliance determination.",
      ],
      processingMs: Date.now() - startedAt,
      model: "VerdaTrace Intelligence",
    });
    return NextResponse.json(result, {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    console.error("Analyze route failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "The model response failed schema validation."
            : "The document could not be analyzed.",
      },
      { status: 500 },
    );
  }
}
