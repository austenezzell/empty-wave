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

export function adminStorage() {
  // Supabase renamed `service_role` to the "secret" key (`sb_secret_…`).
  // Both names are accepted, new one first.
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (formerly SUPABASE_SERVICE_ROLE_KEY). Copy .env.local.example to .env.local and fill it in.",
    );
  }

  return createClient(SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(BUCKET);
}
