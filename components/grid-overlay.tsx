"use client";

/**
 * A development aid: overlays the 12 columns so the layout can be checked
 * against the Figma frame. Enable it by adding `?grid` to the URL.
 *
 * Two deliberate choices here:
 *
 * - It reads `window.location.search` on the client rather than using
 *   `useSearchParams`, because reading search params on the server would force
 *   the public page out of static rendering just to support a debugging tool.
 * - It uses `useSyncExternalStore` rather than an effect, so the server snapshot
 *   is simply `false` and React reconciles the client value without a hydration
 *   mismatch and without setting state during an effect.
 */

import { useSyncExternalStore } from "react";

/** The flag cannot change without a navigation, so nothing ever needs to fire. */
function subscribe() {
  return () => {};
}

function readFromUrl() {
  return new URLSearchParams(window.location.search).has("grid");
}

export function GridOverlay() {
  const enabled = useSyncExternalStore(subscribe, readFromUrl, () => false);

  if (!enabled) return null;

  return (
    <div className="ew-grid pointer-events-none fixed inset-0 z-50" aria-hidden>
      {Array.from({ length: 12 }, (_, column) => (
        <div
          key={column}
          className="h-full bg-red-500/10 outline outline-red-500/30"
        />
      ))}
    </div>
  );
}
