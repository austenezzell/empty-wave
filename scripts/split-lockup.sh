#!/usr/bin/env bash
#
# Split the master lockup into the crops the site renders.
#
#   design/lockup.svg  ->  public/brand/lockup-{mark,services,email,colophon}.svg
#                      ->  public/brand/lockup-monogram.svg (a re-crop of mark)
#
# Each crop keeps only the paths whose band it covers, and carries a viewBox
# framing that band. The boundaries sit in the blank gaps between blocks, so
# stacking the crops at equal scale reproduces the master exactly — the artwork
# and the designer's spacing are never touched.
#
# Run this after the master is redrawn, then copy the printed heights into
# HEIGHTS in components/lockup.tsx.
#
# Usage: scripts/split-lockup.sh

set -euo pipefail

cd "$(dirname "$0")/.."
python3 - "$@" <<'PY'
import re, pathlib, sys

SRC = pathlib.Path("design/lockup.svg")
OUT = pathlib.Path("public/brand")
WIDTH, TOTAL = 361.83, 222.30

# Band boundaries in viewBox units, taken from the blank rows between blocks.
BANDS = [
    ("mark",     0.00,   143.60),
    ("services", 143.60, 179.42),
    ("email",    179.42, 197.41),
    ("colophon", 197.41, TOTAL),
]

# A tight crop of the monogram alone, for the places too small to carry the
# lettering — the admin sidebar. Unlike BANDS this one does not tile: it
# re-crops the top of the mark, so its paths are deliberately a second copy.
#
# The split sits in the blank gap the master leaves under the monogram (40.26
# to 56.26 in viewBox units), and the window is the monogram's own ink bounds
# plus two units of margin on all four sides. Re-measure both if the master is
# redrawn: render the mark and look for the fully blank rows.
MONOGRAM_SPLIT = 48.00
MONOGRAM_VIEWBOX = (124.00, -2.00, 108.00, 44.00)

src = SRC.read_text()
elements = re.findall(r"<path[^>]*/>", src)
paths = re.findall(r'<path[^>]*\sd="([^"]+)"[^>]*/>', src)
if len(elements) != len(paths):
    sys.exit(f"parse mismatch: {len(elements)} elements vs {len(paths)} d-attrs")

# SVG allows an implicit separator between coordinates ("M161.99.24").
NUM = r"-?\d*\.?\d+"
first_move = re.compile(rf"\s*[Mm]\s*({NUM})[,\s]*({NUM})")

buckets = {name: [] for name, _, _ in BANDS}
unplaced = 0
for element, d in zip(elements, paths):
    m = first_move.match(d)
    if not m:
        # Unknown position: keep it everywhere rather than silently drop ink.
        unplaced += 1
        for name in buckets:
            buckets[name].append(element)
        continue
    y = float(m.group(2))
    for name, lo, hi in BANDS:
        if lo <= y < hi:
            buckets[name].append(element)
            break
    else:
        for name in buckets:
            buckets[name].append(element)

span = sum(hi - lo for _, lo, hi in BANDS)
if abs(span - TOTAL) > 0.01:
    sys.exit(f"bands span {span}, expected {TOTAL} — they must tile the master exactly")

total_paths = 0
print(f"{'file':<28} {'paths':>5}  {'height':>7}")
for name, lo, hi in BANDS:
    height = hi - lo
    body = "\n".join(buckets[name])
    out = OUT / f"lockup-{name}.svg"
    out.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 {lo:g} {WIDTH} {height:.2f}">\n{body}\n</svg>\n'
    )
    total_paths += len(buckets[name])
    print(f"  {out.name:<26} {len(buckets[name]):>5}  {height:>7.2f}")

mono = [
    element
    for element, d in zip(elements, paths)
    if (m := first_move.match(d)) and float(m.group(2)) < MONOGRAM_SPLIT
]
mx, my, mw, mh = MONOGRAM_VIEWBOX
mono_out = OUT / "lockup-monogram.svg"
mono_out.write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" '
    f'viewBox="{mx:g} {my:g} {mw:g} {mh:g}">\n'
    + "\n".join(mono)
    + "\n</svg>\n"
)
print(f"  {mono_out.name:<26} {len(mono):>5}  {mh:>7.2f}  (re-crop of mark)")

if unplaced:
    print(f"  ({unplaced} paths had unreadable coordinates and were kept in every crop)")
if total_paths != len(elements) + unplaced * (len(BANDS) - 1):
    sys.exit("path accounting failed — some ink was dropped or duplicated")

print(f"\n  {len(elements)} paths in, accounted for.")
print("  Copy these heights into HEIGHTS in components/lockup.tsx:")
for name, lo, hi in BANDS:
    print(f"    {name}: {hi - lo:.2f},")
PY
