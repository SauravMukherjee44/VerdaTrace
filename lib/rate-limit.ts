import { isAdminRequest } from "@/lib/admin-auth";
import {
  getD1Database,
  getNetlifyDatabase,
  type D1DatabaseLike,
} from "@/lib/database";

const WINDOW_MS = 60 * 60 * 1000;
const CLIENT_LIMIT = 3;
const GLOBAL_LIMIT = 30;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 5;
const CONTACT_LIMIT = 2;
const ASSISTANT_LIMIT = 12;
const ASSISTANT_GLOBAL_LIMIT = 120;
const SPATIAL_LIMIT = 3;
const SPATIAL_GLOBAL_LIMIT = 30;
const WORKFLOW_HOURLY_LIMIT = 2;
const WORKFLOW_DAILY_LIMIT = 10;
const WORKFLOW_GLOBAL_HOURLY_LIMIT = 20;

type CounterResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
  mode: "durable" | "netlify-postgres" | "local-fallback" | "admin";
};

const localCounters = new Map<string, number>();
let schemaReady = false;

async function hashClient(request: Request): Promise<string> {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const bytes = new TextEncoder().encode(`${ip}|${userAgent.slice(0, 160)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function hashStableValue(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
}

async function ensureSchema(db: D1DatabaseLike) {
  if (schemaReady) return;
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS api_rate_limits (
      client_hash TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (client_hash, window_start)
    )`,
  ).run();
  await db.prepare(
    "CREATE INDEX IF NOT EXISTS api_rate_limits_updated_idx ON api_rate_limits (updated_at)",
  ).run();
  schemaReady = true;
}

async function incrementDurable(
  db: D1DatabaseLike,
  key: string,
  windowStart: number,
  now: number,
): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO api_rate_limits (client_hash, window_start, request_count, updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(client_hash, window_start)
       DO UPDATE SET request_count = request_count + 1, updated_at = excluded.updated_at
       RETURNING request_count`,
    )
    .bind(key, windowStart, now)
    .first<{ request_count: number }>();
  return row?.request_count ?? 1;
}

async function incrementNetlify(
  key: string,
  windowStart: number,
  now: number,
): Promise<number> {
  const db = await getNetlifyDatabase();
  if (!db) return incrementLocal(`${windowStart}:${key}`);
  const rows = await db.sql<{ request_count: number | string }>`
    INSERT INTO api_rate_limits (
      client_hash, window_start, request_count, updated_at
    )
    VALUES (${key}, ${windowStart}, 1, ${now})
    ON CONFLICT (client_hash, window_start)
    DO UPDATE SET
      request_count = api_rate_limits.request_count + 1,
      updated_at = EXCLUDED.updated_at
    RETURNING request_count
  `;
  return Number(rows[0]?.request_count ?? 1);
}

function incrementLocal(key: string): number {
  const next = (localCounters.get(key) ?? 0) + 1;
  localCounters.set(key, next);
  return next;
}

export async function checkAnalysisRateLimit(
  request: Request,
): Promise<CounterResult> {
  if (await isAdminRequest(request)) {
    return {
      allowed: true,
      remaining: -1,
      retryAfterSeconds: 0,
      limit: -1,
      mode: "admin",
    };
  }

  return checkRateLimit(request, {
    windowMs: WINDOW_MS,
    limit: CLIENT_LIMIT,
    globalLimit: GLOBAL_LIMIT,
    namespace: "analysis",
  });
}

export async function checkLoginRateLimit(
  request: Request,
): Promise<CounterResult> {
  return checkRateLimit(request, {
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_LIMIT,
    namespace: "admin-login",
  });
}

export async function checkContactRateLimit(
  request: Request,
): Promise<CounterResult> {
  return checkRateLimit(request, {
    windowMs: WINDOW_MS,
    limit: CONTACT_LIMIT,
    namespace: "contact",
  });
}

export async function checkAssistantRateLimit(
  request: Request,
): Promise<CounterResult> {
  if (await isAdminRequest(request)) {
    return {
      allowed: true,
      remaining: -1,
      retryAfterSeconds: 0,
      limit: -1,
      mode: "admin",
    };
  }
  return checkRateLimit(request, {
    windowMs: WINDOW_MS,
    limit: ASSISTANT_LIMIT,
    globalLimit: ASSISTANT_GLOBAL_LIMIT,
    namespace: "assistant",
  });
}

export async function checkSpatialRateLimit(
  request: Request,
): Promise<CounterResult> {
  if (await isAdminRequest(request)) {
    return {
      allowed: true,
      remaining: -1,
      retryAfterSeconds: 0,
      limit: -1,
      mode: "admin",
    };
  }
  return checkRateLimit(request, {
    windowMs: WINDOW_MS,
    limit: SPATIAL_LIMIT,
    globalLimit: SPATIAL_GLOBAL_LIMIT,
    namespace: "spatial",
  });
}

export async function checkWorkflowRateLimit(request: Request, ownerId?: string): Promise<{
  allowed: boolean;
  hourly: CounterResult;
  daily: CounterResult;
  retryAfterSeconds: number;
}> {
  if (await isAdminRequest(request)) {
    const admin: CounterResult = {
      allowed: true,
      remaining: -1,
      retryAfterSeconds: 0,
      limit: -1,
      mode: "admin",
    };
    return { allowed: true, hourly: admin, daily: admin, retryAfterSeconds: 0 };
  }

  const hourly = await checkRateLimit(request, {
    windowMs: WINDOW_MS,
    limit: WORKFLOW_HOURLY_LIMIT,
    globalLimit: WORKFLOW_GLOBAL_HOURLY_LIMIT,
    namespace: "workflow-hour",
    subjectHash: ownerId ? await hashStableValue(`workflow:${ownerId}`) : undefined,
  });
  const daily = await checkRateLimit(request, {
    windowMs: 24 * WINDOW_MS,
    limit: WORKFLOW_DAILY_LIMIT,
    namespace: "workflow-day",
    subjectHash: ownerId ? await hashStableValue(`workflow:${ownerId}`) : undefined,
  });
  return {
    allowed: hourly.allowed && daily.allowed,
    hourly,
    daily,
    retryAfterSeconds: Math.max(
      hourly.allowed ? 0 : hourly.retryAfterSeconds,
      daily.allowed ? 0 : daily.retryAfterSeconds,
    ),
  };
}

async function checkRateLimit(
  request: Request,
  options: {
    windowMs: number;
    limit: number;
    namespace: string;
    globalLimit?: number;
    subjectHash?: string;
  },
): Promise<CounterResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / options.windowMs) * options.windowMs;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowStart + options.windowMs - now) / 1000),
  );
  const clientHash = options.subjectHash ?? await hashClient(request);
  const d1 = getD1Database();
  const useNetlifyDatabase =
    !d1 &&
    (process.env.NETLIFY === "true" ||
      Boolean(process.env.NETLIFY_DB_URL));

  let clientCount: number;
  let globalCount = 0;
  let mode: CounterResult["mode"];
  const clientKey = `${options.namespace}:${clientHash}`;
  const globalKey = `${options.namespace}:__global_budget__`;

  if (d1) {
    await ensureSchema(d1);
    const counts = await Promise.all([
      incrementDurable(d1, clientKey, windowStart, now),
      options.globalLimit
        ? incrementDurable(d1, globalKey, windowStart, now)
        : Promise.resolve(0),
    ]);
    [clientCount, globalCount] = counts;
    mode = "durable";
  } else if (useNetlifyDatabase) {
    const counts = await Promise.all([
      incrementNetlify(clientKey, windowStart, now),
      options.globalLimit
        ? incrementNetlify(globalKey, windowStart, now)
        : Promise.resolve(0),
    ]);
    [clientCount, globalCount] = counts;
    mode = "netlify-postgres";
  } else {
    clientCount = incrementLocal(`${windowStart}:${clientKey}`);
    globalCount = options.globalLimit
      ? incrementLocal(`${windowStart}:${globalKey}`)
      : 0;
    mode = "local-fallback";
  }

  const globalRemaining =
    options.globalLimit === undefined
      ? options.limit
      : options.globalLimit - globalCount;
  return {
    allowed:
      clientCount <= options.limit &&
      (options.globalLimit === undefined || globalCount <= options.globalLimit),
    remaining: Math.max(
      0,
      Math.min(options.limit - clientCount, globalRemaining),
    ),
    retryAfterSeconds,
    limit: options.limit,
    mode,
  };
}

export function rateLimitHeaders(result: CounterResult): HeadersInit {
  if (result.mode === "admin") {
    return {
      "cache-control": "no-store",
      "x-ratelimit-limit": "unlimited",
      "x-ratelimit-remaining": "unlimited",
      "x-ratelimit-reset": "0",
      "x-ratelimit-policy": "authenticated-admin",
    };
  }
  return {
    "cache-control": "no-store",
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "x-ratelimit-reset": String(result.retryAfterSeconds),
  };
}
