export function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      `Missing Supabase environment variables.

Local setup:
- Copy ".env.example" to ".env.local" in the project root
- Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- Restart the dev server after editing env files

You can find the values in Supabase project settings:
https://supabase.com/dashboard/project/_/settings/api`
    )
  }

  return { supabaseUrl, supabaseAnonKey }
}
