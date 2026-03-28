function readEnvValue(name: string) {
  return process.env[name]?.trim()
}

export function getSupabaseBrowserEnv() {
  const supabaseUrl = readEnvValue("NEXT_PUBLIC_SUPABASE_URL")
  const supabasePublishableKey =
    readEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
    readEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY") ??
    readEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in frontend/.env.local")
  }

  if (!supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) in frontend/.env.local",
    )
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
  }
}
