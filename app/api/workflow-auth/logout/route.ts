import { NextResponse } from "next/server";
import { clearWorkflowSessionCookie } from "@/lib/workflow-auth";

export async function POST(request: Request) {
  return NextResponse.json(
    { authenticated: false },
    { headers: { "set-cookie": clearWorkflowSessionCookie(request) } },
  );
}
