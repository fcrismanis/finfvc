import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — Supabase adapter will not work.')
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')
