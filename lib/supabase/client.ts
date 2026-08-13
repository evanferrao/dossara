import { createClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client using the public anon key.
 * Safe to use in client components — only has anon-level access.
 */
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, key);
}
