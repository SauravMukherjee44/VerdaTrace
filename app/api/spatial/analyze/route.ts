import { NextResponse } from "next/server";
import {
  analyzeWithEarthEngine,
  isEarthEngineConfigured,
} from "@/lib/earth-engine";
import {
  checkSpatialRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import {
  spatialAnalysisRequestSchema,
  spatialAnalysisResultSchema,
} from "@/lib/spatial";
import { verifySpatialGeometryPayload } from "@/lib/spatial-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = await checkSpatialRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error:
          "The public spatial-compute limit has been reached. Existing map results remain available until their tile session expires.",
        code: "SPATIAL_RATE_LIMIT",
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
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 5 * 1024 * 1024) {
    return NextResponse.json(
      {
        error: "The spatial request exceeds the 5 MB compute limit.",
        code: "invalid_geometry",
      },
      { status: 413, headers: rateLimitHeaders(rateLimit) },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The spatial request must be valid JSON.", code: "invalid_geometry" },
      { status: 400, headers: rateLimitHeaders(rateLimit) },
    );
  }
  const parsed = spatialAnalysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid spatial request.",
        code: "invalid_geometry",
      },
      { status: 400, headers: rateLimitHeaders(rateLimit) },
    );
  }
  try {
    await verifySpatialGeometryPayload(parsed.data.geometry);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid spatial geometry.",
        code: "invalid_geometry",
      },
      { status: 400, headers: rateLimitHeaders(rateLimit) },
    );
  }
  if (!isEarthEngineConfigured()) {
    return NextResponse.json(
      {
        error:
          "Live Earth Engine analysis is not configured in this deployment. The real satellite map remains available, but parcel statistics are disabled.",
        code: "spatial_not_configured",
      },
      { status: 503, headers: rateLimitHeaders(rateLimit) },
    );
  }

  try {
    const result = spatialAnalysisResultSchema.parse(
      await analyzeWithEarthEngine(parsed.data),
    );
    return NextResponse.json(result, {
      headers: {
        ...rateLimitHeaders(rateLimit),
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Earth Engine spatial analysis failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Earth Engine could not complete this spatial analysis.",
        code: "spatial_compute_failed",
      },
      { status: 502, headers: rateLimitHeaders(rateLimit) },
    );
  }
}
