import { createClient } from '@supabase/supabase-js'
import { fetchBudgets } from '../data/supabase.js'
import { formatBRL } from '../data/engine.js'
import { MACRO_CATEGORIES } from '../config/categories.js'

function client() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function tool_getBudgets({ month }: { month: string }) {
  const budgets = await fetchBudgets(month)
  const macroMap = new Map(MACRO_CATEGORIES.map(m => [m.id, m.name]))

  return {
    month,
    budgets: budgets.map(b => ({
      id: b.id,
      macro_category_id: b.macroCategoryId,
      name: b.macroCategoryId ? (macroMap.get(b.macroCategoryId) ?? b.macroCategoryId) : 'Geral',
      planned_amount: b.plannedAmount,
      planned_fmt: formatBRL(b.plannedAmount),
    })),
    total: formatBRL(budgets.reduce((s, b) => s + b.plannedAmount, 0)),
  }
}

export async function tool_setBudget(input: {
  month: string
  macro_category_id: string
  amount: number
}) {
  const familyId = process.env.FAMILY_ID!
  const existing = await fetchBudgets(input.month)
  const current = existing.find(b => b.macroCategoryId === input.macro_category_id)

  if (current) {
    const { error } = await client().from('budgets').update({ amount: input.amount, updated_at: new Date().toISOString() }).eq('id', current.id)
    if (error) throw new Error(`setBudget update: ${error.message}`)
    return { ok: true, action: 'updated', id: current.id, month: input.month, macro_category_id: input.macro_category_id, amount: input.amount, amount_fmt: formatBRL(input.amount) }
  }

  const id = `bud_${input.month}_${input.macro_category_id}_${Date.now()}`
  const { error } = await client().from('budgets').insert({
    id,
    family_id: familyId,
    macro_category_id: input.macro_category_id,
    month: input.month,
    amount: input.amount,
  })
  if (error) throw new Error(`setBudget insert: ${error.message}`)

  return { ok: true, action: 'created', id, month: input.month, macro_category_id: input.macro_category_id, amount: input.amount, amount_fmt: formatBRL(input.amount) }
}

export async function tool_copyBudget(input: { from_month: string; to_month: string }) {
  const familyId = process.env.FAMILY_ID!
  const source = await fetchBudgets(input.from_month)
  if (source.length === 0) throw new Error(`Nenhum orçamento em ${input.from_month}`)

  const rows = source.map(b => ({
    id: `bud_${input.to_month}_${b.macroCategoryId ?? b.id}_${Date.now()}`,
    family_id: familyId,
    macro_category_id: b.macroCategoryId ?? null,
    category_id: b.categoryId ?? null,
    month: input.to_month,
    amount: b.plannedAmount,
  }))

  // Delete existing budgets for target month first
  await client().from('budgets').delete().eq('family_id', familyId).eq('month', input.to_month)
  const { error } = await client().from('budgets').insert(rows)
  if (error) throw new Error(`copyBudget: ${error.message}`)

  return { ok: true, from: input.from_month, to: input.to_month, copied: rows.length }
}
