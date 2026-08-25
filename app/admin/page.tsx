/**
 * The reel: add media, reorder, remove, and set per-clip timing.
 *
 * The sign-in gate and chrome live in the layout.
 */

import { AdminMedia } from "@/components/admin-media";
import { getDisplayManifest } from "@/lib/media";
import { isStorageWritable } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AdminCarouselPage() {
  // Mirrors what the public page is showing, placeholders included — an editor
  // reading "Nothing added yet" while photos are live is simply confusing.
  const { manifest } = await getDisplayManifest({ fresh: true });

  return (
    <AdminMedia
      key={manifest.slides.map((slide) => slide.id).join(",")}
      manifest={manifest}
      storageConfigured={isStorageWritable()}
    />
  );
}
