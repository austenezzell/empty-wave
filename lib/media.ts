/**
 * Reading and writing the slide manifest — the entire "database" for this site.
 *
 * Ordering, media type and filenames live in a single `manifest.json` object
 * stored in the same Supabase bucket as the media itself. Reordering rewrites
 * that one file. This keeps the project free of Postgres, migrations and RLS
 * policies for what is fundamentally an ordered list of files.
 *
 * Server-only: this module reaches for the service-role client. Client
 * components should import types and helpers from `lib/slides.ts` instead.
 *
 * Reads go through the public CDN URL and are cached by Next under the
 * `manifest` tag; every write calls `revalidateTag("manifest")` so the public
 * page picks the change up immediately without hammering Supabase egress.
 */

import { publicUrl, SUPABASE_URL } from "@/lib/storage-url";
import {
  EMPTY_MANIFEST,
  MANIFEST_PATH,
  MANIFEST_TAG,
  parseManifest,
  type Manifest,
} from "@/lib/slides";
import { adminStorage } from "@/lib/supabase-admin";

/**
 * Read the manifest.
 *
 * `fresh` skips the cache — the admin screen needs to see its own writes, while
 * the public page is happy with the tagged, revalidated copy.
 */
export async function getManifest({ fresh = false } = {}): Promise<Manifest> {
  // No Supabase configured yet (a fresh clone, or a build without env vars).
  // Degrade to an empty carousel rather than throwing on a relative URL.
  if (!SUPABASE_URL) return EMPTY_MANIFEST;

  try {
    const res = await fetch(publicUrl(MANIFEST_PATH), {
      ...(fresh
        ? { cache: "no-store" as const }
        : { next: { revalidate: 300, tags: [MANIFEST_TAG] } }),
    });

    // A brand-new bucket has no manifest yet; that is not an error.
    if (!res.ok) return EMPTY_MANIFEST;

    return parseManifest(await res.json());
  } catch {
    // A transient network failure during revalidation must not take the page
    // down — serve an empty carousel and try again on the next request.
    return EMPTY_MANIFEST;
  }
}

/** Overwrite the manifest. Server-only — requires the service-role key. */
export async function saveManifest(manifest: Manifest): Promise<void> {
  const body = new Blob([JSON.stringify(manifest, null, 2)], {
    type: "application/json",
  });

  const { error } = await adminStorage().upload(MANIFEST_PATH, body, {
    upsert: true,
    contentType: "application/json",
    // The manifest must never sit stale behind the CDN the way media can.
    cacheControl: "0",
  });

  if (error) throw new Error(`Could not save the manifest: ${error.message}`);
}
