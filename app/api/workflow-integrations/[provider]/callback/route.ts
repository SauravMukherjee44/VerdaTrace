import { NextResponse } from "next/server";
import { clearGoogleIntegrationFlowCookie, googleOAuthConfig, readGoogleIntegrationFlow, readWorkflowIdentity } from "@/lib/workflow-auth";
import { saveWorkflowIntegration } from "@/lib/workflow-store";
import { encryptOAuthTokens } from "@/lib/workflow-token-crypto";

const capabilities = { gmail: ["gmail.send"], drive: ["drive.file"] } as const;
const requiredScopes = {
  gmail: "https://www.googleapis.com/auth/gmail.send",
  drive: "https://www.googleapis.com/auth/drive.file",
} as const;

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const identity = await readWorkflowIdentity(request);
  const flow = await readGoogleIntegrationFlow(request);
  const { provider } = await context.params;
  const url = new URL(request.url);
  if (!identity || !flow || flow.ownerId !== identity.sub || flow.provider !== provider || flow.state !== url.searchParams.get("state")) {
    return NextResponse.json({ error: "The integration response is invalid or expired." }, { status: 400 });
  }
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Google did not authorize this capability." }, { status: 400 });
  const { clientId, clientSecret } = googleOAuthConfig();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId!, client_secret: clientSecret!,
      redirect_uri: `${url.origin}/api/workflow-integrations/${provider}/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
  const typedProvider = provider as "gmail" | "drive";
  const grantedScopes = new Set((tokens.scope ?? "").split(/\s+/).filter(Boolean));
  if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token || !grantedScopes.has(requiredScopes[typedProvider])) {
    return NextResponse.json({ error: "Google did not return a durable capability token. Reconnect and approve offline access." }, { status: 502 });
  }
  const now = new Date().toISOString();
  await saveWorkflowIntegration({
    id: crypto.randomUUID(), ownerId: identity.sub, provider: typedProvider,
    capabilities: [...capabilities[typedProvider]], status: "connected",
    displayName: identity.email,
    tokenCiphertext: await encryptOAuthTokens(tokens), createdAt: now, updatedAt: now,
  });
  const response = NextResponse.redirect(new URL(flow.returnTo, url.origin));
  response.headers.set("cache-control", "no-store");
  response.headers.append("set-cookie", clearGoogleIntegrationFlowCookie(request));
  return response;
}
