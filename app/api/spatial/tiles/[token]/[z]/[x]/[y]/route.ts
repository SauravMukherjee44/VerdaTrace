import { earthEngineAuthorizationHeader, earthEngineRuntimeEnv } from "@/lib/earth-engine";
import { readSpatialTileToken } from "@/lib/spatial-tiles";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      token: string;
      z: string;
      x: string;
      y: string;
    }>;
  },
) {
  const { token, z, x, y } = await context.params;
  const zoom = Number(z);
  const tileX = Number(x);
  const tileY = Number(y);
  if (
    !Number.isInteger(zoom) ||
    !Number.isInteger(tileX) ||
    !Number.isInteger(tileY) ||
    zoom < 0 ||
    zoom > 22 ||
    tileX < 0 ||
    tileY < 0
  ) {
    return new Response("Invalid tile coordinates.", { status: 400 });
  }

  const secret = earthEngineRuntimeEnv().SPATIAL_TILE_SECRET;
  if (!secret) {
    return new Response("Spatial tiles are not configured.", { status: 503 });
  }
  try {
    const payload = await readSpatialTileToken(token, secret);
    const tileUrl = payload.urlTemplate
      .replace("{z}", String(zoom))
      .replace("{x}", String(tileX))
      .replace("{y}", String(tileY));
    const response = await fetch(tileUrl, {
      headers: {
        authorization: await earthEngineAuthorizationHeader(),
      },
    });
    if (!response.ok || !response.body) {
      return new Response("Spatial tile unavailable.", {
        status: response.status === 404 ? 404 : 502,
      });
    }
    return new Response(response.body, {
      status: 200,
      headers: {
        "content-type": response.headers.get("content-type") ?? "image/png",
        "cache-control": "public, max-age=300, s-maxage=900",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const expired =
      error instanceof Error && error.message.toLowerCase().includes("expired");
    return new Response(
      expired ? "Spatial tile session expired." : "Invalid spatial tile session.",
      { status: expired ? 410 : 403 },
    );
  }
}
