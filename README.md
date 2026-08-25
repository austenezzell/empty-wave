# Empty Wave

A single-page, full-screen carousel that autoplays through a set of photos and
videos. The client manages the media themselves at `/admin` — upload, drag to
reorder, delete — with no developer involvement and no redeploy.

## How it works

The entire state of the site is **one JSON file in one Supabase Storage
bucket**. There is no Postgres table, no Supabase Auth, and no CMS.

```
bucket: media (public)
  manifest.json        ← the ordered list of slides + timing
  slides/
    1712…-hero.jpg
    1712…-lineup.mp4
```

- **Reads.** The public page fetches `manifest.json` through Supabase's CDN and
  caches it under a Next cache tag. Media files are served straight from the
  same CDN, so visitor traffic never passes through Vercel.
- **Writes.** `/admin` is gated by a single shared password, exchanged for an
  HMAC-signed httpOnly cookie. Server actions hold the service-role key and are
  the only thing that can modify the bucket. Every write revalidates the cache
  tag, so the public page updates on the next request.
- **Uploads.** The browser uploads directly to Supabase using a one-shot signed
  URL minted by the server. This is not a stylistic choice: Vercel rejects
  serverless request bodies over 4.5MB, so routing video through the app would
  break on anything but small clips.

## Layout

The page is a poster on a 12-column grid, and one rule drives it:

> The lockup sits at a **fixed position on the page**. The media is centred in
> the viewport **independently** of it.

That single rule produces both mocks. A landscape frame is short enough to end
above the lockup; a taller portrait runs down behind it and the lettering
overlays the image. Neither case is special-cased in the code.

Exactly **one frame is mounted at a time**. The outgoing frame fades out to
bare paper, and only then is the next one mounted and faded in
(`FADE_MS`, 500ms).

An earlier version cross-dissolved two stacked layers. That looks fine when
every frame is the same size, but equal-area sizing gives each one different
dimensions, so the outgoing image showed around the edges of the incoming one.
Dipping through the background makes overlap impossible rather than unlikely.

Frames are sized by **equal visual area**, not equal width. Every slide covers
the same area regardless of orientation, so a portrait reads with the same
weight as a landscape rather than towering over it.

The maths collapses to a plain percentage, so the container is never measured:

```
width = columnWidth x sqrt(ratio / 1.5)
```

A 3:2 frame lands at 100%, anything wider clamps to 100%, and a 2:3 portrait
comes out at ~65% width. The ratio is measured from the media on load — which
costs nothing visually, because the layer is transparent until it reports ready.

**Trade-off worth knowing:** equal area makes portraits shorter, so a typical
portrait now clears the lockup instead of being overlaid by it. If you want the
overlap back, raise `REFERENCE_RATIO`'s effective area or lower
`--ew-lockup-bottom`.

The knobs, all in `app/globals.css` unless noted:

| Knob | Where | Meaning |
| --- | --- | --- |
| `--ew-margin` | `globals.css` | Page side margin |
| `--ew-gutter` | `globals.css` | Column gutter |
| `--ew-media-max-height` | `globals.css` | Safety guard for extreme frames only |
| `REFERENCE_RATIO` | `components/carousel.tsx` | Aspect ratio that defines "full width" |
| `--ew-lockup-bottom` | `globals.css` | Lockup's distance from the bottom edge |
| `--ew-lockup-width` | `globals.css` | Lockup width as a % of the media column |
| `COLUMN` | `components/carousel.tsx` | Column span of the media and lockup |

Add `?grid` to any URL to overlay the 12 columns and check them against Figma.

### Placeholders

Before Supabase exists, the poster falls back to three built-in slides in
`public/placeholders/` (see `lib/placeholders.ts`). The order alternates
landscape, portrait, landscape — precisely the test of the layout rule above:
the lockup should clear the landscape frames and be overlaid by the portrait
one, with no special-casing between them.

All three were produced by `scripts/to-web.sh` from the originals.

While storage is unconfigured, `/admin` shows the same placeholders in a
read-only state with a banner explaining why, rather than reporting "Nothing
added yet" while six photos are live on the site.

The fallback is gated on `isStorageConfigured()`, so it disappears the moment
the environment variables are set. A configured project with an empty bucket
renders an empty poster rather than stand-in artwork.

Slide paths beginning with `/` resolve to local files in `public/`; everything
else resolves to an object in the Supabase bucket.

### The lockup

Rendered as two pieces so their sizes can be tuned independently —
`lockup-mark.svg` (EXX, EMPTY WAVE, MEDIA) and `lockup-details.svg` (services
line, email, city, year). Both are viewBox crops of the supplied master
`lockup.svg`, taken at the blank band at y=143.6, so the artwork and the
designer's spacing are untouched; at equal scale they reproduce the master
exactly.

`--ew-lockup-details-scale` sizes the lower block against the mark. At `1` the
services line is 1.174x the width of the wordmark, which is the proportion the
original standalone SVGs imply.

> **Gotcha:** the details image sets `max-width: none` inline, and must keep it.
> Tailwind's Preflight applies `img { max-width: 100% }`, which silently clamps
> the scaled width back to the container and makes this variable do nothing at
> all — with no error and no visual hint that it is being ignored.



`components/lockup.tsx` renders a single supplied SVG, `public/brand/lockup.svg`
— the EXX mark, wordmark, MEDIA rule, services line, email and colophon all in
one file with the designer's own spacing.

This replaced an earlier version that stacked four separate SVGs with hand-tuned
gaps. Those gaps were inferred from the mocks and were always going to drift
from the intended composition; one file carries the real spacing and cannot
drift at all.

Sizing is entirely external: the parent sets the width via `--ew-lockup-width`
and the intrinsic `361.83 × 222.3` viewBox supplies the aspect ratio, so the
artwork scales without ever being distorted. To swap it, overwrite the file and
update the two intrinsic constants if the viewBox changed.

## Cursors

The left and right step zones use the hand-drawn arrows in `public/cursors/`.

Two constraints shaped how these are delivered, and both bite silently:

- **Browsers ignore any cursor image larger than 128px** in either dimension —
  no warning, the cursor just stays default. The source arrows are ~750px wide,
  so they are rasterised down to 128px.
- **Safari does not render SVG cursors at all**, so they ship as PNG.

Regenerate them from the SVGs after any edit:

```bash
# render at 128px wide on a transparent background
chrome --headless=new --default-background-color=00000000 \
  --window-size=128,19 --screenshot=arrow-right.png page-with-svg.html
```

The hotspot is the centre of the stroke (`64 9`), so the arrow reads as the
pointer itself. Move it to the arrowhead end if you would rather the tail
trailed behind.

## Video behaviour

A video plays **to its natural end**, then the reel advances. It is never cut
off at the image dwell time, and it never lingers after it finishes.

- `onEnded` is the primary trigger — the clip's own end event.
- A safety net sits behind it in case `ended` never fires (a stalled buffer, a
  broken file). The net is sized from the clip's **real duration plus 2s**, read
  from its metadata, so it can never truncate playback. Only while the duration
  is still unknown does it fall back to 60s.
- Clips are muted and `playsInline`; browsers refuse to autoplay otherwise.
- A file that fails to load fires `onError`, which advances the reel rather than
  leaving a dead frame on screen.

Note that headless Chrome decodes video but does not advance the media clock
under `--virtual-time-budget`, so the `ended` path cannot be exercised by the
screenshot tooling — only the duration-derived net can. Check `ended` in a real
browser.

## Preparing media

Camera files are not web files. `scripts/to-web.sh` converts them:

```bash
scripts/to-web.sh ~/Desktop/shoot            # a whole folder
scripts/to-web.sh photo.tif clip.mov -o out  # specific files
```

| Input | Output | Settings |
| --- | --- | --- |
| jpg, png, **tif**, heic, webp, bmp | AVIF | long edge capped at 2560px, CRF 30 |
| **mov**, mp4, m4v, avi, mkv, webm | H.264 MP4 | 1080p cap, CRF 23, faststart, **audio stripped** |

Three of those choices are load-bearing:

- **AVIF over WebP.** Measured on the placeholder, AVIF was 41KB against 127KB
  for the same JPEG — under a third. Since egress is the ceiling that bites
  first, and every visitor is sent every file, size wins twice. (Requires
  Safari 16.4+, released March 2023.)
- **Audio is stripped.** The carousel always plays muted, because browsers
  refuse to autoplay otherwise, so an audio track is bytes nobody can hear.
- **`+faststart`.** Moves the MP4 index to the front of the file so playback
  starts before the whole clip has downloaded.

**HEIC needs special handling, and the script does it for you.** ffmpeg reads
the small embedded *thumbnail* out of a HEIC rather than the full image — a
4752x3168 iPhone photo probes as 512x512 — so a naive conversion silently ships
a postage stamp. The script routes HEIC/HEIF through macOS `sips` first and
converts the intermediate.

**Letterboxed screenshots are not handled automatically.** An iPhone screenshot
of a photo carries black bars, which show as hard black blocks against the paper
background. Find the bounds and crop before converting:

```bash
# average each row to one pixel, then find the first/last non-black row
ffmpeg -v error -i shot.png -vf "scale=1:2532" -frames:v 1 \
  -f rawvideo -pix_fmt gray - | xxd -p -c1 | grep -n -v '^.*:0[0-9]$' | head
ffmpeg -i shot.png -vf "crop=WIDTH:HEIGHT:0:TOP" cropped.png
```

Auto-detection is deliberately not built in — it would eventually crop a
photograph that legitimately fades to black at the edges.

The editor only accepts formats a browser can actually display — JPEG, PNG,
WebP, AVIF, GIF, MP4, WebM. **TIFF and QuickTime `.mov` are rejected on
purpose**: both are valid MIME types that would upload happily and then render
nothing (no browser draws TIFF; `.mov` plays only in Safari). Convert first.

## Share images and icons

`app/opengraph-image.png` and `app/twitter-image.png` (1200x630) are the link
preview; `app/icon.png`, `app/apple-icon.png` and `app/favicon.ico` are the
browser icons. All are picked up by Next's file conventions — no tags to write.

The share image is a **screenshot of the real poster**, so the preview can never
drift from the actual design. Regenerate it with:

```bash
scripts/make-og.sh          # second slide (default)
scripts/make-og.sh 20000    # a later frame, if you want a different photo
```

It builds and serves a production bundle to do this, because `pnpm dev` paints
Next's dev indicator into the corner of the frame.

Set `NEXT_PUBLIC_SITE_URL` in the deployed environment. Without it, Next builds
share-image URLs against `localhost` and previews break everywhere else.

## Deploying

Import this repo on Vercel and add the same environment variables from
`.env.local` (including `ADMIN_SESSION_SECRET` and `ADMIN_PASSWORD`). The repo
root is the project root — there is no subdirectory to configure.
`vercel.json` registers the daily cron described below.

## Living on the free tiers

Both Supabase and Vercel are being used on their free plans, which is workable
but has three edges worth knowing about:

- **Supabase pauses free projects after a week of inactivity**, and a paused
  project takes Storage down with it — meaning a week with no visitors could
  leave the carousel dark. The daily cron at `/api/keep-alive` performs one
  cheap read to keep the project counted as active. Set `CRON_SECRET` in Vercel
  to lock the endpoint down.
- **Egress is the real ceiling, not storage.** The free plan includes 1GB of
  storage but only 5GB of egress per month, and an autoplaying video carousel
  sends every clip to every visitor. Five 15MB clips is ~75MB per full loop,
  so roughly 70 loops a month. Compress hard: 1080p, H.264, short clips. If the
  site gets real traffic, egress is what will run out first.
- **Vercel's Hobby plan is for non-commercial use only** under their fair use
  guidelines. If this becomes a paying client's site, it needs a Pro plan.

Individual uploads are capped at 50MB by the Supabase free plan; the editor
checks this before uploading and says so plainly.

## Conventions

pnpm, Next.js 16 App Router, TypeScript, Tailwind v4. Every source file opens
with a docstring explaining its role.

One rule is load-bearing: **`lib/media.ts` and `lib/supabase-admin.ts` are
server-only** and carry the service-role key. Client components import types
and helpers from `lib/slides.ts` instead. `supabase-admin.ts` is marked with
the `server-only` package, so breaking this becomes a build error rather than a
leaked key.

Before calling anything done:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```
