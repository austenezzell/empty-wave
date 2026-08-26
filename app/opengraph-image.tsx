/**
 * The share image, generated from a random slide.
 *
 * Reproduces the poster: warm paper, one frame sized by equal visual area, the
 * lockup pinned near the bottom — so a shared link looks like the site rather
 * than a separate graphic, and looks different each time it is generated.
 *
 * Satori, which renders this, cannot decode AVIF — and every slide is AVIF. It
 * draws nothing at all rather than erroring, so the frame comes out blank.
 *
 * Slides are therefore decoded with sharp and handed over as JPEG. An earlier
 * version routed them through Next's image optimiser instead, which works in
 * `next dev` but not in production: Vercel's optimiser passes AVIF through
 * untouched whatever `Accept` is sent, so the photograph silently vanished on
 * the deployed site. Decoding here keeps dev and production identical.
 *
 * sharp also reports the intrinsic size, which Satori needs to lay the image
 * out and the manifest does not record.
 */

import { headers } from "next/headers";
import { ImageResponse } from "next/og";
import sharp from "sharp";

import { getDisplayManifest } from "@/lib/media";
import { SITE } from "@/lib/site";
import type { Slide } from "@/lib/slides";

export const alt = SITE.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Regenerate per request so repeat shares do not all get the same photograph.
export const dynamic = "force-dynamic";
// sharp is a native module; it cannot run on the edge runtime.
export const runtime = "nodejs";

/** Widest the photograph is ever drawn here, so there is no point decoding larger. */
const SOURCE_WIDTH = 720;

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

    try {
      const response = await fetch(source);
      if (response.ok) {
        const input = sharp(Buffer.from(await response.arrayBuffer()));
        const { width, height } = await input.metadata();

        if (width && height) {
          const jpeg = await input
            .resize({ width: SOURCE_WIDTH, withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

          frame = {
            url: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
            ...frameSize(width / height),
          };
        }
      }
    } catch {
      // A frame that cannot be decoded is not worth failing the card over —
      // the lockup on bare paper is a reasonable fallback.
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
