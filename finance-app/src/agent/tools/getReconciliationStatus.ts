import { getTransactionsOrMock } from '../../services/transactions.service'
import { diagnoseReconciliation } from '../../services/reconciliation.service'
import { getCompetenceMonth } from '../../utils/date'
import type { AgentToolResult } from '../types'

export interface GetReconciliationStatusInput {
  month: string
  accountId?: string
}

export interface GetReconciliationStatusOutput {
  month: string
  neutralCandidates: number
  cardPayments: number
  ownTransfers: number
  mirroredPairs: number
  needsReviewCount: number
  pendingExpenses: number
  totalNeutralized: number
}

export function getReconciliationStatus(input: GetReconciliationStatusInput): AgentToolResult<GetReconciliationStatusOutput> {
  const alerts: string[] = []
  try {
    const { transactions } = getTransactionsOrMock()
    const monthTxns = transactions.filter(tx =>
      getCompetenceMonth(tx.competenceDate) === input.month &&
      tx.status !== 'cancelled' &&
      (!input.accountId || tx.accountId === input.accountId),
    )

    const result = diagnoseReconciliation(monthTxns)
    const needsReviewCount = monthTxns.filter(tx => tx.needsReview).length
    const pendingExpenses = monthTxns.filter(tx => tx.type === 'expense' && tx.status === 'pending').length

    if (result.candidateIds.size > 0) alerts.push(`${result.candidateIds.size} movimentos internos não neutralizados`)
    if (needsReviewCount > 0) alerts.push(`${needsReviewCount} lançamentos pendentes de revisão`)
    if (pendingExpenses > 0) alerts.push(`${pendingExpenses} despesas ainda pendentes`)

    return {
      tool: 'fin.getReconciliationStatus',
      ok: true,
      data: {
        month: input.month,
        neutralCandidates: result.candidateIds.size,
        cardPayments: result.cardPayments.length,
        ownTransfers: result.ownTransfers.length,
        mirroredPairs: result.mirroredPairs.length,
        needsReviewCount,
        pendingExpenses,
        totalNeutralized: result.neutralTotal,
      },
      alerts,
    }
  } catch (err) {
    return { tool: 'fin.getReconciliationStatus', ok: false, error: String(err), alerts }
  }
}
