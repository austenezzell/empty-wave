"use client";

/**
 * The poster: one centred piece of media on warm paper, with the lockup pinned
 * near the bottom edge.
 *
 * Layout rule — the lockup sits at a fixed position on the page and the media is
 * centred in the viewport independently of it. A short frame therefore ends
 * above the lockup, while a tall one runs down behind it and the lettering
 * overlays the image. Neither case is special-cased.
 *
 * Sizing rule — every frame occupies the same visual *area* rather than the same
 * width. See `widthPercentForRatio`.
 *
 * Transition rule — hard cuts. Exactly one frame is mounted at any moment and
 * there is no fade of any kind. An earlier version cross-dissolved two stacked
 * layers, which showed the outgoing image around the edges of the incoming one,
 * because equal-area sizing gives every frame different dimensions.
 *
 * A frame is still held back until it reports ready, so a half-loaded image is
 * never shown. Since the next image is preloaded, that gate resolves on mount
 * and the cut reads as instant.
 *
 * Playback details:
 * - Videos advance on their own `ended` event rather than a fixed timer, so a
 *   clip is never cut off and a short clip never leaves dead air.
 * - Only the visible slide is mounted, so the browser never pulls every video on
 *   first paint and drains a free tier's egress.
 * - The dwell timer waits for the frame to report ready, so a slow load is never
 *   counted against its own time on screen.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type React from "react";

import { Lockup } from "@/components/lockup";
import { publicUrl } from "@/lib/storage-url";
import { naturalSize, type Manifest, type Slide } from "@/lib/slides";

/**
 * Safety net for a video that never fires `ended` (bad codec, stalled buffer).
 *
 * Once metadata has loaded the net is the clip's real duration plus this grace,
 * so a long video is never cut off part-way. The fallback below only applies
 * while the duration is still unknown.
 */
const VIDEO_OVERRUN_GRACE_MS = 2_000;

/**
 * How far a pointer must travel horizontally to count as a swipe.
 *
 * It also has to beat the vertical distance, so a mostly-vertical drag is never
 * read as a slide change.
 */
const SWIPE_MIN_PX = 45;
const VIDEO_UNKNOWN_DURATION_MS = 60_000;

/**
 * The media column, shared by the stage and the lockup so the two can never
 * drift apart. Four of twelve columns on desktop, matching the mocks.
 */
const COLUMN = "col-span-12 md:col-start-3 md:col-span-8 lg:col-start-5 lg:col-span-4";

/**
 * Lockup sizing, stepped at the same breakpoints as COLUMN above.
 *
 * Written as Tailwind variants on the same element rather than as raw
 * `@media (min-width: 768px)` blocks in the stylesheet: both values have to
 * track the column span (12 -> 8 -> 4), and keeping every part of that fact on
 * one element means they cannot drift apart in different notations.
 *
 * The lower block is scaled up on small screens. It is sized against the mark,
 * so at one ratio the services line, email and colophon shrink with the whole
 * lockup and end up too small to read on a phone — the email in particular,
 * which is the one thing on the page anybody needs to act on.
 */
const LOCKUP_SIZING = [
  "[--ew-lockup-width:36%] md:[--ew-lockup-width:46%] lg:[--ew-lockup-width:66%]",
  "[--ew-lockup-details-scale:2.1] sm:[--ew-lockup-details-scale:1.75] md:[--ew-lockup-details-scale:1.54]",
].join(" ");

/**
 * Where the back zone ends and the forward zone begins. One value, used by both,
 * so the two can never overlap or leave a dead strip between them.
 */
const BACK_ZONE_WIDTH = "33.3333%";

/**
 * The aspect ratio that defines "full width" — a 3:2 landscape, the shape of
 * most of the photography. Every other frame is scaled to cover the same area
 * as this one does at full column width.
 */
const REFERENCE_RATIO = 3 / 2;

/**
 * Hand-drawn arrow cursors for the step zones.
 *
 * PNG rather than the supplied SVG, and 128px wide, because both matter:
 * browsers ignore any cursor image larger than 128px in either dimension, and
 * Safari does not render SVG cursors at all. The hotspot is the centre of the
 * stroke, so the arrow reads as the pointer itself rather than trailing it.
 * The keyword after the comma is the fallback if the image cannot load.
 */
const CURSOR_PREV = "url(/cursors/arrow-left.png) 64 9, w-resize";
const CURSOR_NEXT = "url(/cursors/arrow-right.png) 64 9, e-resize";

/**
 * Width (as a percentage of the column) that gives this aspect ratio the same
 * area as a REFERENCE_RATIO frame at full width.
 *
 * Equal area means `w * h` is constant. With `w = ratio * h` that solves to
 * `w = columnWidth * sqrt(ratio / REFERENCE_RATIO)` — a plain percentage, so the
 * container never needs measuring.
 *
 * Without this, both orientations would share a width and a 2:3 portrait would
 * come out 2.25x taller than a 3:2 landscape, dominating the page.
 */
function widthPercentForRatio(ratio: number) {
  return Math.min(100, 100 * Math.sqrt(ratio / REFERENCE_RATIO));
}

export function Carousel({ manifest }: { manifest: Manifest }) {
  const { slides, imageDurationMs } = manifest;

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  // Real duration of the current clip, once its metadata has loaded.
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Mirrors `index` so `advance` can read the current position without taking a
  // dependency on it — otherwise every step would rebuild the dwell timer.
  const indexRef = useRef(0);

  const advance = useCallback(
    (step: number) => {
      if (slides.length < 2) return;

      const to = (indexRef.current + step + slides.length) % slides.length;
      indexRef.current = to;

      // Hidden until the incoming frame reports ready, then cut straight in.
      setVisible(false);
      setVideoDurationMs(null);
      setIndex(to);
    },
    [slides.length],
  );

  // Keyboard control, so the reel can be stepped through while reviewing.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") advance(1);
      if (event.key === "ArrowLeft") advance(-1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance]);

  const current = slides[index];

  // Hold on each frame, counted only from the moment it is actually on screen.
  useEffect(() => {
    if (!current || slides.length < 2 || !visible) return;

    /*
     * A slide with its own `durationMs` holds for exactly that long. Otherwise a
     * video plays to its natural end and advances via `onEnded` — the timer then
     * being only a safety net, sized from the clip's own length so it can never
     * truncate playback — and an image uses the shared image duration.
     */
    let holdMs: number;
    if (current.durationMs) {
      holdMs = current.durationMs;
    } else if (current.kind === "video") {
      holdMs =
        videoDurationMs === null
          ? VIDEO_UNKNOWN_DURATION_MS
          : videoDurationMs + VIDEO_OVERRUN_GRACE_MS;
    } else {
      holdMs = imageDurationMs;
    }

    const timer = window.setTimeout(() => advance(1), holdMs);
    return () => window.clearTimeout(timer);
  }, [current, visible, imageDurationMs, videoDurationMs, slides.length, advance]);

  // Warm the next image so the gap between frames stays short. Videos are
  // deliberately left alone — prefetching those is the expensive case.
  useEffect(() => {
    if (slides.length < 2) return;
    const next = slides[(index + 1) % slides.length];
    if (next?.kind !== "image") return;

    const preloader = new window.Image();
    preloader.src = publicUrl(next.path);
  }, [index, slides]);

  // Safari rejects autoplay unless the element is muted before play() is called.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || current?.kind !== "video") return;

    video.muted = true;
    const attempt = video.play();
    // A rejected promise means the browser blocked playback; the watchdog timer
    // still moves the reel along rather than leaving it stuck.
    if (attempt) attempt.catch(() => undefined);
  }, [current, index]);

  /*
   * Swipe, via pointer events so one code path covers touch and mouse.
   *
   * `swiped` suppresses the click that a touch generates after pointerup —
   * without it every swipe would also trigger the tap zone underneath, and a
   * swipe that began over the email would follow the mailto link.
   */
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start) return;

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;

      swiped.current = true;
      // Swiping left pulls the next frame in, as with any reel.
      advance(dx < 0 ? 1 : -1);
    },
    [advance],
  );

  const onClickCapture = useCallback((event: React.MouseEvent) => {
    if (!swiped.current) return;
    swiped.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleReady = useCallback(() => setVisible(true), []);
  const handleDuration = useCallback((seconds: number) => {
    // Live streams report Infinity; leave the fallback in place for those.
    if (Number.isFinite(seconds) && seconds > 0) setVideoDurationMs(seconds * 1000);
  }, []);
  const handleEnded = useCallback(() => advance(1), [advance]);

  return (
    <main
      className="relative min-h-dvh touch-pan-y overflow-hidden bg-paper"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        swipeStart.current = null;
      }}
      onClickCapture={onClickCapture}
    >
      {/* The media stage fills the viewport so each frame centres against it. */}
      <div className="ew-grid absolute inset-0">
        <div className={`${COLUMN} relative`}>
          {current && (
            <MediaLayer
              key={current.id}
              slide={current}
              visible={visible}
              videoRef={videoRef}
              onReady={handleReady}
              onDuration={handleDuration}
              /*
               * A slide with its own hold is timed, not event-driven: it loops
               * to fill a hold longer than the clip, and the dwell timer cuts a
               * hold shorter than it. Advancing on `ended` as well would make a
               * short clip jump early and defeat the setting.
               */
              loop={Boolean(current.durationMs)}
              onEnded={current.durationMs ? undefined : handleEnded}
            />
          )}
        </div>
      </div>

      {/*
        The lockup is pinned to the page, not to the media — that is what makes
        it fall below a short frame and overlay a tall one.
      */}
      {/*
        Sits above the step zones (z-20) so the email link stays clickable now
        that "next" covers everything but the back zone. The overlay itself is
        click-through; Lockup re-enables pointer events on the mailto anchor
        alone, so everything else still advances the reel.
      */}
      <div
        className="ew-grid pointer-events-none absolute inset-x-0 z-30"
        style={{ bottom: "var(--ew-lockup-bottom)" }}
      >
        <div className={`${COLUMN} ${LOCKUP_SIZING} flex justify-center`}>
          <Lockup style={{ width: "var(--ew-lockup-width)" }} />
        </div>
      </div>

      {slides.length > 1 && (
        <>
          {/*
            Invisible tap targets. The left third steps back; everything else —
            including the photograph itself — steps forward, so clicking the
            image advances the reel.

            Forward deliberately takes the larger share: it is the common
            action, and at every breakpoint the media sits inside it. Only on
            narrow screens, where the image spans nearly the full width, does
            its left edge fall into the back zone — which is the familiar
            tap-left-to-go-back behaviour rather than a conflict.
          */}
          <button
            type="button"
            onClick={() => advance(-1)}
            className="absolute inset-y-0 left-0 z-20 focus:outline-none"
            style={{ width: BACK_ZONE_WIDTH, cursor: CURSOR_PREV }}
            aria-label="Previous slide"
          />
          <button
            type="button"
            onClick={() => advance(1)}
            className="absolute inset-y-0 right-0 z-20 focus:outline-none"
            style={{ left: BACK_ZONE_WIDTH, cursor: CURSOR_NEXT }}
            aria-label="Next slide"
          />
        </>
      )}
    </main>
  );
}

type MediaLayerProps = {
  slide: Slide;
  visible: boolean;
  loop?: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
  onReady?: () => void;
  onDuration?: (seconds: number) => void;
  onEnded?: () => void;
};

/** The single mounted frame, centred in the media column. */
function MediaLayer({
  slide,
  visible,
  loop = false,
  videoRef,
  onReady,
  onDuration,
  onEnded,
}: MediaLayerProps) {
  const src = publicUrl(slide.path);
  const nodeRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);

  // Null until the media reports its intrinsic size. Resolving this while the
  // frame is still transparent is why equal-area sizing causes no visible shift.
  const [widthPercent, setWidthPercent] = useState<number | null>(null);

  const measure = useCallback(() => {
    const node = nodeRef.current;
    if (!node) return;

    const size = naturalSize(node);
    if (size) setWidthPercent(widthPercentForRatio(size.width / size.height));
  }, []);

  const handleLoad = useCallback(() => {
    measure();
    onReady?.();
  }, [measure, onReady]);

  const reportDuration = useCallback(() => {
    const node = nodeRef.current;
    if (node instanceof HTMLVideoElement) onDuration?.(node.duration);
  }, [onDuration]);

  // Metadata carries both the intrinsic size and the clip length.
  const handleMetadata = useCallback(() => {
    measure();
    reportDuration();
  }, [measure, reportDuration]);

  /*
   * The first slide is server-rendered, so the browser often finishes loading it
   * before React hydrates and attaches `onLoad`. That event then never fires and
   * the frame would stay at opacity-0 forever. Check on mount whether the media
   * is already usable and report readiness ourselves.
   */
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const alreadyReady =
      node instanceof HTMLImageElement
        ? node.complete && node.naturalWidth > 0
        : node.readyState >= node.HAVE_FUTURE_DATA;

    if (alreadyReady) {
      measure();
      // `loadedmetadata` has already fired and will not fire again, so the clip
      // length has to be read here too — otherwise the safety net falls back to
      // its unknown-duration value and a finished video sits on screen.
      reportDuration();
      onReady?.();
    }
  }, [src, measure, reportDuration, onReady]);

  // One callback ref feeding both the local ref and the parent's video ref.
  const attach = useCallback(
    (node: HTMLImageElement | HTMLVideoElement | null) => {
      nodeRef.current = node;
      if (videoRef && (node === null || node instanceof HTMLVideoElement)) {
        videoRef.current = node as HTMLVideoElement | null;
      }
    },
    [videoRef],
  );

  const mediaClass = "h-auto object-contain";
  const mediaStyle = {
    // Full width until the true ratio is known; it is invisible until then.
    width: widthPercent === null ? "100%" : `${widthPercent}%`,
    // Guard only, for pathologically tall frames that equal-area cannot tame.
    maxHeight: "var(--ew-media-max-height)",
  };

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {slide.kind === "video" ? (
        <video
          ref={attach}
          src={src}
          className={mediaClass}
          style={mediaStyle}
          // `muted` and `playsInline` are both required for iOS to autoplay.
          muted
          playsInline
          autoPlay
          loop={loop}
          preload="auto"
          onLoadedMetadata={handleMetadata}
          onCanPlay={handleLoad}
          // Treat a broken file as a finished one so it cannot stall the reel.
          onError={onEnded}
          onEnded={onEnded}
        />
      ) : (
        // Plain <img>: these are arbitrary client uploads on a remote host, and
        // next/image would bill an Image Optimization transform for every one.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={attach}
          src={src}
          alt={slide.name}
          className={mediaClass}
          style={mediaStyle}
          onLoad={handleLoad}
          onError={onReady}
          draggable={false}
        />
      )}
    </div>
  );
}
