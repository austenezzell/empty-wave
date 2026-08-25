/**
 * Slide types and pure helpers.
 *
 * Split out from `lib/media.ts` so that client components can import the shapes
 * and the MIME sniffing without pulling in the service-role Storage client.
 * `media.ts` is server-only; this file must stay free of any Supabase import.
 */

import { SITE } from "@/lib/site";

export const MANIFEST_PATH = "manifest.json";
export const MANIFEST_TAG = "manifest";

/** How long a still image holds the screen before advancing, in ms. */
export const DEFAULT_IMAGE_DURATION_MS = 6000;

/** Bounds for a per-slide hold, in seconds. */
export const MIN_SLIDE_SECONDS = 1;
export const MAX_SLIDE_SECONDS = 600;

export type SlideKind = "image" | "video";

export type Slide = {
  /** Stable id, used as the React key and as the drag handle identity. */
  id: string;
  /** Object path inside the bucket, e.g. `slides/1712-hero.jpg`. */
  path: string;
  kind: SlideKind;
  /** Original filename, shown in the admin list so the client recognises it. */
  name: string;
  /**
   * How long this slide holds the screen, in ms.
   *
   * Set automatically to a video's own length when it is uploaded, and editable
   * per slide in the admin. When absent, a video plays to its natural end and an
   * image falls back to the manifest's `imageDurationMs`.
   */
  durationMs?: number;
};

/** Outward-facing copy, editable by the client at /admin. */
export type SiteMeta = {
  title: string;
  description: string;
};

export type Manifest = {
  version: 1;
  imageDurationMs: number;
  meta: SiteMeta;
  slides: Slide[];
};

export const DEFAULT_META: SiteMeta = {
  title: SITE.name,
  description: SITE.description,
};

export const EMPTY_MANIFEST: Manifest = {
  version: 1,
  imageDurationMs: DEFAULT_IMAGE_DURATION_MS,
  meta: DEFAULT_META,
  slides: [],
};

/** Narrow an unknown JSON blob into a Manifest, discarding anything malformed. */
export function parseManifest(raw: unknown): Manifest {
  if (!raw || typeof raw !== "object") return EMPTY_MANIFEST;
  const candidate = raw as Partial<Manifest>;
  const slides = Array.isArray(candidate.slides) ? candidate.slides : [];

  const meta = (candidate.meta ?? {}) as Partial<SiteMeta>;

  return {
    version: 1,
    // Blank strings fall back too — an empty title would be worse than none.
    meta: {
      title: meta.title?.trim() || DEFAULT_META.title,
      description: meta.description?.trim() || DEFAULT_META.description,
    },
    imageDurationMs:
      typeof candidate.imageDurationMs === "number" && candidate.imageDurationMs > 0
        ? candidate.imageDurationMs
        : DEFAULT_IMAGE_DURATION_MS,
    slides: slides
      .filter(
        (slide): slide is Slide =>
          !!slide &&
          typeof slide.id === "string" &&
          typeof slide.path === "string" &&
          (slide.kind === "image" || slide.kind === "video"),
      )
      // Drop a malformed duration rather than letting it stall the reel.
      .map(({ durationMs, ...slide }) => ({
        ...slide,
        ...(typeof durationMs === "number" && durationMs > 0 ? { durationMs } : {}),
      })),
  };
}

/**
 * The formats a browser can actually display.
 *
 * Deliberately narrower than `image/*` and `video/*`. A TIFF is a valid image
 * MIME type that no browser renders, and QuickTime `.mov` only plays reliably
 * in Safari — accepting either would upload happily and then show nothing.
 * Run `scripts/to-web.sh` over camera files first.
 */
const WEB_SAFE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "video/mp4",
  "video/webm",
]);

/** The `accept` attribute for the upload input, from the same source of truth. */
export const UPLOAD_ACCEPT = [...WEB_SAFE_MIME_TYPES].join(",");

/**
 * Decide how a slide should render, based on the uploaded file's MIME type.
 * Returns null for anything the browser could not display.
 */
export function kindFromMimeType(mimeType: string): SlideKind | null {
  if (!WEB_SAFE_MIME_TYPES.has(mimeType)) return null;
  return mimeType.startsWith("image/") ? "image" : "video";
}

/**
 * Intrinsic dimensions of a loaded media element, or null if not known yet.
 *
 * Images and videos expose their natural size under different property names,
 * and both report 0 until the metadata arrives — so the zero check is the
 * "has it loaded?" test, not a defensive extra.
 */
export function naturalSize(node: HTMLImageElement | HTMLVideoElement) {
  const width = node instanceof HTMLImageElement ? node.naturalWidth : node.videoWidth;
  const height = node instanceof HTMLImageElement ? node.naturalHeight : node.videoHeight;
  return width > 0 && height > 0 ? { width, height } : null;
}
