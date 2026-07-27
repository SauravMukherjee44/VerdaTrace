import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkAssistantRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

const MODEL = "gemini-3.1-flash-lite";

const requestSchema = z.object({
  question: z.string().trim().max(800).default(""),
  parcelLabel: z.string().min(1).max(140),
  baselineYear: z.number().int().min(2015).max(2035),
  currentYear: z.number().int().min(2015).max(2035),
  confidence: z.number().min(0).max(1),
  classes: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        baseline: z.number().min(0).max(100),
        current: z.number().min(0).max(100),
      }),
    )
    .min(2)
    .max(12),
  geometry: z
    .object({
      fileName: z.string().min(1).max(180),
      geometryType: z.string().min(1).max(80),
      featureCount: z.number().int().positive().max(10_000),
      coordinateCount: z.number().int().positive().max(1_000_000),
      bbox: z.tuple([
        z.number(),
        z.number(),
        z.number(),
        z.number(),
      ]),
    })
    .nullable(),
});

const resultSchema = z.object({
  headline: z.string().min(1).max(180),
  answer: z.string().min(1).max(2200),
  riskSignal: z.enum(["review", "monitor", "insufficient_evidence"]),
  confidenceSummary: z.string().min(1).max(420),
  evidenceBoundary: z.string().min(1).max(650),
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
      dynamicWorldComparison: {
        parcelLabel: input.parcelLabel,
        baselineYear: input.baselineYear,
        currentYear: input.currentYear,
        layerConfidence: input.confidence,
        classes: input.classes.map((item) => ({
          ...item,
          deltaPercentagePoints: Number(
            (item.current - item.baseline).toFixed(1),
          ),
        })),
      },
      uploadedGeometryMetadata: input.geometry,
      criticalBoundary:
        "The supplied land-cover values are an illustrative calibration example. They were not computed from the uploaded geometry and are not evidence for the public case. Geometry metadata only confirms that a locally supplied file has a parseable boundary structure.",
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
                  "Never claim that illustrative values came from the uploaded geometry.",
                  "Never decide legal compliance, causation, ecological harm, or project guilt.",
                  "Use 'review signal', 'evidence gap', or 'requires verification' language.",
                  "If geometry is absent, set riskSignal to insufficient_evidence and make geometry collection the first action.",
                  "If geometry exists, acknowledge that the boundary structure parsed, but state that live Dynamic World computation and expert validation are still required.",
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

    const result = resultSchema.parse(JSON.parse(text));
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
