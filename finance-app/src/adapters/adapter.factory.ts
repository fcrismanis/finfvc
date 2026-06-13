import { DATA_PROVIDER } from '../config/env'
import type { IDataProvider } from '../providers/data.provider'
import { LocalDataProvider } from '../providers/local.data.provider'
import { SupabaseDataProvider } from '../providers/supabase.data.provider'

// NOTE: adapter.factory.ts is a misnomer — it creates IDataProvider, not IDataAdapter.
// Rename deferred to avoid churn; tracked as tech-debt.
export function createDataProvider(familyId?: string): IDataProvider {
  if (DATA_PROVIDER === 'supabase') {
    return new SupabaseDataProvider(familyId)
  }
  return new LocalDataProvider()
}
