/**
 * The hand-lettered Empty Wave Media lockup.
 *
 * Rendered as two pieces so their sizes can be tuned independently:
 *
 *   lockup-mark.svg     EXX, EMPTY WAVE, MEDIA
 *   lockup-details.svg  services line, email, city, year
 *
 * Both are viewBox crops of the supplied master (`lockup.svg`) taken at the
 * blank band at y=143.6, so the artwork and the designer's spacing are
 * untouched — only the framing differs. Stacked at equal scale they reproduce
 * the master exactly; `--ew-lockup-details-scale` then sizes the lower block
 * relative to the mark.
 *
 * Sizing is otherwise external: the parent sets the width (see
 * `--ew-lockup-width`) and each viewBox supplies its own aspect ratio, so
 * nothing is ever distorted.
 */

import type { CSSProperties } from "react";

/** Intrinsic sizes, straight from each crop's viewBox. */
const MARK = { width: 361.83, height: 143.6 };
const DETAILS = { width: 361.83, height: 78.7 };

export function Lockup({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`flex flex-col items-center ${className}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/lockup-mark.svg"
        alt="Empty Wave Media"
        width={MARK.width}
        height={MARK.height}
        style={{ width: "100%", height: "auto" }}
      />
      {/*
        Widened past 100% rather than transformed, so the extra size also grows
        the element's box. The lockup is bottom-anchored, so it expands upward
        and nothing is ever clipped.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/lockup-details.svg"
        alt="Photography, Print, Murals, Video Production. johnolsonart@gmail.com, Laguna Beach, CA. 2026"
        width={DETAILS.width}
        height={DETAILS.height}
        style={{
          width: "calc(100% * var(--ew-lockup-details-scale))",
          // Tailwind's Preflight sets `img { max-width: 100% }`, which would
          // clamp this straight back to the container width and make the scale
          // variable silently do nothing.
          maxWidth: "none",
          height: "auto",
        }}
      />
    </div>
  );
}
