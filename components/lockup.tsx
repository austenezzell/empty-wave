/**
 * The hand-lettered Empty Wave Media lockup.
 *
 * Four pieces, each a viewBox crop of the supplied master (`design/lockup.svg`)
 * with the paths outside its band stripped. Regenerate them all with
 * `scripts/split-lockup.sh`, which also prints the heights below.
 *
 * The crops are taken at the blank bands between blocks, so stacking them at
 * equal scale reproduces the master exactly — the artwork and the designer's
 * spacing are untouched.
 *
 * Splitting is what makes the email interactive: it is lettering, not text, so
 * it can only be wrapped in a link and hover-faded once it is its own element.
 *
 * Sizing is external: the parent sets the width (`--ew-lockup-width`) and
 * `--ew-lockup-details-scale` sizes the lower three against the mark.
 *
 * The component is click-through apart from the email link, and says so itself
 * rather than relying on a class set by whatever renders it — the carousel
 * overlays this on top of its step zones, and only the link should swallow a
 * click.
 */

import type { CSSProperties } from "react";

import { SITE } from "@/lib/site";

/** Shared artwork width; every crop spans the master's full width. */
const ART_WIDTH = 361.83;

/** Crop heights, from each generated viewBox. See scripts/split-lockup.sh. */
const HEIGHTS = {
  mark: 143.6,
  services: 35.82,
  email: 17.99,
  colophon: 24.89,
} as const;

function Piece({
  name,
  alt,
  className = "",
}: {
  name: keyof typeof HEIGHTS;
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/lockup-${name}.svg`}
      alt={alt}
      width={ART_WIDTH}
      height={HEIGHTS[name]}
      className={`block h-auto w-full ${className}`}
    />
  );
}

export function Lockup({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`pointer-events-none flex flex-col items-center ${className}`}
      style={style}
    >
      <Piece name="mark" alt={SITE.name} />

      {/*
        The lower block is widened past 100% rather than transformed, so the
        extra size also grows its box. The lockup is bottom-anchored, so it
        expands upward and is never clipped.
      */}
      <div style={{ width: "calc(100% * var(--ew-lockup-details-scale))" }}>
        <Piece name="services" alt={`${SITE.services.join(". ")}.`} />

        <a
          href={`mailto:${SITE.email}`}
          aria-label={`Email ${SITE.email}`}
          title={SITE.email}
          className="group pointer-events-auto block"
        >
          <Piece
            name="email"
            alt={SITE.email}
            className="transition-opacity duration-200 group-hover:opacity-50 motion-reduce:transition-none"
          />
        </a>

        <Piece name="colophon" alt={`${SITE.locality}, ${SITE.region}.`} />
      </div>
    </div>
  );
}
