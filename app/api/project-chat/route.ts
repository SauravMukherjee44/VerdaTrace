import { NextResponse } from "next/server";
import { z } from "zod";
import { demoObligations, revisions, sourceDocuments } from "@/lib/demo-data";
import {
  checkAssistantRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

const MODEL = "gemini-3.1-flash-lite";
const workspaceTabSchema = z.enum([
  "overview",
  "ledger",
  "revisions",
  "inspection",
  "documents",
  "agent",
]);
const agentActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("navigate"),
    tab: workspaceTabSchema,
    label: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("filter_obligations"),
    status: z.enum([
      "all",
      "verified",
      "partial",
      "missing_evidence",
      "not_yet_due",
      "superseded",
      "expert_review",
    ]),
    label: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("search_obligations"),
    query: z.string().min(1).max(120),
    label: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("open_upload"),
    label: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("export_report"),
    label: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("reset_filters"),
    label: z.string().min(1).max(120),
  }),
]);
const modelResponseSchema = z.object({
  answer: z.string().min(1).max(5000),
  actions: z
    .array(
      z.object({
        type: z.enum([
          "navigate",
          "filter_obligations",
          "search_obligations",
          "open_upload",
          "export_report",
          "reset_filters",
        ]),
        tab: workspaceTabSchema.nullable().optional(),
        status: z
          .enum([
            "all",
            "verified",
            "partial",
            "missing_evidence",
            "not_yet_due",
            "superseded",
            "expert_review",
          ])
          .nullable()
          .optional(),
        query: z.string().max(120).nullable().optional(),
        label: z.string().min(1).max(120),
      }),
    )
    .max(3)
    .default([]),
});
const requestSchema = z.object({
  question: z.string().trim().min(2).max(1500),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1800),
      }),
    )
    .max(8)
    .default([]),
});

const projectContext = JSON.stringify({
  project: {
    id: "FP/KA/ROAD/7440/2014",
    name: "Zeenath approach road",
    location: "Ballari, Karnataka",
  },
  obligations: demoObligations.map((item) => ({
    id: item.id,
    clause: item.clause,
    requirement: item.requirement,
    status: item.status,
    reason: item.reason,
    responsibleParty: item.responsibleParty,
    citation: `${item.citation.documentTitle}, page ${item.citation.page}, ${item.citation.clause}`,
  })),
  revisions,
  sources: sourceDocuments.map((item) => ({
    title: item.title,
    date: item.date,
    authority: item.authority,
  })),
});

const responseSchema = {
  type: "OBJECT",
  properties: {
    answer: { type: "STRING" },
    actions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: {
            type: "STRING",
            enum: [
              "navigate",
              "filter_obligations",
              "search_obligations",
              "open_upload",
              "export_report",
              "reset_filters",
            ],
          },
          tab: {
            type: "STRING",
            enum: [
              "overview",
              "ledger",
              "revisions",
              "inspection",
              "documents",
              "agent",
            ],
            nullable: true,
          },
          status: {
            type: "STRING",
            enum: [
              "all",
              "verified",
              "partial",
              "missing_evidence",
              "not_yet_due",
              "superseded",
              "expert_review",
            ],
            nullable: true,
          },
          query: { type: "STRING", nullable: true },
          label: { type: "STRING" },
        },
        required: ["type", "label"],
      },
    },
  },
  required: ["answer", "actions"],
} as const;

export async function POST(request: Request) {
  const limit = await checkAssistantRateLimit(request);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          "The public assistant limit has been reached. Continue exploring the workspace or try again after the limit resets.",
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
      { error: "Ask a concise question about this project." },
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
      { error: "The project assistant is not configured in this environment." },
      { status: 503, headers: rateLimitHeaders(limit) },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
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
                  "You are VerdaTrace Assistant, a source-grounded project review aide.",
                  "Answer only from the supplied project record. If the record is insufficient, say what evidence is missing.",
                  "Cite obligation IDs, document titles, pages, and clauses whenever relevant.",
                  "Never make a legal compliance determination. Distinguish missing evidence from non-compliance.",
                  "Be concise, operational, and transparent about uncertainty.",
                  "When the user asks you to change the workspace, include up to three actions from this exact allowlist:",
                  "navigate(tab), filter_obligations(status), search_obligations(query), open_upload, export_report, reset_filters.",
                  "Use navigate for opening overview, ledger, revisions, inspection, documents, or agent.",
                  "A filter or search action automatically opens the obligation ledger.",
                  "Never change reviewer approval state. If asked to approve or reject a finding, navigate/search for it and tell the user that final confirmation remains theirs.",
                  "Return one JSON object with answer and actions. For a question that needs no workspace change, return an empty actions array.",
                  `PROJECT RECORD:\n${projectContext}`,
                ].join("\n"),
              },
            ],
          },
          contents: [
            ...input.history.map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }],
            })),
            { role: "user", parts: [{ text: input.question }] },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      },
    );
    if (!response.ok) {
      console.error(
        "Project assistant request failed",
        response.status,
        (await response.text()).slice(0, 400),
      );
      return NextResponse.json(
        { error: "The project assistant is temporarily unavailable." },
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
        { error: "The project assistant returned no answer." },
        { status: 502, headers: rateLimitHeaders(limit) },
      );
    }
    const rawResult = modelResponseSchema.parse(JSON.parse(text));
    const result = {
      answer: rawResult.answer,
      actions: rawResult.actions.flatMap((action) => {
        const parsed = agentActionSchema.safeParse(action);
        return parsed.success ? [parsed.data] : [];
      }),
    };
    return NextResponse.json(
      result,
      { headers: rateLimitHeaders(limit) },
    );
  } catch (error) {
    console.error("Project assistant failed", error);
    return NextResponse.json(
      { error: "The project assistant could not answer right now." },
      { status: 502, headers: rateLimitHeaders(limit) },
    );
  } finally {
    clearTimeout(timeout);
  }
}
