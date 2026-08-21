"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import type { WebImageResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  title: string;
  image_url: string;
  source_url?: string;
  caption?: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
}

interface LightboxState {
  images: GalleryImage[];
  index: number;
}

let openLightboxExternal: ((images: GalleryImage[], index: number) => void) | null = null;

export function openImageLightbox(images: GalleryImage[], index: number) {
  openLightboxExternal?.(images, index);
}

function Lightbox({
  state,
  onClose,
  onIndex,
}: {
  state: LightboxState;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const image = state.images[state.index];
  const labelId = useId();

  const prev = useCallback(() => {
    onIndex((state.index - 1 + state.images.length) % state.images.length);
  }, [onIndex, state.index, state.images.length]);

  const next = useCallback(() => {
    onIndex((state.index + 1) % state.images.length);
  }, [onIndex, state.index, state.images.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={onClose}
        aria-label="Close image"
      >
        <X className="h-5 w-5" />
      </button>
      {state.images.length > 1 && (
        <>
      <button
        type="button"
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={(e) => {
          e.stopPropagation();
          prev();
        }}
        aria-label="Previous image"
      >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
      <figure
        className="max-h-[88vh] max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.image_url}
          alt={image.title}
          className="max-h-[72vh] w-auto rounded-lg object-contain shadow-2xl"
        />
        <figcaption id={labelId} className="mt-3 text-center text-sm text-white/80">
          <span className="font-medium text-white">{image.title}</span>
          {image.caption ? ` — ${image.caption}` : null}
          {image.source_url && (
            <>
              {" · "}
              <a
                href={image.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Source
              </a>
            </>
          )}
        </figcaption>
      </figure>
    </div>
  );
}

export function ImageLightboxHost() {
  const [state, setState] = useState<LightboxState | null>(null);

  useEffect(() => {
    openLightboxExternal = (images, index) => setState({ images, index });
    return () => {
      openLightboxExternal = null;
    };
  }, []);

  if (!state) return null;
  return (
    <Lightbox
      state={state}
      onClose={() => setState(null)}
      onIndex={(index) => setState((s) => (s ? { ...s, index } : s))}
    />
  );
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = images.filter((img) => img.image_url && !hidden.has(img.image_url));
  if (visible.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {visible.map((image, idx) => (
        <button
          key={image.image_url}
          type="button"
          onClick={() => openImageLightbox(visible, idx)}
          className="group overflow-hidden rounded-xl border border-black/[0.06] bg-black/[0.02] text-left transition-all hover:border-slate-400/40 dark:border-white/10 dark:bg-white/5"
        >
          <div className="relative h-36 overflow-hidden bg-slate-100 dark:bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.image_url}
              alt={image.title}
              loading="lazy"
              className={cn(
                "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]",
              )}
              onError={() => setHidden((prev) => new Set(prev).add(image.image_url))}
            />
          </div>
          <div className="space-y-1 p-3">
            <p className="text-xs font-medium">{image.title}</p>
            {image.caption && (
              <p className="line-clamp-2 text-[11px] text-muted-foreground">{image.caption}</p>
            )}
            {image.source_url && (
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Source
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export function toGalleryImages(images: WebImageResult[]): GalleryImage[] {
  return images.map((img) => ({
    title: img.title,
    image_url: img.image_url,
    source_url: img.source_url,
    caption: img.caption,
  }));
}
