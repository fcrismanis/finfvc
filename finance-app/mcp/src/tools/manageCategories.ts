import { createClient } from '@supabase/supabase-js'
import { MACRO_CATEGORIES } from '../config/categories.js'

function client() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function tool_getCategories() {
  const familyId = process.env.FAMILY_ID!

  const { data: subs, error } = await client()
    .from('sub_categories')
    .select('*')
    .eq('family_id', familyId)
    .eq('active', true)
    .order('name')

  if (error) throw new Error(`getCategories: ${error.message}`)

  return {
    macro_categories: MACRO_CATEGORIES.map(m => ({ id: m.id, name: m.name, classification_type: m.classificationType, display_in_budget: m.displayInBudget })),
    sub_categories: (subs ?? []).map((s: Record<string, unknown>) => ({ id: s.id, name: s.name, macro_category_id: s.macro_category_id })),
  }
}

export async function tool_createSubCategory(input: {
  name: string
  macro_category_id: string
  essentiality?: 'essential' | 'non_essential' | 'inherit'
}) {
  const familyId = process.env.FAMILY_ID!
  const id = `sub_${input.macro_category_id}_${input.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now().toString(36)}`

  const { error } = await client().from('sub_categories').insert({
    id,
    family_id: familyId,
    macro_category_id: input.macro_category_id,
    name: input.name,
    essentiality: input.essentiality ?? 'inherit',
    active: true,
  })
  if (error) throw new Error(`createSubCategory: ${error.message}`)

  const macroName = MACRO_CATEGORIES.find(m => m.id === input.macro_category_id)?.name ?? input.macro_category_id
  return { ok: true, id, name: input.name, macro_category_id: input.macro_category_id, macro_name: macroName }
}

export async function tool_markTransactionsNeutral(input: {
  transaction_ids: string[]
  reason?: string
}) {
  if (input.transaction_ids.length === 0) return { ok: true, updated: 0 }
  const familyId = process.env.FAMILY_ID!
  const now = new Date().toISOString()

  const { error, count } = await client()
    .from('transactions')
    .update({
      classification_type: 'neutral',
      include_in_operational_result: false,
      include_in_budget: false,
      is_internal_transfer: true,
      manual_category_override: true,
      manual_edited_at: now,
      updated_at: now,
    })
    .in('id', input.transaction_ids)
    .eq('family_id', familyId)

  if (error) throw new Error(`markNeutral: ${error.message}`)

  return {
    ok: true,
    updated: count ?? input.transaction_ids.length,
    reason: input.reason ?? 'neutralização manual',
    message: `${count ?? input.transaction_ids.length} lançamentos neutralizados.`,
  }
}

export async function tool_deleteTransaction(input: { id: string; confirm: boolean }) {
  if (!input.confirm) return { deleted: false, message: 'Passe confirm=true para confirmar exclusão permanente.' }
  const familyId = process.env.FAMILY_ID!

  const { error } = await client().from('transactions').delete().eq('id', input.id).eq('family_id', familyId)
  if (error) throw new Error(`deleteTransaction: ${error.message}`)

  return { deleted: true, id: input.id, message: `Lançamento ${input.id} excluído permanentemente.` }
}
