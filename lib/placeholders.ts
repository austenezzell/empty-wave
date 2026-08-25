/**
 * Built-in placeholder slides, served from `public/placeholders/`.
 *
 * These exist so the poster can be designed and reviewed before a Supabase
 * project is wired up. They are shown *only* when storage is unconfigured — see
 * `app/page.tsx`. Once the environment variables are set the real manifest
 * takes over and these never appear again, so an empty bucket in production
 * correctly renders an empty poster rather than someone else's photograph.
 *
 * The order interleaves orientations so the reel exercises the layout rules as
 * it cycles: frames of every shape should carry equal visual weight, and the
 * lockup should sit clear of short frames while tall ones run down towards it.
 *
 * All were produced by `scripts/to-web.sh` from the originals.
 */

import { DEFAULT_IMAGE_DURATION_MS, type Manifest } from "@/lib/slides";

export const PLACEHOLDER_MANIFEST: Manifest = {
  version: 1,
  imageDurationMs: DEFAULT_IMAGE_DURATION_MS,
  slides: [
    { id: "ph-wave", path: "/placeholders/wave-landscape.avif", kind: "image", name: "Wave" },
    { id: "ph-brasil", path: "/placeholders/brasil.avif", kind: "image", name: "Brasil" },
    { id: "ph-napali", path: "/placeholders/napali.avif", kind: "image", name: "Nāpali coast" },
    { id: "ph-turtle", path: "/placeholders/turtle.avif", kind: "image", name: "Turtle" },
    { id: "ph-subway", path: "/placeholders/subway.avif", kind: "image", name: "Subway" },
    { id: "ph-kualoa", path: "/placeholders/kualoa.avif", kind: "image", name: "Kualoa" },
  ],
};
