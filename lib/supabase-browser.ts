/**
 * The browser Storage client.
 *
 * Carries only the anon key, and exists for exactly one job: redeeming a signed
 * upload token so a file can go straight from the client's machine to Supabase,
 * bypassing Vercel's 4.5MB serverless request body limit.
 */

import { createClient } from "@supabase/supabase-js";

import { BUCKET, SUPABASE_URL } from "@/lib/storage-url";

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function browserStorage() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(BUCKET);
}
