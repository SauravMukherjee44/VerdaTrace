import { NextResponse } from "next/server";
import { adminAuthConfigured, readAdminSession } from "@/lib/admin-auth";

export const runtime = "edge";

export async function GET(request: Request) {
  const session = await readAdminSession(request);
  return NextResponse.json(
    {
      configured: adminAuthConfigured(),
      authenticated: Boolean(session),
      role: session ? "admin" : "demo",
      displayName: session ? "Admin reviewer" : "Demo reviewer",
      rateLimit: session ? "unlimited" : "3 per hour",
    },
    { headers: { "cache-control": "no-store" } },
  );
}

