/**
 * The privileged Storage client — the only thing in the app allowed to write.
 *
 * The service-role key bypasses every storage policy, so this module is marked
 * `server-only`: importing it from a client component becomes a build error
 * rather than a silent leak.
 */

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { BUCKET, SUPABASE_URL } from "@/lib/storage-url";

/*
 * `||` rather than `??`: an env var set to an empty string is the common
 * deploy mistake, and `??` would accept it and skip the legacy fallback.
 */
function readSecretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

/**
 * Whether storage can actually be *written* to.
 *
 * `isStorageConfigured()` only knows about the URL, which is all the public
 * page needs. The admin needs more: with a URL but no secret key it would
 * render a fully unlocked editor whose every save throws.
 */
export function isStorageWritable() {
  return Boolean(SUPABASE_URL && readSecretKey());
}

export function adminStorage() {
  // Supabase renamed `service_role` to the "secret" key (`sb_secret_…`).
  // Both names are accepted, new one first.
  const secretKey = readSecretKey();

  if (!SUPABASE_URL || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (formerly SUPABASE_SERVICE_ROLE_KEY). Copy .env.local.example to .env.local and fill it in.",
    );
  }

  return createClient(SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(BUCKET);
}
