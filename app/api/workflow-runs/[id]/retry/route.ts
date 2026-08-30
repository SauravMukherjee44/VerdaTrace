import { controlWorkflow } from "@/lib/workflow-mutations";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return controlWorkflow(request, (await context.params).id, "retry");
}
