"use client";

import {
  Activity,
  ArrowRight,
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Crosshair,
  Download,
  FileCheck2,
  FoldHorizontal,
  Layers3,
  LocateFixed,
  Maximize2,
  Minus,
  Plus,
  Radar,
  Ruler,
  Satellite,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AgentRunEvent } from "@/lib/agent-events";
import { finishAgentRun, startAgentRun } from "@/lib/agent-events";
import type { InspectionTask } from "@/lib/schema";
import {
  demoSpatialAnalysisSnapshot,
  demoSpatialGeometry,
} from "@/lib/spatial-demo-analysis";
import {
  spatialAnalysisResultSchema,
  spatialClassDefinitions,
  spatialInsightSchema,
  spatialProjectFallback,
  type SpatialAnalysisResult,
  type SpatialGeometryPayload,
  type SpatialInsight,
} from "@/lib/spatial";
import { parseSpatialFile } from "./spatial-geometry";

type LayerMode = "satellite" | "land_cover";
type CompareMode = "baseline" | "swipe" | "current";
type UploadPhase =
  | "idle"
  | "parsing"
  | "validating"
  | "processing"
  | "complete"
  | "error";

type SpatialWorkbenchProps = {
  initialResult: SpatialAnalysisResult | null;
  isAdmin: boolean;
  isExporting: boolean;
  onExport: () => void;
  onResultChange: (result: SpatialAnalysisResult | null) => void;
  onQueueTasks: (tasks: InspectionTask[]) => void;
  onRunEvent: (event: AgentRunEvent) => void;
};

const SPATIAL_RATE_LIMIT = 3;
const SPATIAL_QUOTA_STORAGE_KEY = "verdatrace.spatial.rate-limit.v1";

const BASE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
  sources: {
    "world-imagery": {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      // This project area has real imagery through z18. At z19 Esri returns a
      // valid JPEG containing its "Map data not yet available" placeholder.
      // Capping the source makes MapLibre overzoom z18 instead of displaying it.
      maxzoom: 18,
    },
  },
  layers: [
    {
      id: "world-imagery",
      type: "raster",
      source: "world-imagery",
      paint: {
        "raster-saturation": -0.12,
        "raster-contrast": 0.08,
        "raster-brightness-min": 0.05,
      },
    },
  ],
};

const latestCompleteYear = new Date().getUTCFullYear() - 1;

function formatQuotaReset(resetAt: number) {
  const seconds = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
  if (seconds <= 0) return "available now";
  if (seconds < 60) return `in ${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? `in ${minutes}m` : `in ${Math.ceil(minutes / 60)}h`;
}

function validYearPair(baseline: number, current: number) {
  return (
    Number.isInteger(baseline) &&
    Number.isInteger(current) &&
    baseline >= 2016 &&
    current <= latestCompleteYear &&
    current > baseline
  );
}

function layerFor(
  result: SpatialAnalysisResult,
  year: number,
  kind: LayerMode,
) {
  return result.layers.find(
    (layer) => layer.year === year && layer.kind === kind,
  );
}

function geometryFeature(payload: SpatialGeometryPayload) {
  return {
    type: "Feature" as const,
    properties: {
      name: payload.metadata.fileName,
      hash: payload.metadata.hash,
    },
    geometry: payload.geometry,
  };
}

function addGeometry(map: MapLibreMap, payload: SpatialGeometryPayload) {
  const data = geometryFeature(payload);
  const existing = map.getSource("verified-boundary") as
    | GeoJSONSource
    | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }
  map.addSource("verified-boundary", { type: "geojson", data });
  map.addLayer({
    id: "verified-boundary-fill",
    type: "fill",
    source: "verified-boundary",
    paint: {
      "fill-color": "#82efbd",
      "fill-opacity": 0.12,
    },
  });
  map.addLayer({
    id: "verified-boundary-line",
    type: "line",
    source: "verified-boundary",
    paint: {
      "line-color": "#d7ffe8",
      "line-width": 2.5,
      "line-dasharray": [2, 1.3],
    },
  });
}

function removeGeometry(map: MapLibreMap) {
  if (map.getLayer("verified-boundary-line")) {
    map.removeLayer("verified-boundary-line");
  }
  if (map.getLayer("verified-boundary-fill")) {
    map.removeLayer("verified-boundary-fill");
  }
  if (map.getSource("verified-boundary")) {
    map.removeSource("verified-boundary");
  }
}

function fitGeometry(map: MapLibreMap, geometry: SpatialGeometryPayload) {
  const [west, south, east, north] = geometry.metadata.bbox;
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ] as LngLatBoundsLike,
    { padding: 96, duration: 750, maxZoom: 16.75 },
  );
}

function removeAnalysisLayer(map: MapLibreMap) {
  if (map.getLayer("analysis-raster")) map.removeLayer("analysis-raster");
  if (map.getSource("analysis-raster")) map.removeSource("analysis-raster");
}

function setAnalysisLayer(
  map: MapLibreMap,
  result: SpatialAnalysisResult | null,
  year: number,
  kind: LayerMode,
  opacity: number,
) {
  removeAnalysisLayer(map);
  if (!result) return;
  const layer = layerFor(result, year, kind);
  if (!layer) return;
  map.addSource("analysis-raster", {
    type: "raster",
    tiles: [layer.tileUrl],
    tileSize: 256,
    attribution: result.attribution,
  });
  map.addLayer(
    {
      id: "analysis-raster",
      type: "raster",
      source: "analysis-raster",
      paint: {
        "raster-opacity": kind === "land_cover" ? opacity : 1,
        "raster-fade-duration": 0,
      },
    },
    map.getLayer("verified-boundary-fill")
      ? "verified-boundary-fill"
      : undefined,
  );
}

function haversineMetres(
  first: [number, number],
  second: [number, number],
) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6_371_008.8;
  const latitudeDelta = radians(second[1] - first[1]);
  const longitudeDelta = radians(second[0] - first[0]);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first[1])) *
      Math.cos(radians(second[1])) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function formatDistance(metres: number) {
  return metres >= 1_000
    ? `${(metres / 1_000).toFixed(2)} km`
    : `${Math.round(metres)} m`;
}

export function SpatialWorkbench({
  initialResult,
  isAdmin,
  isExporting,
  onExport,
  onResultChange,
  onQueueTasks,
  onRunEvent,
}: SpatialWorkbenchProps) {
  const baselineContainer = useRef<HTMLDivElement>(null);
  const currentContainer = useRef<HTMLDivElement>(null);
  const mapStack = useRef<HTMLDivElement>(null);
  const baselineMap = useRef<MapLibreMap | null>(null);
  const currentMap = useRef<MapLibreMap | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const measureStart = useRef<[number, number] | null>(null);
  const fittedGeometryHash = useRef<string | null>(null);
  const [geometry, setGeometry] = useState<SpatialGeometryPayload | null>(
    demoSpatialGeometry,
  );
  const [result, setResult] = useState<SpatialAnalysisResult | null>(
    demoSpatialAnalysisSnapshot,
  );
  const [baselineYear, setBaselineYear] = useState(
    demoSpatialAnalysisSnapshot.baselinePeriod.year,
  );
  const [currentYear, setCurrentYear] = useState(
    demoSpatialAnalysisSnapshot.currentPeriod.year,
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState(
    demoSpatialAnalysisSnapshot.confidenceThreshold,
  );
  const [layerMode, setLayerMode] = useState<LayerMode>("satellite");
  const [compareMode, setCompareMode] = useState<CompareMode>("swipe");
  const [swipe, setSwipe] = useState(52);
  const [opacity, setOpacity] = useState(0.7);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("complete");
  const [error, setError] = useState("");
  const [coordinates, setCoordinates] = useState(
    `${spatialProjectFallback.center[1].toFixed(5)}, ${spatialProjectFallback.center[0].toFixed(5)}`,
  );
  const [measuring, setMeasuring] = useState(false);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<"change" | "current">("change");
  const [spatialQuestion, setSpatialQuestion] = useState(
    "What should be verified first from this measured land-cover change?",
  );
  const [insight, setInsight] = useState<SpatialInsight | null>(null);
  const [insightRunning, setInsightRunning] = useState(false);
  const [insightError, setInsightError] = useState("");
  const [tasksQueued, setTasksQueued] = useState(false);
  const [tileSessionExpired, setTileSessionExpired] = useState(false);
  const [spatialLimit, setSpatialLimit] = useState(SPATIAL_RATE_LIMIT);
  const [spatialRemaining, setSpatialRemaining] = useState(SPATIAL_RATE_LIMIT);
  const [spatialResetAt, setSpatialResetAt] = useState(0);
  const [quotaClock, setQuotaClock] = useState(() => Date.now());
  const restoredResultId = useRef<string | null>(null);
  const quotaPersistenceReady = useRef(false);

  const emit = (event: AgentRunEvent) => onRunEvent(event);

  const quotaExhausted =
    !isAdmin && spatialRemaining <= 0 && spatialResetAt > quotaClock;

  const captureSpatialQuota = (response: Response) => {
    const limitHeader = response.headers.get("x-ratelimit-limit");
    const remainingHeader = response.headers.get("x-ratelimit-remaining");
    const resetHeader = response.headers.get("x-ratelimit-reset");
    if (!limitHeader || limitHeader === "unlimited") return;

    const nextLimit = Number(limitHeader);
    const nextRemaining = Number(remainingHeader);
    const resetSeconds = Number(resetHeader);
    if (Number.isFinite(nextLimit) && nextLimit > 0) {
      setSpatialLimit(nextLimit);
    }
    if (Number.isFinite(nextRemaining)) {
      setSpatialRemaining(Math.max(0, nextRemaining));
    }
    if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
      setSpatialResetAt(Date.now() + resetSeconds * 1000);
    }
  };

  useEffect(() => {
    const restoreFrame = window.requestAnimationFrame(() => {
      try {
        const source = window.localStorage.getItem(SPATIAL_QUOTA_STORAGE_KEY);
        const stored = source
          ? (JSON.parse(source) as {
              limit?: unknown;
              remaining?: unknown;
              resetAt?: unknown;
            })
          : null;
        if (
          stored &&
          typeof stored.limit === "number" &&
          typeof stored.remaining === "number" &&
          typeof stored.resetAt === "number" &&
          stored.resetAt > Date.now()
        ) {
          setSpatialLimit(Math.max(1, Math.floor(stored.limit)));
          setSpatialRemaining(
            Math.max(
              0,
              Math.min(
                Math.floor(stored.limit),
                Math.floor(stored.remaining),
              ),
            ),
          );
          setSpatialResetAt(stored.resetAt);
        }
      } catch {
        window.localStorage.removeItem(SPATIAL_QUOTA_STORAGE_KEY);
      } finally {
        quotaPersistenceReady.current = true;
      }
    });
    return () => window.cancelAnimationFrame(restoreFrame);
  }, []);

  useEffect(() => {
    if (!quotaPersistenceReady.current || isAdmin) return;
    try {
      window.localStorage.setItem(
        SPATIAL_QUOTA_STORAGE_KEY,
        JSON.stringify({
          limit: spatialLimit,
          remaining: spatialRemaining,
          resetAt: spatialResetAt,
        }),
      );
    } catch {
      // Server-side limits remain authoritative when browser storage is unavailable.
    }
  }, [isAdmin, spatialLimit, spatialRemaining, spatialResetAt]);

  useEffect(() => {
    if (isAdmin || spatialResetAt <= Date.now()) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setQuotaClock(now);
      if (now >= spatialResetAt) {
        setSpatialRemaining(spatialLimit);
        setSpatialResetAt(0);
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [isAdmin, spatialLimit, spatialResetAt]);

  useEffect(() => {
    if (
      !initialResult ||
      restoredResultId.current === initialResult.id ||
      result?.id === initialResult.id
    ) {
      return;
    }
    restoredResultId.current = initialResult.id;
    const restoreFrame = window.requestAnimationFrame(() => {
      setResult(initialResult);
      setGeometry(
        initialResult.geometry.hash === demoSpatialGeometry.metadata.hash
          ? demoSpatialGeometry
          : null,
      );
      setBaselineYear(initialResult.baselinePeriod.year);
      setCurrentYear(initialResult.currentPeriod.year);
      setConfidenceThreshold(initialResult.confidenceThreshold);
      setUploadPhase("complete");
      setLayerMode(
        Date.parse(initialResult.tileSessionExpiresAt) > Date.now()
          ? "land_cover"
          : "satellite",
      );
    });
    return () => window.cancelAnimationFrame(restoreFrame);
  }, [initialResult, result?.id]);

  useEffect(() => {
    const expiresIn = result
      ? Date.parse(result.tileSessionExpiresAt) - Date.now()
      : Number.POSITIVE_INFINITY;
    const updateFrame = window.requestAnimationFrame(() => {
      setTileSessionExpired(Boolean(result && expiresIn <= 0));
    });
    const expiryTimer =
      result && expiresIn > 0
        ? window.setTimeout(
            () => setTileSessionExpired(true),
            Math.min(expiresIn, 2_147_483_647),
          )
        : null;
    return () => {
      window.cancelAnimationFrame(updateFrame);
      if (expiryTimer !== null) window.clearTimeout(expiryTimer);
    };
  }, [result]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const savedBaselineParam = url.searchParams.get("baseline");
    const savedCurrentParam = url.searchParams.get("current");
    const savedBaseline = Number(savedBaselineParam);
    const savedCurrent = Number(savedCurrentParam);
    const savedView = url.searchParams.get("spatialView");
    const restoreFrame = window.requestAnimationFrame(() => {
      if (
        savedBaselineParam !== null &&
        savedCurrentParam !== null &&
        validYearPair(savedBaseline, savedCurrent)
      ) {
        setBaselineYear(savedBaseline);
        setCurrentYear(savedCurrent);
      }
      if (
        savedView === "baseline" ||
        savedView === "swipe" ||
        savedView === "current"
      ) {
        setCompareMode(savedView);
      }
    });
    const restore = () => {
      const next = new URL(window.location.href);
      const nextBaselineParam = next.searchParams.get("baseline");
      const nextCurrentParam = next.searchParams.get("current");
      const nextBaseline = Number(nextBaselineParam);
      const nextCurrent = Number(nextCurrentParam);
      const nextView = next.searchParams.get("spatialView");
      if (
        nextBaselineParam !== null &&
        nextCurrentParam !== null &&
        validYearPair(nextBaseline, nextCurrent)
      ) {
        setBaselineYear(nextBaseline);
        setCurrentYear(nextCurrent);
      }
      if (
        nextView === "baseline" ||
        nextView === "swipe" ||
        nextView === "current"
      ) {
        setCompareMode(nextView);
      }
    };
    window.addEventListener("popstate", restore);
    return () => {
      window.cancelAnimationFrame(restoreFrame);
      window.removeEventListener("popstate", restore);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("baseline", String(baselineYear));
      url.searchParams.set("current", String(currentYear));
      url.searchParams.set("spatialView", compareMode);
      window.history.replaceState(
        { ...window.history.state, spatial: true },
        "",
        url,
      );
      try {
        window.localStorage.setItem(
          "verdatrace.spatial.preferences.v2",
          JSON.stringify({
            version: 2,
            baselineYear,
            currentYear,
            compareMode,
            confidenceThreshold,
            layerMode,
            opacity,
          }),
        );
      } catch {
        // Preferences are optional. Geometry is deliberately excluded.
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [
    baselineYear,
    compareMode,
    confidenceThreshold,
    currentYear,
    layerMode,
    opacity,
  ]);

  useEffect(() => {
    if (!baselineContainer.current || !currentContainer.current) return;
    maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
    const baseline = new maplibregl.Map({
      container: baselineContainer.current,
      style: BASE_STYLE,
      center: spatialProjectFallback.center,
      zoom: spatialProjectFallback.zoom,
      attributionControl: {},
    });
    const current = new maplibregl.Map({
      container: currentContainer.current,
      style: BASE_STYLE,
      center: spatialProjectFallback.center,
      zoom: spatialProjectFallback.zoom,
      interactive: false,
      attributionControl: false,
    });
    baseline.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "top-right",
    );
    baseline.addControl(new maplibregl.ScaleControl(), "bottom-right");
    baseline.on("move", () => {
      const center = baseline.getCenter();
      current.jumpTo({
        center,
        zoom: baseline.getZoom(),
        bearing: baseline.getBearing(),
        pitch: baseline.getPitch(),
      });
    });
    baseline.on("mousemove", (event) => {
      setCoordinates(
        `${event.lngLat.lat.toFixed(5)}, ${event.lngLat.lng.toFixed(5)}`,
      );
    });
    baselineMap.current = baseline;
    currentMap.current = current;
    return () => {
      baseline.remove();
      current.remove();
      baselineMap.current = null;
      currentMap.current = null;
    };
  }, []);

  useEffect(() => {
    const maps = [baselineMap.current, currentMap.current].filter(
      (map): map is MapLibreMap => Boolean(map),
    );
    if (!geometry) {
      fittedGeometryHash.current = null;
      maps.forEach((map) => {
        const update = () => removeGeometry(map);
        if (map.isStyleLoaded()) update();
        else map.once("load", update);
      });
      return;
    }
    maps.forEach((map) => {
      const update = () => {
        addGeometry(map, geometry);
        if (
          map === baselineMap.current &&
          fittedGeometryHash.current !== geometry.metadata.hash
        ) {
          fittedGeometryHash.current = geometry.metadata.hash;
          fitGeometry(map, geometry);
        }
      };
      if (map.isStyleLoaded()) update();
      else map.once("load", update);
    });
  }, [geometry]);

  useEffect(() => {
    const activeBaselineYear = result?.baselinePeriod.year ?? baselineYear;
    const activeCurrentYear = result?.currentPeriod.year ?? currentYear;
    const entries: Array<[MapLibreMap | null, number]> = [
      [baselineMap.current, activeBaselineYear],
      [currentMap.current, activeCurrentYear],
    ];
    entries.forEach(([map, year]) => {
      if (!map) return;
      const update = () =>
        setAnalysisLayer(
          map,
          tileSessionExpired ? null : result,
          year,
          layerMode,
          opacity,
        );
      if (map.isStyleLoaded()) update();
      else map.once("load", update);
    });
  }, [
    baselineYear,
    currentYear,
    layerMode,
    opacity,
    result,
    tileSessionExpired,
  ]);

  useEffect(() => {
    baselineMap.current?.resize();
    currentMap.current?.resize();
  }, [inspectorCollapsed, railCollapsed]);

  const analyze = async (payload: SpatialGeometryPayload) => {
    if (quotaExhausted) {
      setError(
        `The public spatial-compute limit has been reached. New analysis is available ${formatQuotaReset(spatialResetAt)}.`,
      );
      setUploadPhase("error");
      return;
    }
    const event = startAgentRun({
      operation: "spatial_analysis",
      stage: "spatial",
      label: `Compute ${baselineYear}–${currentYear} land-cover evidence`,
      outputRef: "#spatial-intelligence",
    });
    emit(event);
    setUploadPhase("processing");
    setError("");
    setInsight(null);
    setLayerMode("satellite");
    try {
      const response = await fetch("/api/spatial/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          geometry: payload,
          baselineYear,
          currentYear,
          confidenceThreshold,
        }),
      });
      captureSpatialQuota(response);
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          body.error ?? "The live Earth Engine analysis could not complete.",
        );
      }
      const typed = spatialAnalysisResultSchema.parse(body);
      setResult(typed);
      setLayerMode("land_cover");
      onResultChange(typed);
      setUploadPhase("complete");
      emit(
        finishAgentRun(event, {
          status: "completed",
          itemCount: typed.classes.length,
          outputRef: "#spatial-inspector",
        }),
      );
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "The live Earth Engine analysis could not complete.";
      setError(message);
      setUploadPhase("error");
      emit(
        finishAgentRun(event, {
          status: "failed",
          error: message,
          outputRef: "#spatial-intelligence",
        }),
      );
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    restoredResultId.current = null;
    setResult(null);
    setGeometry(null);
    setInsight(null);
    onResultChange(null);
    setUploadPhase("parsing");
    setError("");
    setTasksQueued(false);
    try {
      const parsed = await parseSpatialFile(file);
      setUploadPhase("validating");
      setGeometry(parsed);
      window.setTimeout(() => {
        const map = baselineMap.current;
        if (map) fitGeometry(map, parsed);
      }, 60);
      await analyze(parsed);
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "The geometry file could not be validated.";
      setError(message);
      setUploadPhase("error");
    } finally {
      event.target.value = "";
    }
  };

  const rerunAnalysis = () => {
    if (geometry) void analyze(geometry);
  };

  const resetView = () => {
    const map = baselineMap.current;
    if (!map) return;
    if (geometry) fitGeometry(map, geometry);
    else
      map.easeTo({
        center: spatialProjectFallback.center,
        zoom: spatialProjectFallback.zoom,
        bearing: 0,
        pitch: 0,
      });
  };

  const updateSwipeFromClientX = (clientX: number) => {
    const bounds = mapStack.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) return;
    const position = ((clientX - bounds.left) / bounds.width) * 100;
    setSwipe(Math.min(92, Math.max(8, position)));
  };

  const toggleMeasure = () => {
    const map = baselineMap.current;
    if (!map) return;
    const next = !measuring;
    setMeasuring(next);
    setMeasureDistance(null);
    measureStart.current = null;
    map.getCanvas().style.cursor = next ? "crosshair" : "";
    if (!next) return;
    map.once("click", (first) => {
      measureStart.current = [first.lngLat.lng, first.lngLat.lat];
      map.once("click", (second) => {
        if (!measureStart.current) return;
        setMeasureDistance(
          haversineMetres(measureStart.current, [
            second.lngLat.lng,
            second.lngLat.lat,
          ]),
        );
        setMeasuring(false);
        map.getCanvas().style.cursor = "";
      });
    });
  };

  const runInsight = async (event: FormEvent) => {
    event.preventDefault();
    if (!result) return;
    const run = startAgentRun({
      operation: "spatial_review",
      stage: "spatial",
      label: "Interpret measured spatial evidence",
      outputRef: "#spatial-inspector",
    });
    emit(run);
    setInsightRunning(true);
    setInsightError("");
    try {
      const response = await fetch("/api/spatial-insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: spatialQuestion, analysis: result }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Review unavailable.");
      const typed = spatialInsightSchema.parse(body);
      setInsight(typed);
      emit(
        finishAgentRun(run, {
          status: "needs_review",
          itemCount: typed.actions.length,
          outputRef: "#spatial-inspector",
        }),
      );
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Review unavailable.";
      setInsightError(message);
      emit(
        finishAgentRun(run, {
          status: "failed",
          error: message,
          outputRef: "#spatial-inspector",
        }),
      );
    } finally {
      setInsightRunning(false);
    }
  };

  const queueTasks = () => {
    const boundary = geometry?.metadata ?? result?.geometry;
    if (!insight || !boundary) return;
    const tasks = insight.actions.map<InspectionTask>((action, index) => ({
      id: `spatial-${result?.id ?? "review"}-${index + 1}`,
      priority: Math.min(3, Math.max(1, action.priority)) as 1 | 2 | 3,
      title: action.title,
      location: `${boundary.fileName} · ${boundary.areaHectares.toFixed(2)} ha`,
      requiredEvidence: action.requiredEvidence,
      rationale: action.rationale,
      safetyNote:
        "Confirm access, field safety, and expert approval before evidence collection.",
      obligationIds: [],
    }));
    const run = startAgentRun({
      operation: "inspection_handoff",
      stage: "planner",
      label: `Add ${tasks.length} spatial actions to inspection plan`,
      itemCount: tasks.length,
      outputRef: "#case-intelligence",
    });
    emit(run);
    onQueueTasks(tasks);
    setTasksQueued(true);
    emit(
      finishAgentRun(run, {
        status: "needs_review",
        itemCount: tasks.length,
        outputRef: "#case-intelligence",
      }),
    );
  };

  const sortedClasses = useMemo(() => {
    if (!result) return [];
    return [...result.classes].sort((first, second) =>
      sortMode === "change"
        ? Math.abs(second.delta) - Math.abs(first.delta)
        : second.current - first.current,
    );
  }, [result, sortMode]);

  const displayedBaselineYear = result?.baselinePeriod.year ?? baselineYear;
  const displayedCurrentYear = result?.currentPeriod.year ?? currentYear;
  const isDemoResult =
    result?.geometry.hash === demoSpatialGeometry.metadata.hash;
  const resultIsStale = Boolean(
    result &&
      (result.baselinePeriod.year !== baselineYear ||
        result.currentPeriod.year !== currentYear ||
        result.confidenceThreshold !== confidenceThreshold),
  );
  const overlayClip =
    !result || compareMode === "baseline"
      ? "inset(0 0 0 100%)"
      : compareMode === "current"
        ? "inset(0)"
        : `inset(0 0 0 ${swipe}%)`;

  return (
    <section className="spatial-stage" id="spatial-intelligence">
      <header className="spatial-stage-heading">
        <div>
          <div className="demo-screen-tagline">
            <Sparkles size={13} />
            <span>Interactive sandbox demo · Explore measured spatial change</span>
          </div>
          <span>Screen 02 · Live spatial evidence</span>
          <h2>A professional GIS workbench, grounded in measured pixels.</h2>
          <p>
            Inspect real imagery now. Upload verified parcel geometry to run a
            nine-class Dynamic World comparison through Earth Engine.
          </p>
        </div>
        <div className={`spatial-service-state state-${uploadPhase}`}>
          <Activity size={15} />
          <span>
            <strong>
              {uploadPhase === "processing"
                ? isDemoResult
                  ? "Refreshing demo analysis"
                  : "Earth Engine processing"
                : result
                  ? isDemoResult
                    ? "Measured demo active"
                    : "Measured result active"
                  : "Satellite overview"}
            </strong>
            <small>
              {resultIsStale
                ? "Controls changed · recompute to update the measured result"
                : tileSessionExpired
                  ? "Saved statistics active · map tile session expired"
                : result
                  ? `${result.processingMs.toLocaleString()} ms · ${result.geometry.hash.slice(0, 10)}`
                : "No parcel statistics until geometry is verified"}
            </small>
          </span>
        </div>
      </header>

      <div
        className={`spatial-shell ${railCollapsed ? "rail-collapsed" : ""} ${inspectorCollapsed ? "inspector-collapsed" : ""}`}
      >
        <header className="spatial-titlebar">
          <div className="spatial-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div>
            <Layers3 size={15} />
            <span>
              <strong>VerdaTrace · Spatial Workbench</strong>
              <small>{spatialProjectFallback.proposalId}</small>
            </span>
          </div>
          <div className="spatial-title-actions">
            <span className={result ? "is-live" : ""}>
              <i />{" "}
              {result
                ? isDemoResult
                  ? "Demo result"
                  : "Live result"
                : "Awaiting boundary"}
            </span>
            <button disabled={!result || isExporting} onClick={onExport}>
              <Download size={14} />
              {isExporting ? "Building…" : "Export"}
            </button>
            <button
              className="is-primary"
              onClick={() => fileInput.current?.click()}
            >
              <UploadCloud size={14} /> Upload boundary
            </button>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept=".geojson,.json,.kml,application/geo+json,application/json,application/vnd.google-earth.kml+xml"
              onChange={handleUpload}
            />
          </div>
        </header>

        <div className="spatial-workbench">
          <aside className="spatial-rail">
            <button
              className="spatial-collapse-control"
              onClick={() => setRailCollapsed((value) => !value)}
              aria-label={railCollapsed ? "Expand project rail" : "Collapse project rail"}
            >
              {railCollapsed ? (
                <ChevronRight size={16} />
              ) : (
                <ChevronLeft size={16} />
              )}
            </button>
            <div className="spatial-rail-content">
              <div className="spatial-section-label">Project area</div>
              <article className="spatial-project-card">
                <span>ZA</span>
                <div>
                  <strong>Zeenath approach road</strong>
                  <small>Sandur · Ballari district</small>
                </div>
              </article>
              <p className="spatial-project-notice">
                <CircleAlert size={13} />{" "}
                {isDemoResult
                  ? "Measured sample shown for onboarding. Upload your verified polygon to replace it."
                  : spatialProjectFallback.notice}
              </p>

              <div className="spatial-section-label">Layer stack</div>
              <div className="spatial-layer-switch">
                <button
                  className={layerMode === "satellite" ? "active" : ""}
                  onClick={() => setLayerMode("satellite")}
                >
                  <Satellite size={15} />
                  <span>
                    <strong>True colour</strong>
                    <small>
                      {result
                        ? "Sentinel-2 annual median"
                        : "Satellite overview · Esri"}
                    </small>
                  </span>
                </button>
                <button
                  className={layerMode === "land_cover" ? "active" : ""}
                  disabled={!result}
                  onClick={() => setLayerMode("land_cover")}
                >
                  <Layers3 size={15} />
                  <span>
                    <strong>Land cover</strong>
                    <small>
                      {result
                        ? "Dynamic World · 10 m"
                        : "Available after live analysis"}
                    </small>
                  </span>
                </button>
              </div>

              <label className="spatial-slider-field">
                <span>
                  Overlay opacity <strong>{Math.round(opacity * 100)}%</strong>
                </span>
                <input
                  type="range"
                  min="0.15"
                  max="1"
                  step="0.05"
                  value={opacity}
                  disabled={!result || layerMode !== "land_cover"}
                  onChange={(event) => setOpacity(Number(event.target.value))}
                />
              </label>

              <div className="spatial-section-label">Analysis boundary</div>
              <button
                className={`spatial-boundary-card ${geometry || result ? "is-ready" : ""}`}
                onClick={() => fileInput.current?.click()}
              >
                {geometry || result ? (
                  <FileCheck2 size={18} />
                ) : (
                  <UploadCloud size={18} />
                )}
                <span>
                  <strong>
                    {geometry
                      ? geometry.metadata.fileName
                      : result
                        ? result.geometry.fileName
                      : "Attach Polygon or MultiPolygon"}
                  </strong>
                  <small>
                    {geometry
                      ? `${geometry.metadata.areaHectares.toFixed(2)} ha · ${geometry.metadata.coordinateCount.toLocaleString()} vertices`
                      : result
                        ? `${result.geometry.areaHectares.toFixed(2)} ha · saved result`
                      : "GeoJSON or KML · stays in memory"}
                  </small>
                </span>
              </button>

              <div className="spatial-upload-pipeline" aria-live="polite">
                {[
                  ["parsing", "Parse file"],
                  ["validating", "Validate geometry"],
                  ["processing", "Earth Engine compute"],
                  ["complete", "Result ready"],
                ].map(([phase, label], index) => {
                  const phases: UploadPhase[] = [
                    "idle",
                    "parsing",
                    "validating",
                    "processing",
                    "complete",
                  ];
                  const reached =
                    phases.indexOf(uploadPhase) >=
                    phases.indexOf(phase as UploadPhase);
                  return (
                    <span
                      key={phase}
                      className={
                        uploadPhase === phase
                          ? "active"
                          : reached
                            ? "complete"
                            : ""
                      }
                    >
                      <i>{reached ? <Check size={9} /> : index + 1}</i>
                      {label}
                    </span>
                  );
                })}
              </div>

              {error && (
                <div className="spatial-error" role="alert">
                  <CircleAlert size={14} />
                  <span>
                    <strong>Analysis unavailable</strong>
                    {error}
                  </span>
                </div>
              )}

              <div
                className={`spatial-limit-note ${isAdmin ? "is-admin" : ""} ${quotaExhausted ? "is-exhausted" : ""}`}
                aria-live="polite"
              >
                <ShieldCheck size={14} />
                <span>
                  <strong>
                    {isAdmin
                      ? "Admin spatial compute"
                      : quotaExhausted
                        ? "Spatial limit reached"
                        : "Spatial compute allowance"}
                  </strong>
                  <small>
                    {isAdmin
                      ? "Authenticated session · unlimited live analyses"
                      : quotaExhausted
                        ? `New analysis available ${formatQuotaReset(spatialResetAt)}`
                        : `${spatialRemaining} of ${spatialLimit} live analyses remain this hour`}
                  </small>
                </span>
              </div>

              <button
                className="spatial-run-button"
                disabled={
                  !geometry || uploadPhase === "processing" || quotaExhausted
                }
                onClick={rerunAnalysis}
              >
                {uploadPhase === "processing" ? (
                  <span className="spinner" />
                ) : (
                  <Sparkles size={15} />
                )}
                {quotaExhausted
                  ? "Spatial limit reached"
                  : resultIsStale
                    ? "Apply changes & recompute"
                    : result && geometry
                      ? "Recompute comparison"
                      : result
                        ? "Upload boundary to recompute"
                        : "Run live analysis"}
              </button>
            </div>
          </aside>

          <main className="spatial-map-panel">
            <div className="spatial-map-toolbar">
              <div className="spatial-map-tools">
                <button onClick={() => baselineMap.current?.zoomIn()}>
                  <Plus size={15} />
                </button>
                <button onClick={() => baselineMap.current?.zoomOut()}>
                  <Minus size={15} />
                </button>
                <button onClick={resetView} title="Fit or reset view">
                  <LocateFixed size={15} />
                </button>
                <button
                  className={measuring ? "active" : ""}
                  onClick={toggleMeasure}
                  title="Measure distance"
                >
                  <Ruler size={15} />
                </button>
                <button
                  onClick={() =>
                    baselineContainer.current?.requestFullscreen?.()
                  }
                  title="Fullscreen map"
                >
                  <Maximize2 size={15} />
                </button>
              </div>
              <span className="spatial-coordinate">
                <Crosshair size={13} /> {coordinates}
              </span>
              {measureDistance !== null && (
                <span className="spatial-measure">
                  Distance · {formatDistance(measureDistance)}
                </span>
              )}
            </div>

            <div ref={mapStack} className="spatial-map-stack">
              <div ref={baselineContainer} className="spatial-map-base" />
              <div
                className="spatial-map-current-clip"
                style={{ clipPath: overlayClip }}
              >
                <div ref={currentContainer} className="spatial-map-current" />
              </div>
              {compareMode === "swipe" && (
                <div
                  className={`spatial-swipe-line ${result ? "" : "is-disabled"}`}
                  style={{ left: `${swipe}%` }}
                  role="slider"
                  tabIndex={result ? 0 : -1}
                  aria-label="Drag to compare baseline and current imagery"
                  aria-valuemin={8}
                  aria-valuemax={92}
                  aria-valuenow={Math.round(swipe)}
                  aria-disabled={!result}
                  onPointerDown={(event) => {
                    if (!result) return;
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    updateSwipeFromClientX(event.clientX);
                  }}
                  onPointerMove={(event) => {
                    if (
                      result &&
                      event.currentTarget.hasPointerCapture(event.pointerId)
                    ) {
                      updateSwipeFromClientX(event.clientX);
                    }
                  }}
                  onPointerUp={(event) => {
                    if (!result) return;
                    updateSwipeFromClientX(event.clientX);
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!result) return;
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      setSwipe((value) => Math.max(8, value - 2));
                    }
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      setSwipe((value) => Math.min(92, value + 2));
                    }
                    if (event.key === "Home") {
                      event.preventDefault();
                      setSwipe(8);
                    }
                    if (event.key === "End") {
                      event.preventDefault();
                      setSwipe(92);
                    }
                  }}
                >
                  <span>
                    <ArrowLeftRight size={15} />
                  </span>
                  {!result && <small>Upload boundary to compare</small>}
                </div>
              )}
              {result && (
                <>
                  <div className="spatial-year-stamp baseline">
                    <small>Baseline</small>
                    <strong>{displayedBaselineYear}</strong>
                  </div>
                  <div className="spatial-year-stamp current">
                    <small>Comparison</small>
                    <strong>{displayedCurrentYear}</strong>
                  </div>
                </>
              )}
              {!geometry && !result && (
                <div className="spatial-map-empty">
                  <Satellite size={21} />
                  <span>
                    <strong>Real satellite overview</strong>
                    <small>
                      Approximate documented project area · parcel statistics
                      disabled
                    </small>
                  </span>
                </div>
              )}
              {result && !geometry && (
                <div className="spatial-map-empty">
                  <FileCheck2 size={21} />
                  <span>
                    <strong>Saved analysis restored</strong>
                    <small>
                      Statistics remain available · upload the boundary again
                      to recompute
                    </small>
                  </span>
                </div>
              )}
              {uploadPhase === "processing" && (
                <div className="spatial-processing">
                  <span className="spinner" />
                  <div>
                    <strong>Computing annual evidence</strong>
                    <small>
                      Dynamic World probabilities and Sentinel-2 composites
                    </small>
                  </div>
                </div>
              )}
              {result && layerMode === "land_cover" && (
                <div className="spatial-legend">
                  {spatialClassDefinitions.map((item) => (
                    <span key={item.id}>
                      <i style={{ backgroundColor: item.color }} />
                      {item.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="spatial-timeline">
              <div className="spatial-compare-modes">
                {(["baseline", "swipe", "current"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={compareMode === mode ? "active" : ""}
                    disabled={!result}
                    onClick={() => setCompareMode(mode)}
                  >
                    {mode === "swipe" ? <FoldHorizontal size={13} /> : null}
                    {mode}
                  </button>
                ))}
              </div>
              <label>
                <span>Baseline</span>
                <select
                  value={baselineYear}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setBaselineYear(value);
                    if (currentYear <= value) setCurrentYear(value + 1);
                  }}
                >
                  {Array.from(
                    { length: latestCompleteYear - 2015 },
                    (_, index) => 2016 + index,
                  )
                    .filter((year) => year < currentYear)
                    .map((year) => (
                      <option key={year}>{year}</option>
                    ))}
                </select>
              </label>
              <input
                className="spatial-swipe-range"
                type="range"
                min="8"
                max="92"
                value={swipe}
                disabled={!result || compareMode !== "swipe"}
                onChange={(event) => setSwipe(Number(event.target.value))}
                aria-label="Comparison swipe position"
              />
              <label>
                <span>Comparison</span>
                <select
                  value={currentYear}
                  onChange={(event) => setCurrentYear(Number(event.target.value))}
                >
                  {Array.from(
                    { length: latestCompleteYear - 2015 },
                    (_, index) => 2016 + index,
                  )
                    .filter((year) => year > baselineYear)
                    .map((year) => (
                      <option key={year}>{year}</option>
                    ))}
                </select>
              </label>
              <label className="spatial-confidence-control">
                <span>
                  Confidence ≥{" "}
                  <strong>{Math.round(confidenceThreshold * 100)}%</strong>
                </span>
                <input
                  type="range"
                  min="0.35"
                  max="0.9"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(event) =>
                    setConfidenceThreshold(Number(event.target.value))
                  }
                />
              </label>
            </div>
          </main>

          <aside className="spatial-inspector" id="spatial-inspector">
            <button
              className="spatial-inspector-collapse"
              onClick={() => setInspectorCollapsed((value) => !value)}
              aria-label={
                inspectorCollapsed ? "Expand inspector" : "Collapse inspector"
              }
            >
              {inspectorCollapsed ? (
                <ChevronLeft size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
            <div className="spatial-inspector-content">
              <header>
                <div>
                  <span>Baseline vs current</span>
                  <h3>Change inspector</h3>
                </div>
                <select
                  value={sortMode}
                  onChange={(event) =>
                    setSortMode(event.target.value as typeof sortMode)
                  }
                  aria-label="Sort class changes"
                >
                  <option value="change">Largest change</option>
                  <option value="current">Current share</option>
                </select>
              </header>

              {result ? (
                <>
                  {isDemoResult && (
                    <div className="spatial-demo-result-notice">
                      <FileCheck2 size={15} />
                      <span>
                        <strong>Measured demo result</strong>
                        Synthetic 9.38 ha sample · upload your boundary to
                        replace this analysis
                      </span>
                    </div>
                  )}
                  <div className="spatial-metrics-row">
                    <span>
                      <small>Coverage</small>
                      <strong>{result.coveragePercent.current.toFixed(1)}%</strong>
                    </span>
                    <span>
                      <small>Low confidence</small>
                      <strong>
                        {result.lowConfidencePercent.current.toFixed(1)}%
                      </strong>
                    </span>
                    <span>
                      <small>Scenes</small>
                      <strong>
                        {result.baselinePeriod.sceneCount +
                          result.currentPeriod.sceneCount}
                      </strong>
                    </span>
                  </div>

                  <div className="spatial-class-table">
                    <div className="spatial-class-head">
                      <span>Class</span>
                      <span>{displayedBaselineYear}</span>
                      <span>{displayedCurrentYear}</span>
                      <span>Δ pp</span>
                    </div>
                    {sortedClasses.map((item) => (
                      <div className="spatial-class-row" key={item.id}>
                        <span>
                          <i style={{ backgroundColor: item.color }} />
                          {item.label}
                        </span>
                        <span>{item.baseline.toFixed(1)}</span>
                        <span>{item.current.toFixed(1)}</span>
                        <strong
                          className={
                            item.delta > 0
                              ? "increase"
                              : item.delta < 0
                                ? "decrease"
                                : ""
                          }
                        >
                          {item.delta > 0 ? "+" : ""}
                          {item.delta.toFixed(1)}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <div className="spatial-provenance">
                    <ShieldCheck size={15} />
                    <span>
                      <strong>Measured provenance</strong>
                      {result.baselinePeriod.startDate} →{" "}
                      {result.currentPeriod.endDate}
                      <small>{result.attribution}</small>
                    </span>
                  </div>

                  <form className="spatial-ai-card" onSubmit={runInsight}>
                    <div>
                      <Sparkles size={15} />
                      <span>
                        <strong>Interpret this result</strong>
                        <small>Computed context only · approval bounded</small>
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={spatialQuestion}
                      maxLength={800}
                      onChange={(event) =>
                        setSpatialQuestion(event.target.value)
                      }
                    />
                    <button
                      disabled={
                        insightRunning || spatialQuestion.trim().length < 2
                      }
                    >
                      {insightRunning ? (
                        <span className="spinner" />
                      ) : (
                        <Radar size={14} />
                      )}
                      Run bounded review
                    </button>
                  </form>

                  {insightError && (
                    <div className="spatial-error">
                      <CircleAlert size={14} /> {insightError}
                    </div>
                  )}

                  {insight && (
                    <div className="spatial-insight">
                      <span className={`risk-${insight.riskSignal}`}>
                        {insight.riskSignal.replaceAll("_", " ")}
                      </span>
                      <h4>{insight.headline}</h4>
                      <p>{insight.answer}</p>
                      <div className="spatial-action-list">
                        {insight.actions.map((action) => (
                          <article key={`${action.priority}-${action.title}`}>
                            <strong>P{action.priority}</strong>
                            <span>
                              <b>{action.title}</b>
                              <small>{action.rationale}</small>
                            </span>
                          </article>
                        ))}
                      </div>
                      <button
                        className="spatial-queue"
                        onClick={queueTasks}
                        disabled={tasksQueued}
                        type="button"
                      >
                        <ClipboardCheck size={15} />
                        {tasksQueued
                          ? "Inspection handoff complete"
                          : "Add to inspection plan"}
                      </button>
                    </div>
                  )}

                  <p className="spatial-evidence-boundary">
                    <CircleAlert size={13} /> {result.evidenceBoundary}
                  </p>
                </>
              ) : (
                <div className="spatial-inspector-empty">
                  <SlidersHorizontal size={27} />
                  <strong>Parcel statistics are disabled</strong>
                  <p>
                    Upload a valid area boundary to compute coverage,
                    confidence, all nine classes, and year-on-year changes.
                  </p>
                  <button onClick={() => fileInput.current?.click()}>
                    <UploadCloud size={14} /> Choose boundary
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
      <div className="spatial-workflow-handoff">
        <span>
          <small>Screen 02 complete</small>
          <strong>Orchestrate documents, spatial evidence, approvals, and delivery in one controlled run.</strong>
        </span>
        <button
          type="button"
          onClick={() => document.querySelector("#workflow-orchestrator")?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "start",
          })}
        >
          Continue to Screen 03 <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}
