#!/usr/bin/env bash
#
# Regenerate the share images (`app/opengraph-image.png`, `app/twitter-image.png`)
# by screenshotting the real poster, so the preview can never drift from the
# actual design.
#
# It builds and serves a *production* bundle rather than using `pnpm dev`,
# because the dev build paints Next's dev indicator into the corner of the frame.
#
# Usage:
#   scripts/make-og.sh [SLIDE_MS]
#
# SLIDE_MS is how far into the reel to capture, in milliseconds — each slide
# holds for 6s by default, so 8000 lands on the second slide. Pick whichever
# frame you want representing the site.

set -euo pipefail

SLIDE_MS="${1:-8000}"
PORT=3100
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT_DIR="app"

[[ -x "$CHROME" ]] || { echo "Google Chrome not found at $CHROME" >&2; exit 1; }

echo "Building..."
pnpm build >/dev/null

echo "Serving on :$PORT..."
pnpm start -p "$PORT" >/tmp/ew-og-server.log 2>&1 &
SERVER_PID=$!
# Always take the server down, however this script exits.
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

until curl -sf -o /dev/null "http://localhost:$PORT/"; do sleep 1; done

echo "Capturing at ${SLIDE_MS}ms..."
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1200,630 --virtual-time-budget="$SLIDE_MS" \
  --screenshot="$OUT_DIR/opengraph-image.png" \
  "http://localhost:$PORT/" 2>/dev/null

cp "$OUT_DIR/opengraph-image.png" "$OUT_DIR/twitter-image.png"

echo "Wrote $OUT_DIR/opengraph-image.png and $OUT_DIR/twitter-image.png (1200x630)."
