/**
 * The browser Storage client.
 *
 * Carries only the publishable (anon) key, and exists for exactly one job: redeeming a signed
 * upload token so a file can go straight from the client's machine to Supabase,
 * bypassing Vercel's 4.5MB serverless request body limit.
 */

import { createClient } from "@supabase/supabase-js";

import { BUCKET, SUPABASE_URL } from "@/lib/storage-url";

/*
 * Supabase renamed its keys: the `anon` key is now the "publishable" key
 * (`sb_publishable_…`). It is a drop-in replacement — same low privileges, same
 * RLS behaviour — so both names are accepted, new one first. Each must be a
 * literal `process.env.X` access for Next to inline it at build time.
 */
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export function browserStorage() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(BUCKET);
}
