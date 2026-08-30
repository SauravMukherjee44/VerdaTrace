"use client";

import { ArrowRight, Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ProductCardImageProps = {
  src: string;
  alt: string;
  label: string;
  signal: string;
  actionHref: string;
  actionLabel: string;
};

export function ProductCardImage({
  src,
  alt,
  label,
  signal,
  actionHref,
  actionLabel,
}: ProductCardImageProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const figureRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const card = figureRef.current?.closest("article");
    if (!card) return;

    const openFromCard = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("a, button, input, select, textarea")
      ) {
        return;
      }
      setPreviewOpen(true);
    };

    card.classList.add("cc-product-card-preview-trigger");
    card.addEventListener("click", openFromCard);
    return () => {
      card.classList.remove("cc-product-card-preview-trigger");
      card.removeEventListener("click", openFromCard);
    };
  }, []);

  useEffect(() => {
    if (!previewOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    const closeOnScroll = () => setPreviewOpen(false);

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnScroll, {
      passive: true,
      once: true,
    });
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnScroll);
    };
  }, [previewOpen]);

  const closePreview = () => setPreviewOpen(false);

  const preview =
    previewOpen
      ? createPortal(
          <div
            className="cc-product-preview-layer"
            role="presentation"
            onClick={closePreview}
            onPointerMove={(event) => {
              if (
                event.pointerType === "mouse" &&
                event.target === event.currentTarget
              ) {
                closePreview();
              }
            }}
          >
            <div
              className="cc-product-preview-dialog"
              role="dialog"
              aria-label={`${label} enlarged product preview`}
              onClick={(event) => event.stopPropagation()}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") closePreview();
              }}
            >
              <button
                type="button"
                className="cc-product-preview-close"
                onClick={closePreview}
                aria-label="Close enlarged product preview"
              >
                <X size={20} />
              </button>
              <img
                src={src}
                alt={alt}
                width="1600"
                height="900"
                decoding="async"
              />
              <div className="cc-product-preview-caption">
                <span>
                  <i /> {label}
                </span>
                <em>{signal}</em>
                <small>Move away or press Esc to close</small>
                <a
                  className="cc-product-preview-action"
                  href={actionHref}
                  onClick={(event) => event.stopPropagation()}
                >
                  {actionLabel} <ArrowRight size={15} />
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <figure
        ref={figureRef}
        className="cc-product-card-image"
        tabIndex={0}
        role="button"
        aria-label={`Enlarge ${label} preview`}
        aria-haspopup="dialog"
        onClick={() => setPreviewOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setPreviewOpen(true);
          }
        }}
      >
        <img src={src} alt={alt} width="1200" height="675" loading="lazy" />
        <figcaption>
          <span>
            <i /> {label}
          </span>
          <em>{signal}</em>
        </figcaption>
        <span className="cc-product-card-image-sheen" aria-hidden="true" />
        <span className="cc-product-card-enlarge" aria-hidden="true">
          <Maximize2 size={14} />
          Enlarge
        </span>
      </figure>
      {preview}
    </>
  );
}
