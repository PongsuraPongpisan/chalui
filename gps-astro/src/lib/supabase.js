// Server-only Supabase client. Uses the secret key, which bypasses RLS —
// this file must NEVER be imported into client-side/browser code.
// Astro API routes (src/pages/api/*) run server-side, so this is safe there.
import { createClient } from "@supabase/supabase-js";

function getEnv(key) {
  return (
    (import.meta.env && import.meta.env[key]) ||
    (typeof process !== "undefined" && process.env && process.env[key])
  );
}

const supabaseUrl = getEnv("SUPABASE_URL");
const supabaseSecretKey = getEnv("SUPABASE_SECRET_KEY");

if (!supabaseUrl || !supabaseSecretKey) {
  console.warn(
    "[supabase] Missing SUPABASE_URL or SUPABASE_SECRET_KEY env vars. " +
    "API routes that touch the database will fail until these are set."
  );
}

export const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false },
});
