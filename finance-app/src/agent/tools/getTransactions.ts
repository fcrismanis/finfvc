import type { Transaction } from '../../types'
import { getTransactionsOrMock } from '../../services/transactions.service'
import { getCompetenceMonth } from '../../utils/date'
import type { AgentToolResult } from '../types'

export interface GetTransactionsInput {
  period?: string
  periodFrom?: string
  periodTo?: string
  accountId?: string
  categoryId?: string
  macroCategoryId?: string
  type?: 'income' | 'expense' | 'any'
  status?: 'paid' | 'pending' | 'cancelled' | 'any'
  text?: string
  needsReview?: boolean
  limit?: number
}

export interface GetTransactionsOutput {
  transactions: Pick<Transaction, 'id' | 'description' | 'amount' | 'type' | 'competenceDate' | 'categoryId' | 'macroCategoryId' | 'status' | 'needsReview'>[]
  totalIncome: number
  totalExpense: number
  count: number
  needsReviewCount: number
  uncategorizedCount: number
}

export function getTransactions(input: GetTransactionsInput): AgentToolResult<GetTransactionsOutput> {
  const alerts: string[] = []
  try {
    const { transactions: all } = getTransactionsOrMock()

    let filtered = all.filter(tx => tx.status !== 'cancelled')

    if (input.period) {
      filtered = filtered.filter(tx => getCompetenceMonth(tx.competenceDate) === input.period)
    }
    if (input.periodFrom || input.periodTo) {
      filtered = filtered.filter(tx => {
        const m = getCompetenceMonth(tx.competenceDate)
        if (input.periodFrom && m < input.periodFrom) return false
        if (input.periodTo && m > input.periodTo) return false
        return true
      })
    }

    if (input.accountId) filtered = filtered.filter(tx => tx.accountId === input.accountId)
    if (input.categoryId) filtered = filtered.filter(tx => tx.categoryId === input.categoryId)
    if (input.macroCategoryId) filtered = filtered.filter(tx => tx.macroCategoryId === input.macroCategoryId)
    if (input.type && input.type !== 'any') filtered = filtered.filter(tx => tx.type === input.type)
    if (input.status && input.status !== 'any') filtered = filtered.filter(tx => tx.status === input.status)
    if (input.text) {
      const needle = input.text.toLowerCase()
      filtered = filtered.filter(tx =>
        tx.description.toLowerCase().includes(needle) ||
        (tx.originalDescription ?? '').toLowerCase().includes(needle),
      )
    }
    if (input.needsReview === true) filtered = filtered.filter(tx => tx.needsReview)

    const totalIncome = filtered.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0)
    const totalExpense = filtered.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0)
    const needsReviewCount = filtered.filter(tx => tx.needsReview).length
    const uncategorizedCount = filtered.filter(tx => !tx.categoryId && !tx.macroCategoryId).length

    if (needsReviewCount > 0) alerts.push(`${needsReviewCount} lançamentos precisam de revisão`)
    if (uncategorizedCount > 0) alerts.push(`${uncategorizedCount} lançamentos sem categoria`)

    const limit = input.limit ?? 200
    if (filtered.length > limit) alerts.push(`Limitado a ${limit} de ${filtered.length} registros`)

    const transactions = filtered.slice(0, limit).map(tx => ({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      competenceDate: tx.competenceDate,
      categoryId: tx.categoryId,
      macroCategoryId: tx.macroCategoryId,
      status: tx.status,
      needsReview: tx.needsReview,
    }))

    return {
      tool: 'fin.getTransactions',
      ok: true,
      data: { transactions, totalIncome, totalExpense, count: filtered.length, needsReviewCount, uncategorizedCount },
      alerts,
    }
  } catch (err) {
    return { tool: 'fin.getTransactions', ok: false, error: String(err), alerts }
  }
}
