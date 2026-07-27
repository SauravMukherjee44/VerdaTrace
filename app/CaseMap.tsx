"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";

export function CaseMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Vinext's default emitted worker asset path is not stable on Sites.
    // Serve MapLibre's version-matched module worker from the public bundle.
    maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

    const map = new maplibregl.Map({
      container: mapContainer.current,
      center: [76.55, 15.08],
      zoom: 8.7,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          carto: {
            type: "raster",
            tiles: [
              "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution:
              "&copy; OpenStreetMap contributors &copy; CARTO",
          },
        },
        layers: [{ id: "carto", type: "raster", source: "carto" }],
      },
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    const marker = document.createElement("div");
    marker.className = "case-map-marker";
    marker.setAttribute("aria-label", "Approximate Sandur project location");
    new maplibregl.Marker({ element: marker })
      .setLngLat([76.55, 15.08])
      .setPopup(
        new maplibregl.Popup({ offset: 18 }).setHTML(
          "<strong>Sandur, Ballari district</strong><br/><span>Approximate documented location — not a parcel boundary.</span>",
        ),
      )
      .addTo(map);

    return () => map.remove();
  }, []);

  return (
    <div className="map-shell">
      <div ref={mapContainer} className="case-map" aria-label="Project location map" />
      <div className="map-disclaimer">
        <span className="map-dot" />
        Approximate location only
      </div>
      <div className="geometry-gap">
        <span>Geometry gap</span>
        Amended 9.54 ha parcel polygon is not available in the review set.
      </div>
    </div>
  );
}
