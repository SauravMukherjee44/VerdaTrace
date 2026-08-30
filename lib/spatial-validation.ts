import type {
  SpatialGeometry,
  SpatialGeometryPayload,
} from "@/lib/spatial";

type Position = [number, number];
type PolygonCoordinates = Position[][];

const EARTH_RADIUS_METRES = 6_378_137;
const MAX_COORDINATES = 50_000;
const MAX_AREA_HECTARES = 100_000;

function polygonsFromGeometry(
  geometry: SpatialGeometry,
): PolygonCoordinates[] {
  return geometry.type === "Polygon"
    ? [geometry.coordinates as PolygonCoordinates]
    : (geometry.coordinates as PolygonCoordinates[]);
}

function ringAreaSquareMetres(ring: Position[]) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    area +=
      ((next[0] - current[0]) * Math.PI) /
      180 *
      (2 +
        Math.sin((current[1] * Math.PI) / 180) +
        Math.sin((next[1] * Math.PI) / 180));
  }
  return (area * EARTH_RADIUS_METRES * EARTH_RADIUS_METRES) / 2;
}

function polygonAreaSquareMetres(polygon: PolygonCoordinates) {
  const [outer, ...holes] = polygon;
  return Math.max(
    0,
    Math.abs(ringAreaSquareMetres(outer)) -
      holes.reduce(
        (total, ring) => total + Math.abs(ringAreaSquareMetres(ring)),
        0,
      ),
  );
}

function sameNumber(first: number, second: number, tolerance = 0.000001) {
  return Math.abs(first - second) <= tolerance;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifySpatialGeometryPayload(
  payload: SpatialGeometryPayload,
) {
  const polygons = polygonsFromGeometry(payload.geometry);
  const pairs = polygons.flat(2) as Position[];
  if (pairs.length > MAX_COORDINATES) {
    throw new Error(
      `The boundary exceeds the ${MAX_COORDINATES.toLocaleString()}-coordinate limit.`,
    );
  }
  polygons.forEach((polygon) =>
    polygon.forEach((ring) => {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (!sameNumber(first[0], last[0], 0) || !sameNumber(first[1], last[1], 0)) {
        throw new Error("Every polygon ring must be closed.");
      }
    }),
  );
  const areaHectares =
    polygons.reduce(
      (total, polygon) => total + polygonAreaSquareMetres(polygon),
      0,
    ) / 10_000;
  if (!Number.isFinite(areaHectares) || areaHectares <= 0) {
    throw new Error("The polygon area could not be verified.");
  }
  if (areaHectares > MAX_AREA_HECTARES) {
    throw new Error(
      `The boundary exceeds the ${MAX_AREA_HECTARES.toLocaleString()} ha analysis limit.`,
    );
  }
  const longitudes = pairs.map((position) => position[0]);
  const latitudes = pairs.map((position) => position[1]);
  const bbox = [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
  const expectedHash = await sha256(JSON.stringify(payload.geometry));
  const areaTolerance = Math.max(0.02, areaHectares * 0.001);
  if (
    payload.metadata.coordinateCount !== pairs.length ||
    payload.metadata.featureCount !== polygons.length ||
    !payload.metadata.bbox.every((value, index) =>
      sameNumber(value, bbox[index]),
    ) ||
    Math.abs(payload.metadata.areaHectares - areaHectares) > areaTolerance ||
    payload.metadata.hash !== expectedHash
  ) {
    throw new Error(
      "Geometry metadata does not match the submitted polygon. Re-parse the original file and try again.",
    );
  }
  return {
    coordinateCount: pairs.length,
    featureCount: polygons.length,
    areaHectares,
    bbox,
    hash: expectedHash,
  };
}
