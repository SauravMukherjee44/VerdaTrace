/* eslint-disable @typescript-eslint/no-explicit-any -- the official Earth Engine package does not publish a TypeScript API surface */
import earthEngine from "@google/earthengine";
import {
  DYNAMIC_WORLD_ATTRIBUTION,
  spatialClassDefinitions,
  type SpatialAnalysisRequest,
  type SpatialAnalysisResult,
  type SpatialClassId,
} from "@/lib/spatial";
import { createSpatialTileToken } from "@/lib/spatial-tiles";

type EarthEngineRuntimeEnv = {
  EARTH_ENGINE_PROJECT_ID?: string;
  EARTH_ENGINE_SERVICE_ACCOUNT_EMAIL?: string;
  EARTH_ENGINE_PRIVATE_KEY?: string;
  SPATIAL_TILE_SECRET?: string;
};

type EarthEngineMapId = {
  mapid: string;
  token?: string;
  urlFormat: string;
};

type AnnualComputation = {
  year: number;
  startDate: string;
  endDate: string;
  sceneCount: number;
  areas: Record<string, number>;
  observedAreaSquareMetres: number;
  lowConfidenceAreaSquareMetres: number;
  satelliteImage: any;
  landCoverImage: any;
};

let initialization: Promise<any> | null = null;

const earthEngineScopes = [
  "https://www.googleapis.com/auth/earthengine",
  "https://www.googleapis.com/auth/cloud-platform",
];

function base64Url(value: string | Uint8Array) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function serviceAccountAccessToken(
  clientEmail: string,
  privateKey: string,
) {
  const normalizedKey = privateKey.replaceAll("\\n", "\n");
  const der = Uint8Array.from(
    atob(
      normalizedKey
        .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, "")
        .replace(/\s+/g, ""),
    ),
    (character) => character.charCodeAt(0),
  );
  const signingKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const issuedAt = Math.floor(Date.now() / 1_000);
  const encodedHeader = base64Url(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  );
  const encodedClaims = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: earthEngineScopes.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      iat: issuedAt,
      exp: issuedAt + 3_600,
    }),
  );
  const unsignedToken = `${encodedHeader}.${encodedClaims}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${base64Url(
    new Uint8Array(signature),
  )}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  } | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(
      payload?.error_description ??
        `Google OAuth token exchange failed with status ${response.status}.`,
    );
  }
  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in ?? 3_600,
  };
}

async function authenticateEarthEngine(
  clientEmail: string,
  privateKey: string,
) {
  const refresh = () => serviceAccountAccessToken(clientEmail, privateKey);
  const initialToken = await refresh();
  earthEngine.data.setAuthToken(
    clientEmail,
    "Bearer",
    initialToken.accessToken,
    initialToken.expiresIn,
    earthEngineScopes,
    undefined,
    false,
    true,
  );
  earthEngine.data.setAuthTokenRefresher(
    (
      _authArgs: unknown,
      callback: (result: {
        access_token?: string;
        token_type?: string;
        expires_in?: number;
        error?: string;
      }) => void,
    ) => {
      refresh()
        .then(({ accessToken, expiresIn }) =>
          callback({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: expiresIn,
          }),
        )
        .catch((error: unknown) =>
          callback({
            error:
              error instanceof Error
                ? error.message
                : "Earth Engine token refresh failed.",
          }),
        );
    },
  );
}

export function earthEngineRuntimeEnv(): EarthEngineRuntimeEnv {
  const injected = (
    globalThis as typeof globalThis & {
      __CANOPY_RUNTIME_ENV__?: EarthEngineRuntimeEnv;
    }
  ).__CANOPY_RUNTIME_ENV__;
  return {
    EARTH_ENGINE_PROJECT_ID:
      injected?.EARTH_ENGINE_PROJECT_ID ??
      process.env.EARTH_ENGINE_PROJECT_ID,
    EARTH_ENGINE_SERVICE_ACCOUNT_EMAIL:
      injected?.EARTH_ENGINE_SERVICE_ACCOUNT_EMAIL ??
      process.env.EARTH_ENGINE_SERVICE_ACCOUNT_EMAIL,
    EARTH_ENGINE_PRIVATE_KEY:
      injected?.EARTH_ENGINE_PRIVATE_KEY ??
      process.env.EARTH_ENGINE_PRIVATE_KEY,
    SPATIAL_TILE_SECRET:
      injected?.SPATIAL_TILE_SECRET ?? process.env.SPATIAL_TILE_SECRET,
  };
}

export function isEarthEngineConfigured() {
  const env = earthEngineRuntimeEnv();
  return Boolean(
    env.EARTH_ENGINE_PROJECT_ID &&
      env.EARTH_ENGINE_SERVICE_ACCOUNT_EMAIL &&
      env.EARTH_ENGINE_PRIVATE_KEY &&
      env.SPATIAL_TILE_SECRET &&
      env.SPATIAL_TILE_SECRET.length >= 32,
  );
}

export async function ensureEarthEngine() {
  if (initialization) return initialization;
  const env = earthEngineRuntimeEnv();
  const projectId = env.EARTH_ENGINE_PROJECT_ID;
  const clientEmail = env.EARTH_ENGINE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.EARTH_ENGINE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Live spatial computation is not configured in this environment.",
    );
  }
  initialization = (async () => {
    await authenticateEarthEngine(clientEmail, privateKey);
    return new Promise((resolve, reject) => {
      earthEngine.initialize(
        null,
        null,
        () => resolve(earthEngine),
        (error: unknown) => {
          initialization = null;
          reject(
            new Error(
              typeof error === "string"
                ? error
                : "Earth Engine initialization failed.",
            ),
          );
        },
        null,
        projectId,
      );
    });
  })().catch((error) => {
    initialization = null;
    throw error;
  });
  return initialization;
}

export async function earthEngineAuthorizationHeader() {
  const ee = await ensureEarthEngine();
  let token = ee.data.getAuthToken?.();
  if (typeof token !== "string" || !token.startsWith("Bearer ")) {
    await new Promise<void>((resolve, reject) => {
      ee.data.refreshAuthToken(
        resolve,
        (error: unknown) =>
          reject(
            new Error(
              typeof error === "string"
                ? error
                : "Earth Engine access-token refresh failed.",
            ),
          ),
      );
    });
    token = ee.data.getAuthToken?.();
  }
  if (typeof token !== "string" || !token.startsWith("Bearer ")) {
    throw new Error("Earth Engine did not provide a valid access token.");
  }
  return token;
}

function evaluate<T>(object: any): Promise<T> {
  const env = earthEngineRuntimeEnv();
  if (!env.EARTH_ENGINE_PROJECT_ID) {
    return Promise.reject(new Error("Earth Engine project is not configured."));
  }
  return earthEngineAuthorizationHeader().then(async (authorization) => {
    const response = await fetch(
      `https://earthengine.googleapis.com/v1/projects/${encodeURIComponent(
        env.EARTH_ENGINE_PROJECT_ID!,
      )}/value:compute`,
      {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json",
          "x-goog-user-project": env.EARTH_ENGINE_PROJECT_ID!,
        },
        body: JSON.stringify({
          expression: earthEngine.Serializer.encodeCloudApi(object),
          workloadTag: "verdatrace-spatial-analysis",
        }),
      },
    );
    const payload = (await response.json().catch(() => null)) as {
      result?: T;
      error?: { message?: string };
    } | null;
    if (!response.ok || payload?.result === undefined) {
      throw new Error(
        payload?.error?.message ??
          `Earth Engine value computation failed with status ${response.status}.`,
      );
    }
    return payload.result;
  });
}

async function getMap(image: any): Promise<EarthEngineMapId> {
  const env = earthEngineRuntimeEnv();
  if (!env.EARTH_ENGINE_PROJECT_ID) {
    throw new Error("Earth Engine project is not configured.");
  }
  const authorization = await earthEngineAuthorizationHeader();
  const response = await fetch(
    `https://earthengine.googleapis.com/v1/projects/${encodeURIComponent(
      env.EARTH_ENGINE_PROJECT_ID,
    )}/maps`,
    {
      method: "POST",
      headers: {
        authorization,
        "content-type": "application/json",
        "x-goog-user-project": env.EARTH_ENGINE_PROJECT_ID,
      },
      body: JSON.stringify({
        expression: earthEngine.Serializer.encodeCloudApi(image),
        fileFormat: "PNG",
      }),
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    name?: string;
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.name) {
    throw new Error(
      payload?.error?.message ??
        `Earth Engine map creation failed with status ${response.status}.`,
    );
  }
  const mapid = payload.name.split("/").at(-1);
  if (!mapid) throw new Error("Earth Engine returned an invalid map name.");
  return {
    mapid,
    urlFormat: `https://earthengine.googleapis.com/v1/${payload.name}/tiles/{z}/{x}/{y}`,
  };
}

function percentage(value: number, total: number) {
  if (!Number.isFinite(value) || total <= 0) return 0;
  return Number(((value / total) * 100).toFixed(2));
}

function finiteArea(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

function magnitude(delta: number): "low" | "moderate" | "high" {
  const absolute = Math.abs(delta);
  if (absolute >= 5) return "high";
  if (absolute >= 2) return "moderate";
  return "low";
}

async function buildAnnualComputation(
  ee: any,
  geometry: any,
  year: number,
  confidenceThreshold: number,
): Promise<AnnualComputation> {
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;
  const bandIds = spatialClassDefinitions.map((item) => item.id);
  const collection = ee
    .ImageCollection("GOOGLE/DYNAMICWORLD/V1")
    .filterBounds(geometry)
    .filterDate(startDate, endDate);
  const probabilityComposite = collection
    .select(bandIds)
    .median()
    .clip(geometry);
  const validMask = probabilityComposite
    .mask()
    .reduce(ee.Reducer.min())
    .rename("valid");
  const confidence = probabilityComposite
    .reduce(ee.Reducer.max())
    .rename("confidence");
  const label = probabilityComposite
    .toArray()
    .arrayArgmax()
    .arrayGet([0])
    .rename("label");
  const confidentMask = validMask.and(
    confidence.gte(confidenceThreshold),
  );
  const pixelArea = ee.Image.pixelArea();

  const areaBands = spatialClassDefinitions.map((item, index) =>
    pixelArea
      .updateMask(confidentMask.and(label.eq(index)))
      .rename(item.id),
  );
  const areasImage = ee.Image.cat([
    ...areaBands,
    pixelArea.updateMask(validMask).rename("observed_area"),
    pixelArea
      .updateMask(validMask.and(confidence.lt(confidenceThreshold)))
      .rename("low_confidence_area"),
  ]);
  const areas = await evaluate<Record<string, number>>(
    areasImage.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry,
      scale: 10,
      maxPixels: 100_000_000,
      bestEffort: true,
      tileScale: 4,
    }),
  );
  const sceneCount = await evaluate<number>(collection.size());

  const satelliteCollection = ee
    .ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(geometry)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", 35));
  const satelliteImage = satelliteCollection
    .median()
    .clip(geometry.buffer(2_500))
    .visualize({
      bands: ["B4", "B3", "B2"],
      min: 150,
      max: 3_200,
      gamma: 1.2,
    });
  const landCoverImage = label
    .updateMask(confidentMask)
    .visualize({
      min: 0,
      max: spatialClassDefinitions.length - 1,
      palette: spatialClassDefinitions.map((item) => item.color),
    });

  return {
    year,
    startDate,
    endDate: `${year}-12-31`,
    sceneCount,
    areas,
    observedAreaSquareMetres: finiteArea(areas.observed_area),
    lowConfidenceAreaSquareMetres: finiteArea(areas.low_confidence_area),
    satelliteImage,
    landCoverImage,
  };
}

async function mapLayer(
  image: any,
  options: {
    id: string;
    label: string;
    kind: "satellite" | "land_cover";
    year: number;
    opacity: number;
    expiresAt: number;
    secret: string;
  },
) {
  const descriptor = await getMap(image);
  const token = await createSpatialTileToken(
    {
      urlTemplate: descriptor.urlFormat,
      expiresAt: options.expiresAt,
    },
    options.secret,
  );
  return {
    id: options.id,
    label: options.label,
    tileUrl: `/api/spatial/tiles/${token}/{z}/{x}/{y}`,
    opacity: options.opacity,
    kind: options.kind,
    year: options.year,
  };
}

export async function analyzeWithEarthEngine(
  input: SpatialAnalysisRequest,
): Promise<SpatialAnalysisResult> {
  const startedAt = Date.now();
  const ee = await ensureEarthEngine();
  const env = earthEngineRuntimeEnv();
  if (!env.SPATIAL_TILE_SECRET) {
    throw new Error("Spatial tile signing is not configured.");
  }
  const geometry = ee.Geometry(input.geometry.geometry);
  const [baseline, current] = await Promise.all([
    buildAnnualComputation(
      ee,
      geometry,
      input.baselineYear,
      input.confidenceThreshold,
    ),
    buildAnnualComputation(
      ee,
      geometry,
      input.currentYear,
      input.confidenceThreshold,
    ),
  ]);
  if (baseline.sceneCount === 0 || current.sceneCount === 0) {
    throw new Error(
      "Dynamic World has insufficient imagery for one of the selected years.",
    );
  }

  const geometryAreaSquareMetres =
    input.geometry.metadata.areaHectares * 10_000;
  const classes = spatialClassDefinitions.map((definition) => {
    const baselineArea = finiteArea(baseline.areas[definition.id]);
    const currentArea = finiteArea(current.areas[definition.id]);
    const baselinePercent = percentage(
      baselineArea,
      baseline.observedAreaSquareMetres,
    );
    const currentPercent = percentage(
      currentArea,
      current.observedAreaSquareMetres,
    );
    return {
      ...definition,
      baseline: baselinePercent,
      current: currentPercent,
      delta: Number((currentPercent - baselinePercent).toFixed(2)),
      baselineAreaHectares: Number((baselineArea / 10_000).toFixed(2)),
      currentAreaHectares: Number((currentArea / 10_000).toFixed(2)),
    };
  });
  const expiresAt = Date.now() + 30 * 60 * 1_000;
  const layers = await Promise.all([
    mapLayer(baseline.satelliteImage, {
      id: "baseline-satellite",
      label: `${input.baselineYear} Sentinel-2`,
      kind: "satellite",
      year: input.baselineYear,
      opacity: 1,
      expiresAt,
      secret: env.SPATIAL_TILE_SECRET,
    }),
    mapLayer(current.satelliteImage, {
      id: "current-satellite",
      label: `${input.currentYear} Sentinel-2`,
      kind: "satellite",
      year: input.currentYear,
      opacity: 1,
      expiresAt,
      secret: env.SPATIAL_TILE_SECRET,
    }),
    mapLayer(baseline.landCoverImage, {
      id: "baseline-land-cover",
      label: `${input.baselineYear} Dynamic World`,
      kind: "land_cover",
      year: input.baselineYear,
      opacity: 0.68,
      expiresAt,
      secret: env.SPATIAL_TILE_SECRET,
    }),
    mapLayer(current.landCoverImage, {
      id: "current-land-cover",
      label: `${input.currentYear} Dynamic World`,
      kind: "land_cover",
      year: input.currentYear,
      opacity: 0.68,
      expiresAt,
      secret: env.SPATIAL_TILE_SECRET,
    }),
  ]);
  const changeSignals = classes
    .map((item) => ({
      classId: item.id as SpatialClassId,
      direction:
        Math.abs(item.delta) < 0.25
          ? ("stable" as const)
          : item.delta > 0
            ? ("increase" as const)
            : ("decrease" as const),
      delta: item.delta,
      magnitude: magnitude(item.delta),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    id: crypto.randomUUID(),
    computedAt: new Date().toISOString(),
    geometry: input.geometry.metadata,
    baselinePeriod: {
      year: baseline.year,
      startDate: baseline.startDate,
      endDate: baseline.endDate,
      sceneCount: baseline.sceneCount,
    },
    currentPeriod: {
      year: current.year,
      startDate: current.startDate,
      endDate: current.endDate,
      sceneCount: current.sceneCount,
    },
    confidenceThreshold: input.confidenceThreshold,
    coveragePercent: {
      baseline: Math.min(
        100,
        percentage(
          baseline.observedAreaSquareMetres,
          geometryAreaSquareMetres,
        ),
      ),
      current: Math.min(
        100,
        percentage(
          current.observedAreaSquareMetres,
          geometryAreaSquareMetres,
        ),
      ),
    },
    lowConfidencePercent: {
      baseline: percentage(
        baseline.lowConfidenceAreaSquareMetres,
        baseline.observedAreaSquareMetres,
      ),
      current: percentage(
        current.lowConfidenceAreaSquareMetres,
        current.observedAreaSquareMetres,
      ),
    },
    classes,
    changeSignals,
    layers,
    tileSessionExpiresAt: new Date(expiresAt).toISOString(),
    attribution: DYNAMIC_WORLD_ATTRIBUTION,
    methodology:
      "Annual median Dynamic World probability composites at 10 m. The highest-probability class is counted only when it meets the selected confidence threshold; lower-confidence pixels are reported separately.",
    evidenceBoundary:
      "Land-cover classifications are review signals, not findings of causation, ecological harm, or legal non-compliance. Confirm geometry provenance and compare the result with field evidence and the governing obligation.",
    processingMs: Date.now() - startedAt,
  };
}
