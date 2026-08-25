/**
 * The share image, generated from a random slide.
 *
 * Reproduces the poster: warm paper, one frame sized by equal visual area, the
 * lockup pinned near the bottom — so a shared link looks like the site rather
 * than a separate graphic, and looks different each time it is generated.
 *
 * Two constraints shape the implementation:
 *
 * 1. Satori (which renders this) cannot decode AVIF, and every slide is AVIF.
 *    It silently draws nothing — no error, just a blank frame. Each slide is
 *    therefore routed through Next's image optimiser, which returns JPEG when
 *    the requester does not advertise support for modern formats.
 * 2. Satori needs explicit dimensions to lay an image out, and the manifest
 *    does not record them, so the JPEG's own header is read for its size.
 */

import { headers } from "next/headers";
import { ImageResponse } from "next/og";

import { getDisplayManifest } from "@/lib/media";
import { SITE } from "@/lib/site";
import type { Slide } from "@/lib/slides";

export const alt = SITE.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Regenerate per request so repeat shares do not all get the same photograph.
export const dynamic = "force-dynamic";

/* The poster's geometry at 1200x630, from the same tokens the site uses. */
const MARGIN = 36; // clamp(1rem, 3vw, 3rem) at 1200
const GUTTER = 18; // clamp(0.75rem, 1.5vw, 1.5rem) at 1200
const TRACK = (size.width - MARGIN * 2 - GUTTER * 11) / 12;
const COLUMN = TRACK * 4 + GUTTER * 3; // the lg span: 4 of 12
const MEDIA_MAX_HEIGHT = size.height * 0.8;
const LOCKUP_WIDTH = COLUMN * 0.66;
const DETAILS_SCALE = 1.54;
const LOCKUP_BOTTOM = 22;
const REFERENCE_RATIO = 3 / 2;

/** Intrinsic heights of the lockup crops, per components/lockup.tsx. */
const ART_WIDTH = 361.83;
const PIECES = [
  { name: "mark", height: 143.6, scaled: false },
  { name: "services", height: 35.82, scaled: true },
  { name: "email", height: 17.99, scaled: true },
  { name: "colophon", height: 24.89, scaled: true },
] as const;

/** Width and height from a JPEG's SOF marker. */
function jpegSize(bytes: Uint8Array) {
  let offset = 2; // skip SOI
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    // SOF0..SOF15, excluding the non-frame markers in that range.
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    offset += 2 + length;
  }
  return null;
}

/** Equal-area sizing, matching `widthPercentForRatio` in the carousel. */
function frameSize(ratio: number) {
  let width = Math.min(COLUMN, COLUMN * Math.sqrt(ratio / REFERENCE_RATIO));
  let height = width / ratio;

  if (height > MEDIA_MAX_HEIGHT) {
    height = MEDIA_MAX_HEIGHT;
    width = height * ratio;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Origin of the running deployment.
 *
 * Taken from the request headers rather than NEXT_PUBLIC_SITE_URL: this has to
 * resolve on preview deployments and locally too, where that variable either is
 * unset or names a different host. The convention's default export is not
 * handed a Request, so the headers are the only source.
 */
async function requestOrigin() {
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "localhost:3000";
  const protocol = head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export default async function OpengraphImage() {
  const origin = await requestOrigin();
  const { manifest } = await getDisplayManifest();

  // Videos cannot be rendered here, so the pool is the stills.
  const stills = manifest.slides.filter((slide: Slide) => slide.kind === "image");
  const slide = stills[Math.floor(Math.random() * stills.length)];

  let frame: { url: string; width: number; height: number } | null = null;

  if (slide) {
    const source = slide.path.startsWith("/")
      ? `${origin}${slide.path}`
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${slide.path}`;
    // 640 is ample for a 364px-wide frame and keeps the round trip small.
    const url = `${origin}/_next/image?url=${encodeURIComponent(source)}&w=640&q=75`;

    const response = await fetch(url, { headers: { Accept: "*/*" } });
    if (response.ok) {
      const measured = jpegSize(new Uint8Array(await response.arrayBuffer()));
      if (measured) {
        frame = { url, ...frameSize(measured.width / measured.height) };
      }
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: "flex",
          position: "relative",
          background: "#e7e5e0",
        }}
      >
        {frame && (
          <div
            style={{
              position: "absolute",
              // Satori has no `inset` shorthand; the sides must be explicit.
              top: 0,
              left: 0,
              width: size.width,
              height: size.height,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img src={frame.url} width={frame.width} height={frame.height} alt="" />
          </div>
        )}

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: LOCKUP_BOTTOM,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {PIECES.map((piece) => {
            const width = LOCKUP_WIDTH * (piece.scaled ? DETAILS_SCALE : 1);
            return (
              <img
                key={piece.name}
                src={`${origin}/brand/lockup-${piece.name}.svg`}
                width={Math.round(width)}
                height={Math.round((width * piece.height) / ART_WIDTH)}
                alt=""
              />
            );
          })}
        </div>
      </div>
    ),
    size,
  );
}
