/**
 * The public site: the poster and nothing else.
 *
 * Rendered on the server so the manifest fetch is cached under the `manifest`
 * tag. Admin edits call `revalidateTag`, so the page updates on the next
 * request without the visitor's browser ever talking to Supabase for anything
 * but the media files themselves.
 */

import { Carousel } from "@/components/carousel";
import { GridOverlay } from "@/components/grid-overlay";
import { getManifest } from "@/lib/media";
import { PLACEHOLDER_MANIFEST } from "@/lib/placeholders";
import { isStorageConfigured } from "@/lib/storage-url";

export default async function HomePage() {
  const manifest = await getManifest();

  /*
   * Fall back to the built-in placeholders only while storage is unconfigured,
   * so the poster is reviewable before Supabase exists. A configured project
   * with an empty bucket must render an empty poster, not stand-in artwork.
   */
  const display = isStorageConfigured() ? manifest : PLACEHOLDER_MANIFEST;

  return (
    <>
      <Carousel manifest={display} />
      {/* Only renders when the URL carries `?grid`. */}
      <GridOverlay />
    </>
  );
}
