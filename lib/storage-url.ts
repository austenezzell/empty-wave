/**
 * Bucket naming and public URL construction.
 *
 * Deliberately kept free of any Supabase client so that client components can
 * import it without dragging the service-role client into the browser bundle.
 */

export const BUCKET = "media";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** False until the Supabase environment variables are filled in. */
export function isStorageConfigured() {
  return SUPABASE_URL !== "";
}

/**
 * Resolve a slide's `path` to something the browser can load.
 *
 * A leading slash marks a local asset served from `public/` — that is how the
 * built-in placeholders work. Everything else is an object in the bucket.
 */
export function publicUrl(path: string) {
  if (path.startsWith("/")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
