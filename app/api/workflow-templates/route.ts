import { NextResponse } from "next/server";
import { workflowTemplates } from "@/lib/workflow";

export async function GET() {
  return NextResponse.json(
    { templates: workflowTemplates },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
