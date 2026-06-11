import { DATA_PROVIDER } from '../config/env'
import type { IDataProvider } from '../providers/data.provider'
import { LocalDataProvider } from '../providers/local.data.provider'
import { SupabaseDataProvider } from '../providers/supabase.data.provider'

export function createDataProvider(): IDataProvider {
  if (DATA_PROVIDER === 'supabase') {
    // familyId is injected here once auth is implemented
    return new SupabaseDataProvider()
  }
  return new LocalDataProvider()
}

// Singleton — created once at module init, shared across the app
export const dataProvider: IDataProvider = createDataProvider()
