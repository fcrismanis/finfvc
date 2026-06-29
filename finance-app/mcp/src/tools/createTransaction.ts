import { createClient } from '@supabase/supabase-js'

function client() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function tool_createTransaction(input: {
  description: string
  amount: number
  type: 'income' | 'expense'
  competence_date: string
  macro_category_id?: string
  classification_type?: string
  status?: string
  notes?: string
  account_id?: string
  payment_method?: string
}) {
  const familyId = process.env.FAMILY_ID!
  const now = new Date().toISOString()
  const id = `manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

  const row = {
    id,
    family_id: familyId,
    description: input.description,
    original_description: input.description,
    amount: Math.abs(input.amount),
    transaction_type: input.type,
    classification_type: input.classification_type ?? (input.type === 'income' ? 'operational_income' : 'operational_expense'),
    transaction_date: input.competence_date,
    competence_date: input.competence_date,
    status: input.status ?? 'paid',
    payment_method: input.payment_method ?? 'pix',
    account_id: input.account_id ?? null,
    macro_category_id: input.macro_category_id ?? null,
    is_recurring: false,
    include_in_operational_result: true,
    include_in_cashflow: true,
    include_in_budget: true,
    is_internal_transfer: false,
    notes: input.notes ?? null,
    manual_category_override: !!input.macro_category_id,
    raw_data: { origin: 'manual_entry' },
    created_at: now,
    updated_at: now,
  }

  const { error } = await client().from('transactions').insert(row)
  if (error) throw new Error(`createTransaction: ${error.message}`)

  return { ok: true, id, description: input.description, amount: input.amount, type: input.type, competence_date: input.competence_date }
}
