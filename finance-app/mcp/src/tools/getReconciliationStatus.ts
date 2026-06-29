import { fetchTransactions } from '../data/supabase.js'
import { competenceMonth } from '../data/engine.js'

const CARD_RE = /pagamento\s*(de)?\s*(fatura|cart[aã]o)|fatura\s*cart[aã]o|pag\s*cart[aã]o/i
const OWN_TRANSFER_RE = /transfer[eê]ncia entre contas|mesma titularidade/i
const OWN_PIX_RE = /transfer\s*-\s*pix/i

export async function tool_getReconciliationStatus({ month, account_id }: { month: string; account_id?: string }) {
  const txns = await fetchTransactions({ periodFrom: month, periodTo: month })

  const monthTxns = txns.filter(tx =>
    competenceMonth(tx.competenceDate) === month &&
    tx.status !== 'cancelled' &&
    (!account_id || tx.accountId === account_id),
  )

  const cardPayments = monthTxns.filter(tx =>
    tx.pluggyCategoryId === '05040000' || CARD_RE.test(`${tx.description} ${tx.originalDescription}`),
  )
  const ownTransfers = monthTxns.filter(tx =>
    tx.isInternalTransfer || OWN_TRANSFER_RE.test(`${tx.description}`),
  )
  const ownPix = monthTxns.filter(tx =>
    tx.pluggyCategoryId === '05070000' || OWN_PIX_RE.test(tx.description),
  )

  // Already neutral
  const alreadyNeutral = monthTxns.filter(tx => tx.classificationType === 'neutral')

  // Candidates: not manual, not already neutral
  const candidates = [...cardPayments, ...ownTransfers, ...ownPix].filter(tx =>
    !tx.manualCategoryOverride && tx.classificationType !== 'neutral',
  )
  const candidateIds = new Set(candidates.map(tx => tx.id))

  const needsReview = monthTxns.filter(tx => tx.needsReview)
  const pendingExpenses = monthTxns.filter(tx => tx.type === 'expense' && tx.status === 'pending')
  const uncategorized = monthTxns.filter(tx => !tx.macroCategoryId && tx.includeInOperationalResult)

  return {
    month,
    account_id: account_id ?? 'todas',
    total_transactions: monthTxns.length,
    neutral_candidates: candidateIds.size,
    card_payments_detected: cardPayments.length,
    own_transfers_detected: ownTransfers.length,
    own_pix_detected: ownPix.length,
    already_neutral: alreadyNeutral.length,
    needs_review: needsReview.length,
    needs_review_list: needsReview.slice(0, 10).map(tx => ({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      date: tx.competenceDate,
    })),
    pending_expenses: pendingExpenses.length,
    uncategorized: uncategorized.length,
    alerts: [
      ...(candidateIds.size > 0 ? [`${candidateIds.size} movimentos internos não neutralizados`] : []),
      ...(needsReview.length > 0 ? [`${needsReview.length} lançamentos pendentes de revisão`] : []),
      ...(pendingExpenses.length > 0 ? [`${pendingExpenses.length} despesas ainda pendentes`] : []),
      ...(uncategorized.length > 0 ? [`${uncategorized.length} lançamentos sem categoria`] : []),
    ],
  }
}
