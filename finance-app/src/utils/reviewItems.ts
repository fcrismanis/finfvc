import type { Transaction } from '../types'
import { formatBRL } from './currency'

export type ReviewReason = 'needs_review' | 'no_category' | 'pending' | 'transfer' | 'high_value' | 'pluggy_import'

export interface ReviewItem {
  tx: Transaction
  reasons: string[]
  tags: ReviewReason[]
}

export function getReviewItems(transactions: Transaction[]): ReviewItem[] {
  const amounts = transactions.filter(t => t.type === 'expense').map(t => t.amount)
  const avg = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0
  const highThreshold = Math.max(avg * 4, 2000)
  const items: ReviewItem[] = []

  for (const tx of transactions) {
    const reasons: string[] = []
    const tags = new Set<ReviewReason>()

    if ((tx.source === 'pluggy' || tx.needsReview) && tx.needsReview !== false) { reasons.push('Importada via Pluggy — revisar categoria'); tags.add('pluggy_import') }
    if (tx.classificationType === 'transfer')   { reasons.push('Transferência — confirme se não duplica compra'); tags.add('transfer') }
    if (tx.classificationType === 'redemption') { reasons.push('Resgate — não é receita operacional'); tags.add('needs_review') }
    if (tx.classificationType === 'investment') { reasons.push('Investimento/Aporte — excluído do resultado'); tags.add('needs_review') }
    if (tx.classificationType === 'debt_cost')  { reasons.push('Juros/Dívida — custo financeiro'); tags.add('needs_review') }
    if (tx.classificationType === 'neutral' || tx.classificationType === 'adjustment') {
      reasons.push('Neutro/Ajuste — não entra no resultado'); tags.add('needs_review')
    }
    if (tx.status === 'pending') { reasons.push('Pendente — compromisso futuro'); tags.add('pending') }
    if (!tx.macroCategoryId)    { reasons.push('Sem categoria definida'); tags.add('no_category') }
    if (tx.amount > highThreshold && tx.type === 'expense') {
      reasons.push(`Alto valor (acima de ${formatBRL(highThreshold)})`); tags.add('high_value')
    }
    const desc = tx.description.toUpperCase()
    if ((desc.includes('FATURA') || desc.includes('FAT.')) && tx.classificationType !== 'transfer') {
      reasons.push('Possível pagamento de fatura — verifique duplicidade'); tags.add('needs_review')
    }

    if (reasons.length > 0) items.push({ tx, reasons, tags: [...tags] })
  }

  return items.sort((a, b) => {
    const pri = (i: ReviewItem) => {
      if (i.tags.includes('high_value')) return 0
      if (i.tags.includes('needs_review')) return 1
      if (i.tags.includes('no_category')) return 2
      if (i.tags.includes('pending')) return 3
      return 4
    }
    return pri(a) - pri(b)
  })
}
