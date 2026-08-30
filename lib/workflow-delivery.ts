import { Buffer } from "node:buffer";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { googleOAuthConfig } from "@/lib/workflow-auth";
import { readWorkflowArtifactBlob } from "@/lib/workflow-blobs";
import { getWorkflowIntegration } from "@/lib/workflow-store";
import { decryptOAuthTokens } from "@/lib/workflow-token-crypto";
import type { WorkflowRun } from "@/lib/workflow";

type GoogleTokens = { refresh_token?: string };
type WebhookConfig = { url: string; signingSecret: string; rawDocuments: false };

function reportArtifact(run: WorkflowRun) {
  const ref = run.steps.find((step) => step.id === "report")?.outputRef;
  const id = ref?.match(/\/api\/workflow-artifacts\/([a-f0-9-]+)/i)?.[1];
  if (!id) throw new Error("APPROVED_REPORT_UNAVAILABLE");
  return id;
}

async function googleAccessToken(ciphertext: string) {
  const tokens = await decryptOAuthTokens<GoogleTokens>(ciphertext);
  if (!tokens.refresh_token) throw new Error("INTEGRATION_RECONNECT_REQUIRED");
  const { clientId, clientSecret } = googleOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId!, client_secret: clientSecret!,
      refresh_token: tokens.refresh_token, grant_type: "refresh_token",
    }),
  });
  const value = await response.json() as { access_token?: string };
  if (!response.ok || !value.access_token) throw new Error("INTEGRATION_RECONNECT_REQUIRED");
  return value.access_token;
}

function base64Url(value: string) {
  return Buffer.from(value).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function privateAddress(address: string) {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  const parts = address.split(".").map(Number);
  return parts.length === 4 && (parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168));
}

async function assertPublicWebhook(url: URL) {
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("WEBHOOK_DESTINATION_BLOCKED");
  if (url.hostname === "localhost" || (isIP(url.hostname) && privateAddress(url.hostname))) throw new Error("WEBHOOK_DESTINATION_BLOCKED");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) throw new Error("WEBHOOK_DESTINATION_BLOCKED");
}

async function signature(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((part) => part.toString(16).padStart(2, "0")).join("");
}

export async function deliverApprovedShare(run: WorkflowRun) {
  const draft = run.shareDraft;
  if (!draft?.provider || draft.deliveryState !== "approved") throw new Error("DELIVERY_NOT_APPROVED");
  const connection = await getWorkflowIntegration(run.ownerId, draft.provider);
  if (!connection || connection.status !== "connected" || !connection.tokenCiphertext) throw new Error("INTEGRATION_NOT_CONNECTED");
  const artifactId = reportArtifact(run);
  const report = await readWorkflowArtifactBlob(artifactId);
  if (!report) throw new Error("APPROVED_REPORT_UNAVAILABLE");

  if (draft.provider === "gmail") {
    if (!draft.recipients.length) throw new Error("DELIVERY_RECIPIENT_REQUIRED");
    const token = await googleAccessToken(connection.tokenCiphertext);
    const boundary = `verdatrace_${crypto.randomUUID().replaceAll("-", "")}`;
    const mime = [
      `To: ${draft.recipients.join(", ")}`,
      `Subject: ${draft.subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary=${boundary}`,
      "", `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "", draft.message,
      `--${boundary}`, "Content-Type: application/json", "Content-Disposition: attachment; filename=VerdaTrace-review-package.json",
      "Content-Transfer-Encoding: base64", "", Buffer.from(report).toString("base64"), `--${boundary}--`, "",
    ].join("\r\n");
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ raw: base64Url(mime) }),
    });
    const result = await response.json() as { id?: string };
    if (!response.ok || !result.id) throw new Error(response.status >= 500 ? "DELIVERY_TRANSIENT_FAILURE" : "DELIVERY_PERMISSION_FAILED");
    return { provider: "gmail" as const, reference: result.id, summary: `Approved email sent to ${draft.recipients.length} recipient${draft.recipients.length === 1 ? "" : "s"}.` };
  }

  if (draft.provider === "drive") {
    const token = await googleAccessToken(connection.tokenCiphertext);
    const boundary = `verdatrace_${crypto.randomUUID().replaceAll("-", "")}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: `${run.projectName} · VerdaTrace review package.json`, mimeType: "application/json" })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`),
      Buffer.from(report), Buffer.from(`\r\n--${boundary}--`),
    ]);
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": `multipart/related; boundary=${boundary}` }, body,
    });
    const result = await response.json() as { id?: string; webViewLink?: string };
    if (!response.ok || !result.id) throw new Error(response.status >= 500 ? "DELIVERY_TRANSIENT_FAILURE" : "DELIVERY_PERMISSION_FAILED");
    return { provider: "drive" as const, reference: result.webViewLink ?? result.id, summary: "Approved review package uploaded to the connected Drive." };
  }

  const config = await decryptOAuthTokens<WebhookConfig>(connection.tokenCiphertext);
  const url = new URL(config.url);
  await assertPublicWebhook(url);
  const payload = JSON.stringify({
    event: "verdatrace.report.approved", runId: run.id, projectId: run.projectId,
    projectName: run.projectName, workspaceVersion: run.workspaceVersion,
    report: JSON.parse(new TextDecoder().decode(report)),
  });
  if (Buffer.byteLength(payload) > 256 * 1024) throw new Error("WEBHOOK_PAYLOAD_TOO_LARGE");
  const response = await fetch(url, {
    method: "POST", redirect: "error",
    headers: { "content-type": "application/json", "x-verdatrace-signature": `sha256=${await signature(config.signingSecret, payload)}` },
    body: payload,
  });
  if (!response.ok) throw new Error(response.status >= 500 ? "DELIVERY_TRANSIENT_FAILURE" : "DELIVERY_PERMISSION_FAILED");
  return { provider: "webhook" as const, reference: url.origin, summary: "Approved derived report payload delivered to the signed webhook. Raw sources were not included." };
}
