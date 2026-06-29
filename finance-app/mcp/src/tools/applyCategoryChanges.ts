import { batchUpdateTransactions } from '../data/supabase.js'
import { getPlan, markPlanApplied } from './suggestCategoryChanges.js'

export async function tool_applyCategoryChanges({
  plan_id,
  confirmed,
}: {
  plan_id: string
  confirmed: boolean
}) {
  if (!confirmed) {
    return {
      applied: false,
      message: 'confirmed=false — nenhuma alteração feita. Chame novamente com confirmed=true para aplicar.',
    }
  }

  const plan = getPlan(plan_id)
  if (!plan) throw new Error(`Plano não encontrado: ${plan_id}. Crie um novo plano com fin_suggest_category_changes.`)
  if (plan.status === 'applied') throw new Error(`Plano ${plan_id} já foi aplicado.`)
  if (plan.status === 'cancelled') throw new Error(`Plano ${plan_id} foi cancelado.`)
  if (plan.transaction_ids.length === 0) return { applied: false, message: 'Nenhum lançamento elegível no plano.' }

  const now = new Date().toISOString()
  await batchUpdateTransactions(
    plan.transaction_ids.map(id => ({
      id,
      patch: {
        macro_category_id: plan.target_macro_category_id,
        manual_category_override: true,
        manual_edited_at: now,
      },
    })),
  )

  markPlanApplied(plan_id)

  return {
    applied: true,
    plan_id,
    affected_count: plan.transaction_ids.length,
    target_category: plan.target_name,
    message: `✓ ${plan.transaction_ids.length} lançamentos reclassificados para "${plan.target_name}".`,
    rollback_note: 'Para desfazer, use fin_apply_category_changes com um novo plano revertendo a categoria.',
  }
}
