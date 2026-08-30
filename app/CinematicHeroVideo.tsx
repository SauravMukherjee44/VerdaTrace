"use client";

import { useEffect, useRef } from "react";

type CinematicHeroVideoProps = {
  mp4Src: string;
  webmSrc: string;
  posterSrc: string;
  fadeDuration?: number;
  restartDelay?: number;
};

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
  };
};

export function CinematicHeroVideo({
  mp4Src,
  webmSrc,
  posterSrc,
  fadeDuration = 0.5,
  restartDelay = 100,
}: CinematicHeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as NavigatorWithConnection).connection;
    let animationFrame = 0;
    let restartTimer = 0;
    let disposed = false;

    const shouldUsePoster = () =>
      reducedMotion.matches || Boolean(connection?.saveData);

    const cancelPlaybackWork = () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(restartTimer);
    };

    const updateOpacity = () => {
      if (disposed || shouldUsePoster()) return;

      const { currentTime, duration } = video;
      if (Number.isFinite(duration) && duration > 0) {
        const fadeIn = Math.min(1, currentTime / fadeDuration);
        const fadeOut = Math.min(
          1,
          Math.max(0, duration - currentTime) / fadeDuration,
        );
        video.style.opacity = String(Math.max(0, Math.min(fadeIn, fadeOut)));
      }

      animationFrame = window.requestAnimationFrame(updateOpacity);
    };

    const beginPlayback = () => {
      cancelPlaybackWork();
      if (shouldUsePoster()) {
        video.pause();
        video.style.opacity = "0";
        return;
      }

      animationFrame = window.requestAnimationFrame(updateOpacity);
      void video.play().catch(() => {
        video.style.opacity = "0";
        window.cancelAnimationFrame(animationFrame);
      });
    };

    const handleEnded = () => {
      cancelPlaybackWork();
      video.style.opacity = "0";
      restartTimer = window.setTimeout(() => {
        if (disposed || shouldUsePoster()) return;
        video.currentTime = 0;
        beginPlayback();
      }, restartDelay);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
        window.cancelAnimationFrame(animationFrame);
      } else {
        beginPlayback();
      }
    };

    const handlePreferenceChange = () => {
      if (shouldUsePoster()) {
        cancelPlaybackWork();
        video.pause();
        video.style.opacity = "0";
      } else {
        video.currentTime = 0;
        beginPlayback();
      }
    };

    video.addEventListener("loadeddata", beginPlayback);
    video.addEventListener("ended", handleEnded);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotion.addEventListener("change", handlePreferenceChange);

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      beginPlayback();
    }

    return () => {
      disposed = true;
      cancelPlaybackWork();
      video.removeEventListener("loadeddata", beginPlayback);
      video.removeEventListener("ended", handleEnded);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotion.removeEventListener("change", handlePreferenceChange);
    };
  }, [fadeDuration, restartDelay]);

  return (
    <div
      className="cc-cinematic-media"
      style={
        { "--cinematic-poster": `url("${posterSrc}")` } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        className="cc-cinematic-video"
        autoPlay
        muted
        playsInline
        preload="metadata"
        poster={posterSrc}
        tabIndex={-1}
      >
        <source src={webmSrc} type="video/webm" />
        <source src={mp4Src} type="video/mp4" />
      </video>
    </div>
  );
}
