/**
 * The site's title and description, editable without a deploy.
 */

import { AdminDetails } from "@/components/admin-details";
import { getDisplayManifest } from "@/lib/media";
import { isStorageWritable } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AdminDetailsPage() {
  const { manifest } = await getDisplayManifest({ fresh: true });

  return (
    <AdminDetails manifest={manifest} storageConfigured={isStorageWritable()} />
  );
}
