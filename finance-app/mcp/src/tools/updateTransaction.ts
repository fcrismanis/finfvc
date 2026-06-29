import { updateTransaction } from '../data/supabase.js'

export async function tool_updateTransaction(input: {
  id: string
  macro_category_id?: string
  category_id?: string
  sub_category_id?: string
  classification_type?: string
  description?: string
  notes?: string
  status?: string
  include_in_operational_result?: boolean
  include_in_budget?: boolean
  needs_review?: boolean
  tags?: string[]
}) {
  const { id, ...fields } = input

  const patch: Record<string, unknown> = {}
  const now = new Date().toISOString()

  if (fields.macro_category_id !== undefined) patch.macro_category_id = fields.macro_category_id
  if (fields.category_id !== undefined) patch.category_id = fields.category_id
  if (fields.sub_category_id !== undefined) patch.sub_category_id = fields.sub_category_id
  if (fields.classification_type !== undefined) patch.classification_type = fields.classification_type
  if (fields.description !== undefined) patch.description = fields.description
  if (fields.notes !== undefined) patch.notes = fields.notes
  if (fields.status !== undefined) patch.status = fields.status
  if (fields.include_in_operational_result !== undefined) patch.include_in_operational_result = fields.include_in_operational_result
  if (fields.include_in_budget !== undefined) patch.include_in_budget = fields.include_in_budget
  if (fields.needs_review !== undefined) {
    patch.raw_data = { needsReview: fields.needs_review }
  }

  // Mark as manual override when category changed
  if (fields.macro_category_id || fields.category_id) {
    patch.manual_category_override = true
    patch.manual_edited_at = now
  }

  await updateTransaction(id, patch as Parameters<typeof updateTransaction>[1])

  return {
    ok: true,
    id,
    updated_fields: Object.keys(patch),
    message: `Lançamento ${id} atualizado.`,
  }
}
