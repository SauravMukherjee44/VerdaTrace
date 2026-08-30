"use client";

import type {
  SpatialGeometry,
  SpatialGeometryPayload,
} from "@/lib/spatial";

type Position = [number, number];
type PolygonCoordinates = Position[][];

const EARTH_RADIUS_METRES = 6_378_137;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_COORDINATES = 50_000;
const MAX_AREA_HECTARES = 100_000;

function roundCoordinate(value: number) {
  return Math.round(value * 10_000_000) / 10_000_000;
}

function normalizePosition(value: unknown): Position {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1])
  ) {
    throw new Error("The boundary contains an invalid coordinate.");
  }
  const longitude = roundCoordinate(value[0]);
  const latitude = roundCoordinate(value[1]);
  if (
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error("The boundary contains coordinates outside WGS84 bounds.");
  }
  return [longitude, latitude];
}

function samePosition(a: Position, b: Position) {
  return a[0] === b[0] && a[1] === b[1];
}

function normalizeRing(value: unknown): Position[] {
  if (!Array.isArray(value)) {
    throw new Error("A polygon ring is missing coordinates.");
  }
  const ring = value.map(normalizePosition);
  if (ring.length < 3) {
    throw new Error("Each polygon ring needs at least three positions.");
  }
  if (!samePosition(ring[0], ring[ring.length - 1])) {
    ring.push([...ring[0]] as Position);
  }
  if (ring.length < 4) {
    throw new Error("Each polygon ring needs at least four closed positions.");
  }
  return ring;
}

function normalizePolygon(value: unknown): PolygonCoordinates {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("The polygon has no coordinate rings.");
  }
  return value.map(normalizeRing);
}

function extractPolygons(value: unknown): PolygonCoordinates[] {
  if (!value || typeof value !== "object") {
    throw new Error("The geometry file is empty.");
  }
  const item = value as {
    type?: string;
    coordinates?: unknown;
    geometry?: unknown;
    features?: unknown[];
    geometries?: unknown[];
  };
  if (item.type === "Polygon") {
    return [normalizePolygon(item.coordinates)];
  }
  if (item.type === "MultiPolygon") {
    if (!Array.isArray(item.coordinates)) {
      throw new Error("The MultiPolygon has no coordinates.");
    }
    return item.coordinates.map(normalizePolygon);
  }
  if (item.type === "Feature") {
    return extractPolygons(item.geometry);
  }
  if (item.type === "FeatureCollection" && Array.isArray(item.features)) {
    return item.features.flatMap(extractPolygons);
  }
  if (item.type === "GeometryCollection" && Array.isArray(item.geometries)) {
    return item.geometries.flatMap(extractPolygons);
  }
  throw new Error(
    "Parcel analysis requires Polygon or MultiPolygon geometry. Lines and points can be viewed, but cannot produce area statistics.",
  );
}

function parseKml(source: string): PolygonCoordinates[] {
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.querySelector("parsererror")) {
    throw new Error("The KML file could not be parsed.");
  }
  const polygons = [...document.querySelectorAll("Polygon")].map((polygon) => {
    const rings: Position[][] = [];
    const outer = polygon.querySelector(
      "outerBoundaryIs LinearRing coordinates",
    );
    if (!outer?.textContent?.trim()) {
      throw new Error("A KML polygon is missing its outer boundary.");
    }
    rings.push(
      normalizeRing(
        outer.textContent
          .trim()
          .split(/\s+/)
          .map((coordinate) =>
            coordinate
              .split(",")
              .slice(0, 2)
              .map(Number),
          ),
      ),
    );
    polygon
      .querySelectorAll("innerBoundaryIs LinearRing coordinates")
      .forEach((inner) => {
        if (!inner.textContent?.trim()) return;
        rings.push(
          normalizeRing(
            inner.textContent
              .trim()
              .split(/\s+/)
              .map((coordinate) =>
                coordinate
                  .split(",")
                  .slice(0, 2)
                  .map(Number),
              ),
          ),
        );
      });
    return rings;
  });
  if (!polygons.length) {
    throw new Error(
      "No polygon boundary was found. LineString KML can be displayed, but parcel statistics require an area polygon.",
    );
  }
  return polygons;
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

function geometryFromPolygons(polygons: PolygonCoordinates[]): SpatialGeometry {
  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
}

function coordinatePairs(geometry: SpatialGeometry): Position[] {
  return (
    geometry.type === "Polygon"
      ? geometry.coordinates
      : geometry.coordinates.flat()
  ).flat() as Position[];
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

export async function parseSpatialFile(
  file: File,
): Promise<SpatialGeometryPayload> {
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    throw new Error("Geometry files must be between 1 byte and 3 MB.");
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["geojson", "json", "kml"].includes(extension ?? "")) {
    throw new Error("Use a GeoJSON, JSON, or KML polygon file.");
  }

  const source = await file.text();
  let polygons: PolygonCoordinates[];
  if (extension === "kml") {
    polygons = parseKml(source);
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch {
      throw new Error("The GeoJSON file contains invalid JSON.");
    }
    polygons = extractPolygons(parsed);
  }

  const geometry = geometryFromPolygons(polygons);
  const pairs = coordinatePairs(geometry);
  if (pairs.length > MAX_COORDINATES) {
    throw new Error(
      `This boundary contains ${pairs.length.toLocaleString()} coordinates; the public workspace limit is ${MAX_COORDINATES.toLocaleString()}.`,
    );
  }

  const areaHectares =
    polygons.reduce(
      (total, polygon) => total + polygonAreaSquareMetres(polygon),
      0,
    ) / 10_000;
  if (!Number.isFinite(areaHectares) || areaHectares <= 0) {
    throw new Error("The polygon area could not be calculated.");
  }
  if (areaHectares > MAX_AREA_HECTARES) {
    throw new Error(
      `This boundary covers ${areaHectares.toLocaleString(undefined, { maximumFractionDigits: 0 })} ha; the public workspace limit is ${MAX_AREA_HECTARES.toLocaleString()} ha.`,
    );
  }

  const longitudes = pairs.map(([longitude]) => longitude);
  const latitudes = pairs.map(([, latitude]) => latitude);
  const canonical = JSON.stringify(geometry);
  return {
    geometry,
    metadata: {
      fileName: file.name.slice(0, 180),
      geometryType: geometry.type,
      featureCount: polygons.length,
      coordinateCount: pairs.length,
      bbox: [
        Math.min(...longitudes),
        Math.min(...latitudes),
        Math.max(...longitudes),
        Math.max(...latitudes),
      ],
      areaHectares: Number(areaHectares.toFixed(2)),
      hash: await sha256(canonical),
      source: "upload",
    },
  };
}
