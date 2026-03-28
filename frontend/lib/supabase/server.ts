import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getSupabaseBrowserEnv } from "@/lib/supabase/config"

export async function createClient() {
  const cookieStore = await cookies()
  const { supabaseUrl, supabasePublishableKey } = getSupabaseBrowserEnv()

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot always write cookies.
        }
      },
    },
  })
}
