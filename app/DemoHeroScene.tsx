"use client";

import { VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DEMO_HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4";

export function DemoHeroScene() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motionDisabled, setMotionDisabled] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean };
      }
    ).connection;
    const updateMotion = () =>
      setMotionDisabled(media.matches || Boolean(connection?.saveData));

    updateMotion();
    media.addEventListener?.("change", updateMotion);
    return () => media.removeEventListener?.("change", updateMotion);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (motionDisabled) {
      video.pause();
      return;
    }
    void video.play().catch(() => {
      // The poster remains visible when a browser blocks autoplay.
    });
  }, [motionDisabled]);

  return (
    <section className="demo-cinematic-hero" aria-labelledby="demo-hero-title">
      <div className={`demo-hero-media ${videoReady ? "is-ready" : ""}`}>
        {!motionDisabled && (
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="none"
            poster="/videos/verdatrace-cinematic-hero-poster.webp"
            onCanPlay={() => setVideoReady(true)}
            aria-hidden="true"
          >
            <source src={DEMO_HERO_VIDEO} type="video/mp4" />
          </video>
        )}
      </div>

      <div className="demo-hero-content">
        <div className="demo-hero-copy">
          <h1 id="demo-hero-title" className="demo-hero-title">
            <span className="demo-hero-title-line">
              From approval documents
            </span>
            <span className="demo-hero-title-line">
              to accountable action.
            </span>
          </h1>
          <p className="demo-hero-subtitle">
            VerdaTrace turns approvals, amendments, maps, images, and field
            records into current obligations, evidence gaps, spatial change,
            and inspection-ready action.
          </p>
        </div>

        <div className="demo-hero-tag-wrap">
          <div className="demo-hero-tag liquid-glass">
            <span>Extract.</span>
            <span>Resolve.</span>
            <span>Verify.</span>
            <span>Act.</span>
          </div>
        </div>
      </div>

      <div className="demo-hero-caption liquid-glass">
        <VolumeX size={13} />
        <span>Decorative landscape · public case below</span>
      </div>
    </section>
  );
}
