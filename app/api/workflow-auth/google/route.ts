import { NextResponse } from "next/server";
import {
  createGoogleFlow,
  googleOAuthConfig,
  safeReturnTo,
  workflowAuthConfigured,
} from "@/lib/workflow-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!workflowAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google pilot sign-in is not configured in this environment. The recorded workflow remains available.",
      },
      { status: 503 },
    );
  }
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const { flow, cookie } = await createGoogleFlow(request, returnTo);
  const { clientId } = googleOAuthConfig();
  const redirectUri = `${url.origin}/api/workflow-auth/google/callback`;
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.searchParams.set("client_id", clientId!);
  authorization.searchParams.set("redirect_uri", redirectUri);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", "openid email profile");
  authorization.searchParams.set("state", flow.state);
  authorization.searchParams.set("nonce", flow.nonce);
  authorization.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(authorization, {
    headers: { "set-cookie": cookie, "cache-control": "no-store" },
  });
}
