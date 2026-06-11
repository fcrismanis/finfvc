type ProviderName = 'local' | 'supabase'

function resolveProvider(): ProviderName {
  const raw = (import.meta.env.VITE_DATA_PROVIDER ?? '').trim().toLowerCase()
  if (raw !== 'supabase') return 'local'

  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

  if (!url || !key) {
    // Never log the actual values — just signal what's missing
    const missing = [!url && 'VITE_SUPABASE_URL', !key && 'VITE_SUPABASE_ANON_KEY'].filter(Boolean).join(', ')
    console.warn(`[data] VITE_DATA_PROVIDER=supabase but ${missing} not set — falling back to local`)
    return 'local'
  }

  return 'supabase'
}

export const DATA_PROVIDER: ProviderName = resolveProvider()
