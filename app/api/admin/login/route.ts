import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminAuthConfigured,
  adminSessionCookie,
  createAdminSession,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import { checkLoginRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(256),
});

export async function POST(request: Request) {
  const rateLimit = await checkLoginRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many sign-in attempts. Try again after the cooldown.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(rateLimit),
          "retry-after": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  if (!adminAuthConfigured()) {
    return NextResponse.json(
      { error: "Administrator access has not been configured." },
      { status: 503 },
    );
  }

  try {
    const input = loginSchema.parse(await request.json());
    if (!(await verifyAdminCredentials(input.username, input.password))) {
      return NextResponse.json(
        { error: "The administrator ID or password is incorrect." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }

    const token = await createAdminSession(input.username);
    return NextResponse.json(
      {
        authenticated: true,
        role: "admin",
        displayName: "Admin reviewer",
        rateLimit: "unlimited",
      },
      {
        headers: {
          "cache-control": "no-store",
          "set-cookie": adminSessionCookie(request, token),
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Provide a valid administrator ID and password." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
}
