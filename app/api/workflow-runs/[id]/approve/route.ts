import { decideWorkflow } from "@/lib/workflow-mutations";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return decideWorkflow(request, (await context.params).id, "approve");
}
