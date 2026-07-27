import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getD1Database,
  getNetlifyDatabase,
  type D1DatabaseLike,
} from "@/lib/database";
import { checkContactRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";

const inquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  workEmail: z.string().trim().email().max(160),
  organization: z.string().trim().min(2).max(160),
  role: z.string().trim().min(2).max(120),
  inquiryType: z.enum([
    "pilot",
    "research",
    "regulator",
    "investment",
    "other",
  ]),
  message: z.string().trim().min(20).max(2000),
  website: z.string().max(240).optional(),
});

async function ensureContactSchema(db: D1DatabaseLike) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS contact_inquiries (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        work_email TEXT NOT NULL,
        organization TEXT NOT NULL,
        role TEXT NOT NULL,
        inquiry_type TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'new'
      )`,
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS contact_inquiries_created_idx ON contact_inquiries (created_at)",
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS contact_inquiries_status_idx ON contact_inquiries (status)",
    )
    .run();
}

export async function POST(request: Request) {
  const rateLimit = await checkContactRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error:
          "This form accepts two inquiries per hour. Please try again after the cooldown.",
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

  try {
    const input = inquirySchema.parse(await request.json());
    if (input.website) {
      return NextResponse.json({ received: true }, { status: 202 });
    }

    const d1 = getD1Database();
    const netlifyDb = d1 ? null : await getNetlifyDatabase();
    if (!d1 && !netlifyDb) {
      return NextResponse.json(
        {
          error:
            "The inquiry service is temporarily unavailable. Please try again shortly.",
        },
        { status: 503 },
      );
    }

    const id = crypto.randomUUID();
    const createdAt = Date.now();
    if (d1) {
      await ensureContactSchema(d1);
      await d1
        .prepare(
          `INSERT INTO contact_inquiries (
            id, name, work_email, organization, role, inquiry_type, message, created_at, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
        )
        .bind(
          id,
          input.name,
          input.workEmail.toLowerCase(),
          input.organization,
          input.role,
          input.inquiryType,
          input.message,
          createdAt,
        )
        .run();
    } else if (netlifyDb) {
      await netlifyDb.sql`
        INSERT INTO contact_inquiries (
          id, name, work_email, organization, role, inquiry_type,
          message, created_at, status
        )
        VALUES (
          ${id},
          ${input.name},
          ${input.workEmail.toLowerCase()},
          ${input.organization},
          ${input.role},
          ${input.inquiryType},
          ${input.message},
          ${createdAt},
          'new'
        )
      `;
    }

    return NextResponse.json(
      {
        received: true,
        reference: `CC-${id.slice(0, 8).toUpperCase()}`,
      },
      { status: 201, headers: rateLimitHeaders(rateLimit) },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Complete each required field with a valid work email and a message of at least 20 characters.",
      },
      { status: 400 },
    );
  }
}
