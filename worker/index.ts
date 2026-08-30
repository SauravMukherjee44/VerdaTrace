/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import type { D1DatabaseLike } from "../lib/database";

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: Fetcher;
  DB?: D1DatabaseLike;
  GEMINI_API_KEY?: string;
  EARTH_ENGINE_PROJECT_ID?: string;
  EARTH_ENGINE_SERVICE_ACCOUNT_EMAIL?: string;
  EARTH_ENGINE_PRIVATE_KEY?: string;
  SPATIAL_TILE_SECRET?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function withSecurityHeaders(response: Response, request: Request): Response {
  const secured = new Response(response.body, response);
  secured.headers.set("x-content-type-options", "nosniff");
  secured.headers.set("x-frame-options", "DENY");
  secured.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  secured.headers.set(
    "permissions-policy",
    "camera=(), microphone=(self), geolocation=()",
  );
  secured.headers.set("cross-origin-opener-policy", "same-origin");
  if (new URL(request.url).protocol === "https:") {
    secured.headers.set(
      "strict-transport-security",
      "max-age=31536000; includeSubDomains",
    );
  }
  return secured;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    (
      globalThis as typeof globalThis & {
        __CANOPY_RUNTIME_ENV__?: {
          GEMINI_API_KEY?: string;
          EARTH_ENGINE_PROJECT_ID?: string;
          EARTH_ENGINE_SERVICE_ACCOUNT_EMAIL?: string;
          EARTH_ENGINE_PRIVATE_KEY?: string;
          SPATIAL_TILE_SECRET?: string;
          DB?: D1DatabaseLike;
          ADMIN_USERNAME?: string;
          ADMIN_PASSWORD?: string;
          ADMIN_SESSION_SECRET?: string;
        };
      }
    ).__CANOPY_RUNTIME_ENV__ = {
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      EARTH_ENGINE_PROJECT_ID: env.EARTH_ENGINE_PROJECT_ID,
      EARTH_ENGINE_SERVICE_ACCOUNT_EMAIL:
        env.EARTH_ENGINE_SERVICE_ACCOUNT_EMAIL,
      EARTH_ENGINE_PRIVATE_KEY: env.EARTH_ENGINE_PRIVATE_KEY,
      SPATIAL_TILE_SECRET: env.SPATIAL_TILE_SECRET,
      DB: env.DB,
      ADMIN_USERNAME: env.ADMIN_USERNAME,
      ADMIN_PASSWORD: env.ADMIN_PASSWORD,
      ADMIN_SESSION_SECRET: env.ADMIN_SESSION_SECRET,
    };

    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withSecurityHeaders(response, request);
    }

    return withSecurityHeaders(await handler.fetch(request, env, ctx), request);
  },
};

export default worker;
