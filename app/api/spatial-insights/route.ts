import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkAssistantRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import {
  spatialAnalysisResultSchema,
  spatialInsightSchema,
} from "@/lib/spatial";

export const runtime = "nodejs";

const MODEL = "gemini-3.1-flash-lite";

const requestSchema = z.object({
  question: z.string().trim().max(800).default(""),
  analysis: spatialAnalysisResultSchema,
});

const responseSchema = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    answer: { type: "STRING" },
    riskSignal: {
      type: "STRING",
      enum: ["review", "monitor", "insufficient_evidence"],
    },
    confidenceSummary: { type: "STRING" },
    evidenceBoundary: { type: "STRING" },
    actions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          priority: { type: "INTEGER" },
          title: { type: "STRING" },
          rationale: { type: "STRING" },
          requiredEvidence: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
        },
        required: [
          "priority",
          "title",
          "rationale",
          "requiredEvidence",
        ],
      },
    },
  },
  required: [
    "headline",
    "answer",
    "riskSignal",
    "confidenceSummary",
    "evidenceBoundary",
    "actions",
  ],
} as const;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const limit = await checkAssistantRateLimit(request);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          "The public spatial-intelligence limit has been reached. You can continue exploring the precomputed comparison or try again later.",
      },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(limit),
          "retry-after": String(limit.retryAfterSeconds),
        },
      },
    );
  }

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "The spatial evidence request is incomplete or invalid." },
      { status: 400, headers: rateLimitHeaders(limit) },
    );
  }

  const runtimeEnv = (
    globalThis as typeof globalThis & {
      __CANOPY_RUNTIME_ENV__?: { GEMINI_API_KEY?: string };
    }
  ).__CANOPY_RUNTIME_ENV__;
  const apiKey = runtimeEnv?.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Spatial intelligence is not configured in this environment." },
      { status: 503, headers: rateLimitHeaders(limit) },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const evidenceContext = {
      project: {
        id: "FP/KA/ROAD/7440/2014",
        name: "Zeenath approach road",
        location: "Ballari, Karnataka",
      },
      spatialAnalysis: {
        id: input.analysis.id,
        computedAt: input.analysis.computedAt,
        geometry: input.analysis.geometry,
        baselinePeriod: input.analysis.baselinePeriod,
        currentPeriod: input.analysis.currentPeriod,
        confidenceThreshold: input.analysis.confidenceThreshold,
        coveragePercent: input.analysis.coveragePercent,
        lowConfidencePercent: input.analysis.lowConfidencePercent,
        classes: input.analysis.classes,
        changeSignals: input.analysis.changeSignals,
        methodology: input.analysis.methodology,
        attribution: input.analysis.attribution,
      },
      criticalBoundary: input.analysis.evidenceBoundary,
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: [
                  "You are VerdaTrace Spatial Analyst, a bounded environmental evidence-review agent.",
                  "Interpret only the supplied numerical land-cover comparison and geometry metadata.",
                  "The supplied statistics were computed for the validated polygon by Earth Engine; do not claim anything beyond those measurements.",
                  "Never decide legal compliance, causation, ecological harm, or project guilt.",
                  "Use 'review signal', 'evidence gap', or 'requires verification' language.",
                  "Treat low imagery coverage or a high low-confidence share as insufficient evidence.",
                  "Actions must be concrete, editable inspection or evidence-collection tasks.",
                  "Return concise JSON matching the requested schema.",
                  `EVIDENCE CONTEXT:\n${JSON.stringify(evidenceContext)}`,
                ].join("\n"),
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    input.question ||
                    "Interpret the change signal and propose the safest next review actions.",
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 900,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "Spatial intelligence request failed",
        response.status,
        (await response.text()).slice(0, 400),
      );
      return NextResponse.json(
        { error: "Spatial intelligence is temporarily unavailable." },
        { status: 502, headers: rateLimitHeaders(limit) },
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) {
      return NextResponse.json(
        { error: "Spatial intelligence returned no review." },
        { status: 502, headers: rateLimitHeaders(limit) },
      );
    }

    const result = spatialInsightSchema.parse({
      ...JSON.parse(text),
      processingMs: Date.now() - startedAt,
    });
    return NextResponse.json(result, {
      headers: rateLimitHeaders(limit),
    });
  } catch (error) {
    console.error("Spatial intelligence error", error);
    return NextResponse.json(
      { error: "Spatial intelligence could not complete this review." },
      { status: 502, headers: rateLimitHeaders(limit) },
    );
  } finally {
    clearTimeout(timeout);
  }
}
