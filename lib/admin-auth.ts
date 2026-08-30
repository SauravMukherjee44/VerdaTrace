const ADMIN_COOKIE = "canopy_admin";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

type RuntimeEnv = {
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
};

type AdminSessionPayload = {
  sub: string;
  exp: number;
};

function runtimeEnv(): RuntimeEnv {
  return (
    globalThis as typeof globalThis & {
      __CANOPY_RUNTIME_ENV__?: RuntimeEnv;
    }
  ).__CANOPY_RUNTIME_ENV__ ?? {};
}

function toBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(value: string, secret: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export function adminAuthConfigured(): boolean {
  const env = runtimeEnv();
  return Boolean(
    env.ADMIN_USERNAME &&
      env.ADMIN_PASSWORD &&
      env.ADMIN_SESSION_SECRET &&
      env.ADMIN_SESSION_SECRET.length >= 32,
  );
}

export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const env = runtimeEnv();
  if (!adminAuthConfigured()) return false;
  const [validUsername, validPassword] = await Promise.all([
    secureEqual(username, env.ADMIN_USERNAME!),
    secureEqual(password, env.ADMIN_PASSWORD!),
  ]);
  return validUsername && validPassword;
}

export async function createAdminSession(username: string): Promise<string> {
  const secret = runtimeEnv().ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Admin authentication is not configured.");
  const payload: AdminSessionPayload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = toBase64Url(await hmac(encodedPayload, secret));
  return `${encodedPayload}.${signature}`;
}

export async function readAdminSession(
  request: Request,
): Promise<AdminSessionPayload | null> {
  const secret = runtimeEnv().ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  if (!cookie) return null;

  const token = cookie.slice(ADMIN_COOKIE.length + 1);
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;

  try {
    const expected = await hmac(encodedPayload, secret);
    const actual = fromBase64Url(encodedSignature);
    if (expected.length !== actual.length) return null;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
      difference |= expected[index] ^ actual[index];
    }
    if (difference !== 0) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload)),
    ) as AdminSessionPayload;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  return (await readAdminSession(request)) !== null;
}

export function adminSessionCookie(request: Request, token: string): string {
  const secure =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  return [
    `${ADMIN_COOKIE}=${token}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearAdminSessionCookie(request: Request): string {
  const secure =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  return [
    `${ADMIN_COOKIE}=`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=0",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

