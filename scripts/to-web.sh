#!/usr/bin/env bash
#
# Convert source photography and footage into web-ready files for the carousel.
#
# Images  → AVIF (SVT-AV1), long edge capped at 2560px
# Videos  → H.264 MP4, 1080p cap, faststart, audio stripped
#
# Two project constraints drive these settings:
#
#   1. Supabase's free plan rejects uploads over 50MB, and the editor checks
#      that before uploading. Anything from a camera needs this pass first.
#   2. Egress — not storage — is the ceiling that bites first, and an
#      autoplaying carousel sends every file to every visitor. Smaller wins
#      twice.
#
# Audio is stripped from video because the carousel always plays muted (browsers
# refuse to autoplay otherwise), so shipping an audio track is pure waste.
#
# Usage:
#   scripts/to-web.sh <file-or-directory>... [-o OUTDIR]
#
# Defaults to writing alongside the source in ./web-ready/.

set -euo pipefail

IMAGE_CRF=30      # AVIF quality. Lower is better/larger; 28-34 is a sane range.
IMAGE_MAX_EDGE=2560
VIDEO_CRF=23      # H.264 quality. 18 near-lossless, 28 noticeably soft.
VIDEO_MAX_WIDTH=1920

OUTDIR="web-ready"
INPUTS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o) OUTDIR="$2"; shift 2 ;;
    -h|--help) sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) INPUTS+=("$1"); shift ;;
  esac
done

if [[ ${#INPUTS[@]} -eq 0 ]]; then
  echo "usage: $0 <file-or-directory>... [-o OUTDIR]" >&2
  exit 1
fi

command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)" >&2; exit 1; }

mkdir -p "$OUTDIR"

human() { # bytes -> human readable, portable across macOS/Linux
  awk -v b="$1" 'BEGIN{ split("B KB MB GB",u," "); i=1; while(b>=1024 && i<4){b/=1024;i++}; printf "%.1f%s", b, u[i] }'
}

convert_image() {
  local src="$1" base out ext decoded=""
  base="$(basename "${src%.*}")"
  out="$OUTDIR/$base.avif"

  # HEIC/HEIF: ffmpeg reads the small embedded *thumbnail* rather than the full
  # image (a 4752x3168 iPhone photo probes as 512x512), so it would silently
  # convert a postage stamp. macOS `sips` decodes these properly; hand it off
  # and convert the intermediate instead.
  ext="$(echo "${src##*.}" | tr '"'"'[:upper:]'"'"' '"'"'[:lower:]'"'"')"
  if [[ "$ext" == "heic" || "$ext" == "heif" ]]; then
    command -v sips >/dev/null || { echo "heic needs sips (macOS)" >&2; return 1; }
    decoded="$(mktemp -t towebXXXX).png"
    sips -s format png "$src" --out "$decoded" >/dev/null 2>&1
    src="$decoded"
  fi

  # scale only when larger than the cap; -2 keeps dimensions even for the codec.
  ffmpeg -y -loglevel error -i "$src" \
    -vf "scale='if(gt(max(iw,ih),$IMAGE_MAX_EDGE), if(gt(iw,ih), $IMAGE_MAX_EDGE, -2), iw)':'if(gt(max(iw,ih),$IMAGE_MAX_EDGE), if(gt(iw,ih), -2, $IMAGE_MAX_EDGE), ih)'" \
    -c:v libsvtav1 -crf "$IMAGE_CRF" -f avif "$out" 2>/dev/null

  if [[ -n "$decoded" ]]; then rm -f "$decoded"; fi
  echo "$out"
}

convert_video() {
  local src="$1" base out
  base="$(basename "${src%.*}")"
  out="$OUTDIR/$base.mp4"

  ffmpeg -y -loglevel error -i "$src" \
    -vf "scale='min($VIDEO_MAX_WIDTH,iw)':-2" \
    -c:v libx264 -preset slow -crf "$VIDEO_CRF" -pix_fmt yuv420p \
    -movflags +faststart -an "$out" 2>/dev/null
  echo "$out"
}

process() {
  local src="$1" ext out before after
  ext="$(echo "${src##*.}" | tr '[:upper:]' '[:lower:]')"

  case "$ext" in
    jpg|jpeg|png|tif|tiff|heic|webp|bmp) out="$(convert_image "$src")" ;;
    mov|mp4|m4v|avi|mkv|webm)            out="$(convert_video "$src")" ;;
    *) echo "skip  $src (unsupported extension .$ext)"; return ;;
  esac

  before=$(wc -c < "$src" | tr -d ' ')
  after=$(wc -c < "$out" | tr -d ' ')
  printf "ok    %-44s %8s -> %-8s (%d%%)\n" \
    "$(basename "$src")" "$(human "$before")" "$(human "$after")" \
    $(( after * 100 / (before > 0 ? before : 1) ))
}

for input in "${INPUTS[@]}"; do
  if [[ -d "$input" ]]; then
    while IFS= read -r file; do process "$file"; done \
      < <(find "$input" -type f -not -name ".*" | sort)
  elif [[ -f "$input" ]]; then
    process "$input"
  else
    echo "skip  $input (not found)" >&2
  fi
done

echo
echo "Output in $OUTDIR/ — check nothing exceeds 50MB before uploading."
