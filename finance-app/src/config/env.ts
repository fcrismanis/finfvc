type ProviderName = 'local' | 'supabase'

function resolveProvider(): ProviderName {
  const raw = (import.meta.env.VITE_DATA_PROVIDER ?? '').trim().toLowerCase()
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

  // Explicit opt-out: only an explicit 'local' forces the local provider.
  if (raw === 'local') return 'local'

  // Default = Supabase, the single source of truth (Fase 2.1). Every
  // environment (dev/prod) converges on Supabase whenever creds exist; we only
  // fall back to local when Supabase isn't configured. This avoids ambientes
  // silently diverging because a gitignored .env file forgot the provider line.
  if (!url || !key) {
    // Never log the actual values — just signal what's missing
    const missing = [!url && 'VITE_SUPABASE_URL', !key && 'VITE_SUPABASE_ANON_KEY'].filter(Boolean).join(', ')
    console.warn(`[data] Supabase provider requested but ${missing} not set — falling back to local`)
    return 'local'
  }

  return 'supabase'
}

export const DATA_PROVIDER: ProviderName = resolveProvider()
