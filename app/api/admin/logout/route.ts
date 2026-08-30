import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-auth";

export const runtime = "edge";

export async function POST(request: Request) {
  return NextResponse.json(
    { authenticated: false },
    {
      headers: {
        "cache-control": "no-store",
        "set-cookie": clearAdminSessionCookie(request),
      },
    },
  );
}

