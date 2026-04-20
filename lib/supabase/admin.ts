import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Admin client: uses the service role key. Server-only. Bypasses RLS.
// Use this in API routes and server-side helpers that need to write or read
// without the Postgres role restrictions.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase admin env vars");
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
