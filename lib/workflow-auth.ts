const WORKFLOW_SESSION_COOKIE = "verdatrace_pilot";
const GOOGLE_FLOW_COOKIE = "verdatrace_google_flow";
const GOOGLE_INTEGRATION_FLOW_COOKIE = "verdatrace_google_integration_flow";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const FLOW_TTL_SECONDS = 10 * 60;

type RuntimeEnv = {
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  WORKFLOW_SESSION_SECRET?: string;
};

export type WorkflowIdentity = {
  sub: string;
  email: string;
  name: string;
  csrf: string;
  exp: number;
};

type GoogleFlow = {
  state: string;
  nonce: string;
  returnTo: string;
  exp: number;
};

type GoogleIntegrationFlow = {
  state: string;
  ownerId: string;
  provider: "gmail" | "drive";
  returnTo: string;
  exp: number;
};

function runtimeEnv(): RuntimeEnv {
  return (
    globalThis as typeof globalThis & {
      __CANOPY_RUNTIME_ENV__?: RuntimeEnv;
    }
  ).__CANOPY_RUNTIME_ENV__ ?? {};
}

function secret() {
  return runtimeEnv().WORKFLOW_SESSION_SECRET ?? process.env.WORKFLOW_SESSION_SECRET;
}

export function googleOAuthConfig() {
  const env = runtimeEnv();
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret =
    env.GOOGLE_OAUTH_CLIENT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  return { clientId, clientSecret };
}

export function workflowAuthConfigured() {
  const config = googleOAuthConfig();
  return Boolean(
    config.clientId &&
      config.clientSecret &&
      secret() &&
      secret()!.length >= 32,
  );
}

function base64UrlEncode(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(value: string) {
  const signingSecret = secret();
  if (!signingSecret) throw new Error("Workflow authentication is not configured.");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

async function seal(value: object) {
  const encoded = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return `${encoded}.${base64UrlEncode(await hmac(encoded))}`;
}

async function unseal<T>(token: string): Promise<T | null> {
  const [payload, provided, extra] = token.split(".");
  if (!payload || !provided || extra) return null;
  try {
    const expected = await hmac(payload);
    const actual = base64UrlDecode(provided);
    if (expected.length !== actual.length) return null;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
      difference |= expected[index] ^ actual[index];
    }
    if (difference !== 0) return null;
    return JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payload)),
    ) as T;
  } catch {
    return null;
  }
}

function cookieValue(request: Request, name: string) {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}

function secureCookie(request: Request) {
  return (
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https"
  );
}

function serializeCookie(
  request: Request,
  name: string,
  value: string,
  maxAge: number,
) {
  return [
    `${name}=${value}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
    secureCookie(request) ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function createWorkflowSession(
  request: Request,
  identity: Pick<WorkflowIdentity, "sub" | "email" | "name">,
) {
  const payload: WorkflowIdentity = {
    ...identity,
    csrf: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  return serializeCookie(
    request,
    WORKFLOW_SESSION_COOKIE,
    await seal(payload),
    SESSION_TTL_SECONDS,
  );
}

export async function readWorkflowIdentity(
  request: Request,
): Promise<WorkflowIdentity | null> {
  const token = cookieValue(request, WORKFLOW_SESSION_COOKIE);
  if (token) {
    const identity = await unseal<WorkflowIdentity>(token);
    if (
      identity &&
      typeof identity.sub === "string" &&
      typeof identity.email === "string" &&
      typeof identity.name === "string" &&
      typeof identity.csrf === "string" &&
      typeof identity.exp === "number" &&
      identity.exp > Math.floor(Date.now() / 1000)
    ) {
      return identity;
    }
  }

  const siteUserId = request.headers.get("oai-authenticated-user-id");
  const siteEmail = request.headers.get("oai-authenticated-user-email");
  if (siteUserId && siteEmail) {
    return {
      sub: `site:${siteUserId}`,
      email: siteEmail,
      name: siteEmail,
      csrf: "site-header-authenticated",
      exp: Math.floor(Date.now() / 1000) + 300,
    };
  }
  return null;
}

export async function requireWorkflowIdentity(request: Request) {
  const identity = await readWorkflowIdentity(request);
  if (!identity) throw new Error("AUTH_REQUIRED");
  return identity;
}

export async function requireWorkflowMutation(request: Request) {
  const identity = await requireWorkflowIdentity(request);
  const csrf = request.headers.get("x-csrf-token");
  if (identity.csrf !== "site-header-authenticated" && csrf !== identity.csrf) {
    throw new Error("CSRF_INVALID");
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 160) {
    throw new Error("IDEMPOTENCY_REQUIRED");
  }
  return { identity, idempotencyKey };
}

export function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/demo#workflow-orchestrator";
  try {
    const url = new URL(value, "https://verdatrace.local");
    if (url.origin !== "https://verdatrace.local") return "/demo#workflow-orchestrator";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/demo#workflow-orchestrator";
  }
}

export async function createGoogleFlow(request: Request, returnTo: string) {
  const flow: GoogleFlow = {
    state: crypto.randomUUID(),
    nonce: crypto.randomUUID(),
    returnTo: safeReturnTo(returnTo),
    exp: Math.floor(Date.now() / 1000) + FLOW_TTL_SECONDS,
  };
  return {
    flow,
    cookie: serializeCookie(
      request,
      GOOGLE_FLOW_COOKIE,
      await seal(flow),
      FLOW_TTL_SECONDS,
    ),
  };
}

export async function readGoogleFlow(request: Request) {
  const token = cookieValue(request, GOOGLE_FLOW_COOKIE);
  if (!token) return null;
  const flow = await unseal<GoogleFlow>(token);
  if (!flow || flow.exp <= Math.floor(Date.now() / 1000)) return null;
  return flow;
}

export function clearGoogleFlowCookie(request: Request) {
  return serializeCookie(request, GOOGLE_FLOW_COOKIE, "", 0);
}

export function clearWorkflowSessionCookie(request: Request) {
  return serializeCookie(request, WORKFLOW_SESSION_COOKIE, "", 0);
}

export async function createGoogleIntegrationFlow(
  request: Request,
  ownerId: string,
  provider: "gmail" | "drive",
  returnTo: string,
) {
  const flow: GoogleIntegrationFlow = {
    state: crypto.randomUUID(),
    ownerId,
    provider,
    returnTo: safeReturnTo(returnTo),
    exp: Math.floor(Date.now() / 1000) + FLOW_TTL_SECONDS,
  };
  return {
    flow,
    cookie: serializeCookie(
      request,
      GOOGLE_INTEGRATION_FLOW_COOKIE,
      await seal(flow),
      FLOW_TTL_SECONDS,
    ),
  };
}

export async function readGoogleIntegrationFlow(request: Request) {
  const token = cookieValue(request, GOOGLE_INTEGRATION_FLOW_COOKIE);
  if (!token) return null;
  const flow = await unseal<GoogleIntegrationFlow>(token);
  if (!flow || flow.exp <= Math.floor(Date.now() / 1000)) return null;
  return flow;
}

export function clearGoogleIntegrationFlowCookie(request: Request) {
  return serializeCookie(request, GOOGLE_INTEGRATION_FLOW_COOKIE, "", 0);
}
