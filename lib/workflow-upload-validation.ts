const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/rtf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/json",
  "application/geo+json",
  "application/vnd.google-earth.kml+xml",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/xml",
  "text/xml",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
]);

export const WORKFLOW_CHUNK_BYTES = 3 * 1024 * 1024;
export const WORKFLOW_FILE_BYTES = 15 * 1024 * 1024;
export const WORKFLOW_TOTAL_BYTES = 50 * 1024 * 1024;
export const WORKFLOW_MAX_FILES = 10;

export function supportedWorkflowContentType(contentType: string) {
  return ALLOWED_TYPES.has(contentType.toLowerCase());
}

export function workflowFileSignatureMatches(bytes: Uint8Array, contentType: string) {
  const hex = Array.from(bytes.slice(0, 12))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const text = new TextDecoder().decode(bytes.slice(0, 1024));
  const mime = contentType.toLowerCase();
  if (mime === "application/pdf") return text.startsWith("%PDF-");
  if (mime === "image/png") return hex.startsWith("89504e470d0a1a0a");
  if (mime === "image/jpeg") return hex.startsWith("ffd8ff");
  if (mime === "image/webp") return text.startsWith("RIFF") && text.slice(8, 12) === "WEBP";
  if (mime === "image/tiff") return hex.startsWith("49492a00") || hex.startsWith("4d4d002a");
  if (mime.includes("wordprocessingml")) return hex.startsWith("504b0304");
  if (mime === "application/msword") return hex.startsWith("d0cf11e0a1b11ae1");
  if (mime.includes("json")) {
    try {
      JSON.parse(new TextDecoder().decode(bytes));
      return true;
    } catch {
      return false;
    }
  }
  if (mime.includes("xml") || mime.includes("kml")) {
    const normalized = text.trimStart().toLowerCase();
    return normalized.startsWith("<?xml") || normalized.startsWith("<kml");
  }
  return !bytes.slice(0, 1024).some((value) => value === 0);
}

export async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
