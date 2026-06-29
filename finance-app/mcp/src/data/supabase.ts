import { createClient } from '@supabase/supabase-js'
import type { Transaction, Budget, DbTransaction, DbBudget, MacroCategory } from './types.js'
import { dbToTransaction, dbToBudget } from './types.js'
import { MACRO_CATEGORIES } from '../config/categories.js'

let _client: ReturnType<typeof createClient> | null = null

function client() {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

function lastDayOf(yearMonth: string): string {
  const [yr, mo] = yearMonth.split('-').map(Number)
  const last = new Date(yr, mo, 0).getDate()
  return `${yearMonth}-${String(last).padStart(2, '0')}`
}

function familyId(): string {
  const id = process.env.FAMILY_ID
  if (!id) throw new Error('FAMILY_ID não configurado')
  return id
}

export async function fetchTransactions(opts?: {
  periodFrom?: string
  periodTo?: string
  limit?: number
}): Promise<Transaction[]> {
  const PAGE = 1000
  const maxRows = opts?.limit ?? 10000
  const results: DbTransaction[] = []
  let from = 0

  while (results.length < maxRows) {
    const to = Math.min(from + PAGE - 1, maxRows - 1)
    let q = client()
      .from('transactions')
      .select('*')
      .eq('family_id', familyId())
      .order('competence_date', { ascending: false })
      .range(from, to)

    if (opts?.periodFrom) q = q.gte('competence_date', opts.periodFrom + '-01')
    if (opts?.periodTo) q = q.lte('competence_date', lastDayOf(opts.periodTo))

    const { data, error } = await q
    if (error) throw new Error(`fetchTransactions: ${error.message}`)
    if (!data || data.length === 0) break
    results.push(...(data as DbTransaction[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  return results.map(dbToTransaction)
}

export async function fetchBudgets(month?: string): Promise<Budget[]> {
  let q = client()
    .from('budgets')
    .select('*')
    .eq('family_id', familyId())

  if (month) q = q.eq('month', month)

  const { data, error } = await q
  if (error) throw new Error(`fetchBudgets: ${error.message}`)
  return (data as DbBudget[]).map(dbToBudget)
}

export async function fetchCategories(): Promise<{ macros: MacroCategory[] }> {
  return { macros: MACRO_CATEGORIES }
}

export interface TransactionPatch {
  category_id?: string | null
  sub_category_id?: string | null
  macro_category_id?: string | null
  classification_type?: string
  include_in_operational_result?: boolean
  include_in_budget?: boolean
  notes?: string | null
  manual_category_override?: boolean
  manual_sub_category_override?: boolean
  manual_edited_at?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

export async function updateTransaction(id: string, patch: TransactionPatch): Promise<void> {
  const row: AnyRecord = { ...patch, updated_at: new Date().toISOString() }
  const { error } = await (client().from('transactions') as any)
    .update(row)
    .eq('id', id)
    .eq('family_id', familyId())

  if (error) throw new Error(`updateTransaction ${id}: ${(error as { message: string }).message}`)
}

export async function batchUpdateTransactions(
  items: Array<{ id: string; patch: TransactionPatch }>,
): Promise<void> {
  const now = new Date().toISOString()
  await Promise.all(
    items.map(async ({ id, patch }) => {
      const row: AnyRecord = { ...patch, updated_at: now }
      const { error } = await (client().from('transactions') as any)
        .update(row)
        .eq('id', id)
        .eq('family_id', familyId())
      if (error) throw new Error(`update ${id}: ${(error as { message: string }).message}`)
    }),
  )
}
