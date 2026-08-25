/**
 * The hand-lettered Empty Wave Media lockup.
 *
 * Rendered as four pieces, each a viewBox crop of the supplied master
 * (`lockup.svg`) with the paths outside its band stripped:
 *
 *   lockup-mark.svg      EXX, EMPTY WAVE, MEDIA
 *   lockup-services.svg  the services line
 *   lockup-email.svg     the email address
 *   lockup-colophon.svg  city and year
 *
 * The crops are taken at the blank bands between blocks, so stacking them at
 * equal scale reproduces the master exactly — the artwork and the designer's
 * spacing are untouched.
 *
 * Splitting is what makes the email interactive: it is lettering, not text, so
 * it can only be wrapped in a link and hover-faded once it is its own element.
 * That also avoids positioning a hit area over it by measured coordinates,
 * which would drift the moment the artwork was redrawn.
 *
 * Sizing is external: the parent sets the width (`--ew-lockup-width`) and
 * `--ew-lockup-details-scale` sizes the lower three against the mark.
 */

import type { CSSProperties } from "react";

const EMAIL = "johnolsonart@gmail.com";

/** Intrinsic sizes, straight from each crop's viewBox. */
const MARK = { width: 361.83, height: 143.6 };
const SERVICES = { width: 361.83, height: 35.82 };
const EMAIL_ART = { width: 361.83, height: 17.99 };
const COLOPHON = { width: 361.83, height: 24.89 };

const PIECE = "block h-auto w-full";

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
        className={PIECE}
      />

      {/*
        The lower block is widened past 100% rather than transformed, so the
        extra size also grows its box. The lockup is bottom-anchored, so it
        expands upward and is never clipped.
      */}
      <div style={{ width: "calc(100% * var(--ew-lockup-details-scale))" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/lockup-services.svg"
          alt="Photography. Print. Murals. Video Production."
          width={SERVICES.width}
          height={SERVICES.height}
          className={PIECE}
        />

        <a
          href={`mailto:${EMAIL}`}
          aria-label={`Email ${EMAIL}`}
          title={EMAIL}
          className="group block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/lockup-email.svg"
            alt={EMAIL}
            width={EMAIL_ART.width}
            height={EMAIL_ART.height}
            className={`${PIECE} transition-opacity duration-200 group-hover:opacity-50 motion-reduce:transition-none`}
          />
        </a>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/lockup-colophon.svg"
          alt="Laguna Beach, CA. 2026"
          width={COLOPHON.width}
          height={COLOPHON.height}
          className={PIECE}
        />
      </div>
    </div>
  );
}
