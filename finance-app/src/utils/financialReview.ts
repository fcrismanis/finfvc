import type { Transaction } from '../types'
import { findDuplicateCandidateIds } from './dataQuality'
import { getLast6Months, getCompetenceMonth } from './date'
import { formatBRL } from './currency'

export type FinancialReviewType =
  | 'uncategorized'
  | 'missing_subcategory'
  | 'low_confidence'
  | 'possible_duplicate'
  | 'possible_wrong_neutral'
  | 'new_recurring'
  | 'above_average'
  | 'unexpected_income'
  | 'card_payment_check'
  | 'financial_cost'

export interface FinancialReviewItem {
  id: string
  transactionId?: string
  type: FinancialReviewType
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  suggestedAction: string
  amount?: number
  date?: string
}

const GENERIC_DESC_RE = /^(PIX|TED|DOC|TRANSF(ERENCIA)?|DEP(OSITO)?|PAGAMENTO|PGTO|BOLETO|LAN[CÇ]AMENTO|DEBITO|CREDITO|OUTROS?)$/i

function normalizeDescKey(desc: string): string {
  return desc
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\d+/g, '')
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function avgAmountByMacro(txns: Transaction[], macroId: string, refMonth: string): number {
  const months = getLast6Months(refMonth).slice(0, 3)
  const totals = months
    .map(m =>
      txns
        .filter(
          t =>
            getCompetenceMonth(t.competenceDate) === m &&
            t.macroCategoryId === macroId &&
            t.includeInOperationalResult &&
            t.type === 'expense' &&
            t.status !== 'cancelled',
        )
        .reduce((s, t) => s + t.amount, 0),
    )
    .filter(v => v > 0)
  return totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
}

export function generateFinancialReviewItems(
  allTransactions: Transaction[],
  month: string,
): FinancialReviewItem[] {
  const items: FinancialReviewItem[] = []
  const monthTxns = allTransactions.filter(
    t => getCompetenceMonth(t.competenceDate) === month && t.status !== 'cancelled',
  )
  const duplicateIds = findDuplicateCandidateIds(monthTxns)
  const prevMonths = getLast6Months(month).slice(0, 5)

  for (const tx of monthTxns) {
    // 1. Uncategorized
    if (!tx.macroCategoryId) {
      items.push({
        id: `rev_uncat_${tx.id}`,
        transactionId: tx.id,
        type: 'uncategorized',
        severity: 'high',
        title: 'Sem categoria',
        description: `${tx.description} · ${formatBRL(tx.amount)}`,
        suggestedAction: 'Classifique na tela de Revisão ou Lançamentos',
        amount: tx.amount,
        date: tx.competenceDate,
      })
      continue
    }

    const manuallyReviewed = !!(tx.manualCategoryOverride || tx.manualEditedAt)

    // 2. Missing subcategory (expenses that count in budget)
    if (!tx.subCategoryId && tx.type === 'expense' && tx.includeInOperationalResult && tx.amount > 50) {
      items.push({
        id: `rev_nosub_${tx.id}`,
        transactionId: tx.id,
        type: 'missing_subcategory',
        severity: 'low',
        title: 'Sem subcategoria',
        description: `${tx.description} · ${tx.macroCategoryId}`,
        suggestedAction: 'Adicione subcategoria para detalhar o gasto',
        amount: tx.amount,
        date: tx.competenceDate,
      })
    }

    // 3. Low confidence
    if (tx.categoryConfidence === 'low' && !tx.manualCategoryOverride) {
      items.push({
        id: `rev_lowconf_${tx.id}`,
        transactionId: tx.id,
        type: 'low_confidence',
        severity: 'medium',
        title: 'Baixa confiança na categoria',
        description: `${tx.description} — classificação automática pode estar errada`,
        suggestedAction: 'Confirme ou corrija a categoria na tela de Revisão',
        amount: tx.amount,
        date: tx.competenceDate,
      })
    }

    // 4. Possible duplicate
    if (duplicateIds.has(tx.id)) {
      items.push({
        id: `rev_dupe_${tx.id}`,
        transactionId: tx.id,
        type: 'possible_duplicate',
        severity: 'high',
        title: 'Possível duplicidade',
        description: `${tx.description} · ${formatBRL(tx.amount)} · ${tx.transactionDate}`,
        suggestedAction: 'Verifique se há outra versão deste lançamento e cancele a duplicata',
        amount: tx.amount,
        date: tx.competenceDate,
      })
    }

    // 5. Possible wrong neutral
    if (!manuallyReviewed && tx.classificationType === 'neutral' && tx.amount > 500 && !tx.isInternalTransfer) {
      const desc = (tx.description || '').toUpperCase()
      const looksTransfer =
        desc.includes('TRANSF') ||
        desc.includes('TED') ||
        desc.includes('PIX') ||
        desc.includes('FATURA') ||
        desc.includes('FAT.') ||
        desc.includes('INVEST') ||
        desc.includes('APORTE') ||
        desc.includes('RESGATE')
      if (!looksTransfer) {
        items.push({
          id: `rev_neutral_${tx.id}`,
          transactionId: tx.id,
          type: 'possible_wrong_neutral',
          severity: 'medium',
          title: 'Neutro suspeito',
          description: `${tx.description} · ${formatBRL(tx.amount)} — pode não ser movimentação interna`,
          suggestedAction: 'Verifique se deveria ser despesa ou receita operacional',
          amount: tx.amount,
          date: tx.competenceDate,
        })
      }
    }

    // 6. Above average for macro category
    if (!manuallyReviewed && tx.type === 'expense' && tx.includeInOperationalResult && tx.macroCategoryId && tx.amount > 100) {
      const avg = avgAmountByMacro(allTransactions, tx.macroCategoryId, month)
      if (avg > 0 && tx.amount > avg * 2.5) {
        items.push({
          id: `rev_abvavg_${tx.id}`,
          transactionId: tx.id,
          type: 'above_average',
          severity: 'medium',
          title: 'Gasto acima do padrão',
          description: `${tx.description} · ${formatBRL(tx.amount)} (média da categoria: ${formatBRL(avg)})`,
          suggestedAction: 'Verifique se é gasto atípico ou erro de categorização',
          amount: tx.amount,
          date: tx.competenceDate,
        })
      }
    }

    // 7. Card payment check
    if (!manuallyReviewed && tx.type === 'expense' && tx.classificationType !== 'transfer' && tx.classificationType !== 'neutral' && tx.amount > 100) {
      const desc = (tx.description || '').toUpperCase()
      if (
        (desc.includes('FATURA') || desc.match(/\bFAT\.?\b/) || desc.includes('PGTO FAT') || desc.includes('PAGTO FAT') || desc.includes('PAG FAT')) &&
        tx.amount > 100
      ) {
        items.push({
          id: `rev_card_${tx.id}`,
          transactionId: tx.id,
          type: 'card_payment_check',
          severity: 'high',
          title: 'Pagamento de fatura de cartão',
          description: `${tx.description} · ${formatBRL(tx.amount)} — pode estar duplicando compras já lançadas`,
          suggestedAction: 'Marque como Movimentação Financeira (neutro) se as compras já estão lançadas individualmente',
          amount: tx.amount,
          date: tx.competenceDate,
        })
      }
    }

    // 8. Financial cost
    if (!manuallyReviewed && tx.classificationType === 'debt_cost') {
      items.push({
        id: `rev_debt_${tx.id}`,
        transactionId: tx.id,
        type: 'financial_cost',
        severity: 'high',
        title: 'Custo financeiro',
        description: `${tx.description} · ${formatBRL(tx.amount)} — juros, IOF, tarifa ou dívida`,
        suggestedAction: 'Registre nos aprendizados do Fechamento e planeje eliminar este custo',
        amount: tx.amount,
        date: tx.competenceDate,
      })
    }
  }

  // 9. Unexpected income (not seen in last 5 months)
  const monthIncomeTxns = monthTxns.filter(
    t => t.type === 'income' && t.includeInOperationalResult && t.amount > 500,
  )
  for (const tx of monthIncomeTxns) {
    const normKey = normalizeDescKey(tx.description)
    const seenBefore = prevMonths.some(m =>
      allTransactions.some(
        t =>
          getCompetenceMonth(t.competenceDate) === m &&
          t.type === 'income' &&
          normalizeDescKey(t.description) === normKey,
      ),
    )
    if (!seenBefore) {
      items.push({
        id: `rev_income_${tx.id}`,
        transactionId: tx.id,
        type: 'unexpected_income',
        severity: 'low',
        title: 'Receita não recorrente detectada',
        description: `${tx.description} · ${formatBRL(tx.amount)} — não apareceu nos últimos 5 meses`,
        suggestedAction: 'Classifique como Receita Eventual se for extra-ordinária (não incluirá na média)',
        amount: tx.amount,
        date: tx.competenceDate,
      })
    }
  }

  // 10. Generic description
  for (const tx of monthTxns) {
    if (tx.type === 'expense' && tx.includeInOperationalResult && tx.amount > 100) {
      const desc = normalizeDescKey(tx.description)
      if (GENERIC_DESC_RE.test(desc)) {
        items.push({
          id: `rev_generic_${tx.id}`,
          transactionId: tx.id,
          type: 'uncategorized',
          severity: 'low',
          title: 'Descrição genérica',
          description: `"${tx.description}" · ${formatBRL(tx.amount)} — dificulta categorização futura`,
          suggestedAction: 'Edite a descrição com o nome do estabelecimento ou finalidade',
          amount: tx.amount,
          date: tx.competenceDate,
        })
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>()
  const deduped = items.filter(i => {
    if (seen.has(i.id)) return false
    seen.add(i.id)
    return true
  })

  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  return deduped.sort((a, b) => {
    const s = severityOrder[a.severity] - severityOrder[b.severity]
    if (s !== 0) return s
    return (b.amount ?? 0) - (a.amount ?? 0)
  })
}

export function countBySeverity(items: FinancialReviewItem[]): { high: number; medium: number; low: number } {
  return {
    high: items.filter(i => i.severity === 'high').length,
    medium: items.filter(i => i.severity === 'medium').length,
    low: items.filter(i => i.severity === 'low').length,
  }
}

export function countByType(items: FinancialReviewItem[]): Partial<Record<FinancialReviewType, number>> {
  const counts: Partial<Record<FinancialReviewType, number>> = {}
  for (const item of items) {
    counts[item.type] = (counts[item.type] ?? 0) + 1
  }
  return counts
}
