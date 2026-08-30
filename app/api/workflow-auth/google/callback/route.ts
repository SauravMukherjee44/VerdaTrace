import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import {
  clearGoogleFlowCookie,
  createWorkflowSession,
  googleOAuthConfig,
  readGoogleFlow,
} from "@/lib/workflow-auth";

export const runtime = "nodejs";

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const flow = await readGoogleFlow(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!flow || !code || state !== flow.state) {
    return NextResponse.json({ error: "The Google sign-in response is invalid or expired." }, { status: 400 });
  }

  const { clientId, clientSecret } = googleOAuthConfig();
  const redirectUri = `${url.origin}/api/workflow-auth/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await tokenResponse.json()) as { id_token?: string };
  if (!tokenResponse.ok || !tokens.id_token) {
    return NextResponse.json({ error: "Google sign-in could not be completed." }, { status: 502 });
  }

  const verified = await jwtVerify(tokens.id_token, googleKeys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  if (
    verified.payload.nonce !== flow.nonce ||
    verified.payload.email_verified !== true ||
    typeof verified.payload.sub !== "string" ||
    typeof verified.payload.email !== "string"
  ) {
    return NextResponse.json({ error: "Google did not return a verified account." }, { status: 403 });
  }

  const response = NextResponse.redirect(new URL(flow.returnTo, url.origin));
  response.headers.set("cache-control", "no-store");
  response.headers.append(
    "set-cookie",
    await createWorkflowSession(request, {
      sub: `google:${verified.payload.sub}`,
      email: verified.payload.email,
      name:
        typeof verified.payload.name === "string"
          ? verified.payload.name
          : verified.payload.email,
    }),
  );
  response.headers.append("set-cookie", clearGoogleFlowCookie(request));
  return response;
}
