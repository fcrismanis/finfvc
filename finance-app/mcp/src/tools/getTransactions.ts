import { fetchTransactions } from '../data/supabase.js'
import { competenceMonth, totalIncome, totalExpenses, formatBRL } from '../data/engine.js'

export interface GetTransactionsInput {
  period?: string
  period_from?: string
  period_to?: string
  account_id?: string
  macro_category_id?: string
  type?: 'income' | 'expense' | 'any'
  status?: 'paid' | 'pending' | 'cancelled' | 'any'
  text?: string
  needs_review?: boolean
  limit?: number
}

export async function tool_getTransactions(input: GetTransactionsInput) {
  const limit = input.limit ?? 500
  const all = await fetchTransactions({
    periodFrom: input.period_from ?? input.period,
    periodTo: input.period_to ?? input.period,
    limit: Math.min(limit, 2000),
  })

  let filtered = all.filter(tx => tx.status !== 'cancelled')

  if (input.period) filtered = filtered.filter(tx => competenceMonth(tx.competenceDate) === input.period)
  if (input.macro_category_id) filtered = filtered.filter(tx => tx.macroCategoryId === input.macro_category_id)
  if (input.account_id) filtered = filtered.filter(tx => tx.accountId === input.account_id)
  if (input.type && input.type !== 'any') filtered = filtered.filter(tx => tx.type === input.type)
  if (input.status && input.status !== 'any') filtered = filtered.filter(tx => tx.status === input.status)
  if (input.text) {
    const needle = input.text.toLowerCase()
    filtered = filtered.filter(tx =>
      tx.description.toLowerCase().includes(needle) ||
      tx.originalDescription.toLowerCase().includes(needle),
    )
  }
  if (input.needs_review === true) filtered = filtered.filter(tx => tx.needsReview)

  const inc = totalIncome(filtered, input.period ?? '')
  const exp = totalExpenses(filtered, input.period ?? '')
  const needsReview = filtered.filter(tx => tx.needsReview).length
  const uncategorized = filtered.filter(tx => !tx.macroCategoryId).length

  const rows = filtered.slice(0, limit).map(tx => ({
    id: tx.id,
    description: tx.description,
    amount: tx.amount,
    type: tx.type,
    competence_date: tx.competenceDate,
    status: tx.status,
    macro_category_id: tx.macroCategoryId ?? null,
    category_id: tx.categoryId ?? null,
    needs_review: tx.needsReview ?? false,
    manual_override: tx.manualCategoryOverride ?? false,
    institution: tx.pluggyInstitutionName ?? null,
  }))

  const alerts: string[] = []
  if (needsReview > 0) alerts.push(`${needsReview} lançamentos precisam de revisão`)
  if (uncategorized > 0) alerts.push(`${uncategorized} lançamentos sem categoria`)
  if (filtered.length > limit) alerts.push(`Resultados limitados a ${limit} de ${filtered.length}`)

  return {
    count: filtered.length,
    total_income: inc,
    total_income_fmt: formatBRL(inc),
    total_expenses: exp,
    total_expenses_fmt: formatBRL(exp),
    result: inc - exp,
    result_fmt: formatBRL(inc - exp),
    needs_review_count: needsReview,
    uncategorized_count: uncategorized,
    alerts,
    transactions: rows,
  }
}
