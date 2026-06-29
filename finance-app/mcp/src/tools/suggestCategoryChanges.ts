import { fetchTransactions } from '../data/supabase.js'
import { competenceMonth, formatBRL } from '../data/engine.js'
import { MACRO_CATEGORIES } from '../config/categories.js'

export interface SuggestInput {
  period?: string
  period_from?: string
  period_to?: string
  text_contains?: string
  current_macro_category_id?: string
  target_macro_category_id: string
  reason?: string
  skip_manual_overrides?: boolean
}

// In-memory plan store (per process lifetime)
const plans = new Map<string, CategoryChangePlan>()

export interface CategoryChangePlan {
  plan_id: string
  created_at: string
  filter_description: string
  target_macro_category_id: string
  target_name: string
  reason: string
  affected_count: number
  protected_count: number
  sample: { id: string; description: string; amount: number; current_category: string }[]
  transaction_ids: string[]
  status: 'pending' | 'applied' | 'cancelled'
}

export async function tool_suggestCategoryChanges(input: SuggestInput): Promise<CategoryChangePlan & { warning: string }> {
  const targetMacro = MACRO_CATEGORIES.find(m => m.id === input.target_macro_category_id)
  if (!targetMacro) throw new Error(`Categoria não encontrada: ${input.target_macro_category_id}`)

  const txns = await fetchTransactions({
    periodFrom: input.period_from ?? input.period,
    periodTo: input.period_to ?? input.period,
    limit: 5000,
  })

  let candidates = txns.filter(tx => tx.status !== 'cancelled' && tx.includeInOperationalResult)

  if (input.period) candidates = candidates.filter(tx => competenceMonth(tx.competenceDate) === input.period)
  if (input.current_macro_category_id) candidates = candidates.filter(tx => tx.macroCategoryId === input.current_macro_category_id)
  if (input.text_contains) {
    const needle = input.text_contains.toLowerCase()
    candidates = candidates.filter(tx =>
      tx.description.toLowerCase().includes(needle) ||
      tx.originalDescription.toLowerCase().includes(needle),
    )
  }

  // Separate protected (manual override) from eligible
  const protected_ = input.skip_manual_overrides !== false
    ? candidates.filter(tx => tx.manualCategoryOverride)
    : []
  const eligible = candidates.filter(tx => !tx.manualCategoryOverride || input.skip_manual_overrides === false)

  const planId = `plan_${Date.now().toString(36)}`
  const plan: CategoryChangePlan = {
    plan_id: planId,
    created_at: new Date().toISOString(),
    filter_description: buildFilterDescription(input),
    target_macro_category_id: input.target_macro_category_id,
    target_name: targetMacro.name,
    reason: input.reason ?? 'reclassificação manual',
    affected_count: eligible.length,
    protected_count: protected_.length,
    sample: eligible.slice(0, 8).map(tx => ({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      current_category: tx.macroCategoryId
        ? (MACRO_CATEGORIES.find(m => m.id === tx.macroCategoryId)?.name ?? tx.macroCategoryId)
        : 'Sem categoria',
    })),
    transaction_ids: eligible.map(tx => tx.id),
    status: 'pending',
  }

  plans.set(planId, plan)

  return {
    ...plan,
    warning: `⚠️ SOMENTE SUGESTÃO — nenhuma alteração feita. Para aplicar, chame fin_apply_category_changes com plan_id="${planId}" e confirmed=true`,
  }
}

export function getPlan(planId: string): CategoryChangePlan | undefined {
  return plans.get(planId)
}

export function markPlanApplied(planId: string): void {
  const p = plans.get(planId)
  if (p) p.status = 'applied'
}

function buildFilterDescription(input: SuggestInput): string {
  const parts: string[] = []
  if (input.text_contains) parts.push(`descrição contém "${input.text_contains}"`)
  if (input.period) parts.push(`mês ${input.period}`)
  if (input.current_macro_category_id) {
    const n = MACRO_CATEGORIES.find(m => m.id === input.current_macro_category_id)?.name
    parts.push(`categoria atual: ${n ?? input.current_macro_category_id}`)
  }
  return parts.join(', ') || 'todos os lançamentos elegíveis'
}
