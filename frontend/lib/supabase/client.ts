import { createBrowserClient } from "@supabase/ssr"

import { getSupabaseBrowserEnv } from "@/lib/supabase/config"

export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseBrowserEnv()

  return createBrowserClient(supabaseUrl, supabasePublishableKey)
}
