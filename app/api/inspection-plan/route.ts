import { NextResponse } from "next/server";
import { z } from "zod";
import { createInspectionPlan } from "@/lib/inspection";
import { obligationSchema } from "@/lib/schema";

const requestSchema = z.object({
  obligations: z.array(obligationSchema).max(100),
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    return NextResponse.json({
      tasks: createInspectionPlan(input.obligations),
      generatedAt: new Date().toISOString(),
      method:
        "Deterministic ecological-importance and evidence-gap ranking; human approval required.",
    });
  } catch {
    return NextResponse.json(
      { error: "Provide a valid obligation set." },
      { status: 400 },
    );
  }
}
