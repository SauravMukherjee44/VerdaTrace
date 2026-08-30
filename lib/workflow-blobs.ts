import { getStore } from "@netlify/blobs";
import {
  getMemoryUploadChunk,
  setMemoryUploadChunk,
} from "@/lib/workflow-store";

function encryptionSecret() {
  return process.env.WORKFLOW_DATA_ENCRYPTION_KEY;
}

function ownedBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

async function encryptionKey() {
  const secret = encryptionSecret();
  if (!secret) {
    if (process.env.NETLIFY === "true") {
      throw new Error("Workflow blob encryption is not configured.");
    }
    return null;
  }
  let bytes: Uint8Array;
  if (/^[a-f0-9]{64}$/i.test(secret)) {
    bytes = Uint8Array.from(
      secret.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)),
    );
  } else {
    const binary = atob(secret.replace(/-/g, "+").replace(/_/g, "/"));
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  if (bytes.length !== 32) {
    throw new Error("WORKFLOW_DATA_ENCRYPTION_KEY must contain 32 bytes.");
  }
  return crypto.subtle.importKey("raw", ownedBuffer(bytes), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encrypt(value: Uint8Array) {
  const key = await encryptionKey();
  if (!key) return value;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: ownedBuffer(iv) }, key, ownedBuffer(value)),
  );
  const combined = new Uint8Array(1 + iv.length + encrypted.length);
  combined[0] = 1;
  combined.set(iv, 1);
  combined.set(encrypted, 13);
  return combined;
}

async function decrypt(value: Uint8Array) {
  if (value[0] !== 1) return value;
  const key = await encryptionKey();
  if (!key) throw new Error("Encrypted workflow data cannot be opened.");
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ownedBuffer(value.slice(1, 13)) },
      key,
      ownedBuffer(value.slice(13)),
    ),
  );
}

function chunkKey(uploadId: string, index: number) {
  return `temporary/${uploadId}/chunks/${index}`;
}

function finalKey(uploadId: string) {
  return `source/${uploadId}/original`;
}

function artifactKey(artifactId: string) {
  return `derived/${artifactId}`;
}

export async function putWorkflowChunk(
  uploadId: string,
  index: number,
  value: Uint8Array,
) {
  if (process.env.NETLIFY !== "true") {
    setMemoryUploadChunk(uploadId, index, value);
    return;
  }
  const store = getStore({ name: "workflow-artifacts", consistency: "strong" });
  await store.set(chunkKey(uploadId, index), ownedBuffer(await encrypt(value)));
}

export async function getWorkflowChunk(uploadId: string, index: number) {
  if (process.env.NETLIFY !== "true") {
    return getMemoryUploadChunk(uploadId, index);
  }
  const store = getStore({ name: "workflow-artifacts", consistency: "strong" });
  const value = await store.get(chunkKey(uploadId, index), {
    type: "arrayBuffer",
    consistency: "strong",
  });
  return value ? decrypt(new Uint8Array(value)) : null;
}

export async function finalizeWorkflowBlob(
  uploadId: string,
  value: Uint8Array,
  metadata: Record<string, string>,
) {
  if (process.env.NETLIFY !== "true") return;
  const store = getStore({ name: "workflow-artifacts", consistency: "strong" });
  await store.set(finalKey(uploadId), ownedBuffer(await encrypt(value)), { metadata });
  await Promise.all(
    Array.from({ length: Number(metadata.chunkCount) }, (_, index) =>
      store.delete(chunkKey(uploadId, index)),
    ),
  );
}

export async function readFinalWorkflowBlob(uploadId: string) {
  if (process.env.NETLIFY !== "true") return null;
  const store = getStore({ name: "workflow-artifacts", consistency: "strong" });
  const value = await store.get(finalKey(uploadId), {
    type: "arrayBuffer",
    consistency: "strong",
  });
  return value ? decrypt(new Uint8Array(value)) : null;
}

export async function deleteWorkflowBlob(uploadId: string) {
  if (process.env.NETLIFY !== "true") return;
  const store = getStore({ name: "workflow-artifacts", consistency: "strong" });
  await store.delete(finalKey(uploadId));
}

export async function putWorkflowArtifactBlob(
  artifactId: string,
  value: Uint8Array,
  metadata: Record<string, string>,
) {
  if (process.env.NETLIFY !== "true") return;
  const store = getStore({ name: "workflow-artifacts", consistency: "strong" });
  await store.set(artifactKey(artifactId), ownedBuffer(await encrypt(value)), { metadata });
}

export async function readWorkflowArtifactBlob(artifactId: string) {
  if (process.env.NETLIFY !== "true") return null;
  const store = getStore({ name: "workflow-artifacts", consistency: "strong" });
  const value = await store.get(artifactKey(artifactId), {
    type: "arrayBuffer",
    consistency: "strong",
  });
  return value ? decrypt(new Uint8Array(value)) : null;
}

export async function deleteWorkflowArtifactBlob(artifactId: string) {
  if (process.env.NETLIFY !== "true") return;
  const store = getStore({ name: "workflow-artifacts", consistency: "strong" });
  await store.delete(artifactKey(artifactId));
}
