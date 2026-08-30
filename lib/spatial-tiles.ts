type SpatialTilePayload = {
  urlTemplate: string;
  expiresAt: number;
};

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(`${normalized}${padding}`);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function tileKey(secret: string) {
  if (secret.length < 32) {
    throw new Error("SPATIAL_TILE_SECRET must be at least 32 characters.");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function createSpatialTileToken(
  payload: SpatialTilePayload,
  secret: string,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await tileKey(secret),
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const ciphertext = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, iv.length);
  return base64UrlEncode(combined);
}

export async function readSpatialTileToken(
  token: string,
  secret: string,
): Promise<SpatialTilePayload> {
  if (token.length < 40 || token.length > 2_500) {
    throw new Error("Invalid spatial tile session.");
  }
  const combined = base64UrlDecode(token);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    await tileKey(secret),
    ciphertext,
  );
  const payload = JSON.parse(
    new TextDecoder().decode(decrypted),
  ) as Partial<SpatialTilePayload>;
  if (
    typeof payload.urlTemplate !== "string" ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt <= Date.now()
  ) {
    throw new Error("Spatial tile session expired.");
  }
  const url = new URL(
    payload.urlTemplate
      .replace("{z}", "0")
      .replace("{x}", "0")
      .replace("{y}", "0"),
  );
  if (
    url.protocol !== "https:" ||
    !(
      url.hostname === "earthengine.googleapis.com" ||
      url.hostname.endsWith(".earthengine.googleapis.com")
    )
  ) {
    throw new Error("Invalid spatial tile source.");
  }
  return payload as SpatialTilePayload;
}
