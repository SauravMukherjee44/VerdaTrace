"use client";

import { useEffect, useRef } from "react";

const RESEARCH_SCENE_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260613_180732_a54afbf6-b30d-470e-861f-669871f09f67.mp4";

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
  };
};

export function ResearchHeroScene() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as NavigatorWithConnection).connection;

    const updatePlayback = () => {
      if (reducedMotion.matches || connection?.saveData) {
        video.pause();
        return;
      }
      void video.play().catch(() => {
        // The poster remains visible when autoplay is unavailable.
      });
    };

    const handleVisibility = () => {
      if (document.hidden) video.pause();
      else updatePlayback();
    };

    reducedMotion.addEventListener("change", updatePlayback);
    document.addEventListener("visibilitychange", handleVisibility);
    updatePlayback();

    return () => {
      reducedMotion.removeEventListener("change", updatePlayback);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <div className="cc-research-scene" aria-hidden="true">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/videos/verdatrace-cinematic-hero-poster.webp"
        tabIndex={-1}
      >
        <source src={RESEARCH_SCENE_VIDEO} type="video/mp4" />
      </video>
      <div className="cc-research-scene-shade" />
      <div className="cc-research-scene-atmosphere" />
    </div>
  );
}
