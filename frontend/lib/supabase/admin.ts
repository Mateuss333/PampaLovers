import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseBrowserEnv } from "@/lib/supabase/config"

/**
 * Cliente con service role: solo en servidor (API routes, server actions).
 * No exponer la clave al cliente.
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return null

  const { supabaseUrl } = getSupabaseBrowserEnv()
  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
