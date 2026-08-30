function tokenSecret() {
  return process.env.OAUTH_TOKEN_ENCRYPTION_KEY ?? process.env.WORKFLOW_DATA_ENCRYPTION_KEY;
}

async function key() {
  const secret = tokenSecret();
  if (!secret) throw new Error("OAuth token encryption is not configured.");
  const bytes = /^[a-f0-9]{64}$/i.test(secret)
    ? Uint8Array.from(secret.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)))
    : Uint8Array.from(atob(secret.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0));
  if (bytes.length !== 32) throw new Error("OAuth token encryption must contain 32 bytes.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function decode(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function encryptOAuthTokens(value: object) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(),
    new TextEncoder().encode(JSON.stringify(value)),
  ));
  const payload = new Uint8Array(iv.length + encrypted.length);
  payload.set(iv, 0);
  payload.set(encrypted, iv.length);
  return btoa(String.fromCharCode(...payload));
}

export async function decryptOAuthTokens<T>(value: string): Promise<T> {
  const payload = decode(value);
  if (payload.byteLength < 29) throw new Error("Stored capability token is invalid.");
  const iv = payload.slice(0, 12);
  const encrypted = payload.slice(12);
  const ivBuffer = new Uint8Array(iv.byteLength);
  ivBuffer.set(iv);
  const encryptedBuffer = new Uint8Array(encrypted.byteLength);
  encryptedBuffer.set(encrypted);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer.buffer },
    await key(),
    encryptedBuffer.buffer,
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}
