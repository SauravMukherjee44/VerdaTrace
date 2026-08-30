import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { z } from "zod";
import { createGoogleIntegrationFlow, googleOAuthConfig, readWorkflowIdentity, requireWorkflowMutation, safeReturnTo, workflowAuthConfigured } from "@/lib/workflow-auth";
import { readIdempotentResult, saveIdempotentResult, saveWorkflowIntegration } from "@/lib/workflow-store";
import { encryptOAuthTokens } from "@/lib/workflow-token-crypto";

const scopes = {
  gmail: "https://www.googleapis.com/auth/gmail.send",
  drive: "https://www.googleapis.com/auth/drive.file",
} as const;

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const identity = await readWorkflowIdentity(request);
  if (!identity) return NextResponse.redirect(new URL("/api/workflow-auth/google?returnTo=%2Fdemo%23workflow-orchestrator", request.url));
  const { provider } = await context.params;
  if (!(provider in scopes)) return NextResponse.json({ error: "Choose Gmail or Drive." }, { status: 400 });
  if (!workflowAuthConfigured()) return NextResponse.json({ error: "Google integrations are not configured in this environment." }, { status: 503 });
  const typedProvider = provider as keyof typeof scopes;
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const { flow, cookie } = await createGoogleIntegrationFlow(request, identity.sub, typedProvider, returnTo);
  const { clientId } = googleOAuthConfig();
  const redirectUri = `${url.origin}/api/workflow-integrations/${typedProvider}/callback`;
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.searchParams.set("client_id", clientId!);
  authorization.searchParams.set("redirect_uri", redirectUri);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", `openid email ${scopes[typedProvider]}`);
  authorization.searchParams.set("state", flow.state);
  authorization.searchParams.set("access_type", "offline");
  authorization.searchParams.set("include_granted_scopes", "true");
  authorization.searchParams.set("prompt", "consent");
  return NextResponse.redirect(authorization, { headers: { "set-cookie": cookie, "cache-control": "no-store" } });
}

const webhookSchema = z.object({
  url: z.string().url().max(1000),
  displayName: z.string().trim().min(1).max(180),
});

function privateAddress(address: string) {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  const parts = address.split(".").map(Number);
  return parts.length === 4 && (
    parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await context.params;
    if (provider !== "webhook") return NextResponse.json({ error: "Use the Google authorization flow for Gmail or Drive." }, { status: 405 });
    const { identity, idempotencyKey } = await requireWorkflowMutation(request);
    const previous = await readIdempotentResult<Record<string, unknown>>(identity.sub, idempotencyKey);
    if (previous) return NextResponse.json(previous);
    const input = webhookSchema.parse(await request.json());
    const url = new URL(input.url);
    if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") {
      return NextResponse.json({ error: "Webhooks require a standard HTTPS destination without embedded credentials." }, { status: 400 });
    }
    if (url.hostname === "localhost" || (isIP(url.hostname) && privateAddress(url.hostname))) {
      return NextResponse.json({ error: "Private-network webhook destinations are not allowed." }, { status: 400 });
    }
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) {
      return NextResponse.json({ error: "The webhook destination resolves to a blocked network." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const signingSecret = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    await saveWorkflowIntegration({
      id: crypto.randomUUID(), ownerId: identity.sub, provider: "webhook",
      capabilities: ["webhook.send_derived_only"], status: "connected", displayName: input.displayName,
      tokenCiphertext: await encryptOAuthTokens({ url: url.toString(), signingSecret, redirects: "disabled", rawDocuments: false }),
      createdAt: now, updatedAt: now,
    });
    const result = { connected: true, provider: "webhook", displayName: input.displayName };
    await saveIdempotentResult(identity.sub, idempotencyKey, result);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "AUTH_REQUIRED" ? 401 : code === "CSRF_INVALID" ? 403 : code === "IDEMPOTENCY_REQUIRED" ? 400 : error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "The webhook could not be configured." : code || "Provide a valid webhook destination." }, { status });
  }
}
