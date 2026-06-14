import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES } from '../config/categories'
import { formatBRL } from '../utils/currency'
import { classificationTypeOptions } from '../importers/classifier'
import type { Transaction, ClassificationType } from '../types'

interface Props {
  onNavigate: (route: string) => void
}

type ReviewFilter = 'all' | 'pending' | 'transfer' | 'redemption' | 'investment' | 'debt' | 'neutral' | 'high_value' | 'fatura'

interface ReviewItem {
  tx: Transaction
  reasons: string[]
  filter: ReviewFilter[]
}

function getReviewItems(transactions: Transaction[]): ReviewItem[] {
  const amounts = transactions.filter(t => t.type === 'expense').map(t => t.amount)
  const avg = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0
  const highThreshold = Math.max(avg * 4, 2000)

  const items: ReviewItem[] = []

  for (const tx of transactions) {
    const reasons: string[] = []
    const filter: ReviewFilter[] = []

    if (tx.classificationType === 'transfer') {
      reasons.push('Transferência — confirme se não duplica compra')
      filter.push('transfer')
    }
    if (tx.classificationType === 'redemption') {
      reasons.push('Resgate — não é receita operacional')
      filter.push('redemption')
    }
    if (tx.classificationType === 'investment') {
      reasons.push('Investimento/Aporte — excluído do resultado')
      filter.push('investment')
    }
    if (tx.classificationType === 'debt_cost') {
      reasons.push('Juros/Dívida — custo financeiro')
      filter.push('debt')
    }
    if (tx.classificationType === 'neutral' || tx.classificationType === 'adjustment') {
      reasons.push('Neutro/Ajuste — não entra no resultado')
      filter.push('neutral')
    }
    if (tx.status === 'pending') {
      reasons.push('Pendente — compromisso futuro')
      filter.push('pending')
    }
    if (tx.amount > highThreshold && tx.type === 'expense') {
      reasons.push(`Alto valor (acima de ${formatBRL(highThreshold)})`)
      filter.push('high_value')
    }
    const desc = tx.description.toUpperCase()
    if ((desc.includes('FATURA') || desc.includes('FAT.')) && tx.classificationType !== 'transfer') {
      reasons.push('Possível pagamento de fatura — verifique duplicidade')
      filter.push('fatura')
    }

    if (reasons.length > 0) {
      items.push({ tx, reasons, filter: [...new Set(filter)] })
    }
  }

  return items.sort((a, b) => {
    const priority = (item: ReviewItem) => {
      if (item.filter.includes('debt')) return 0
      if (item.filter.includes('high_value')) return 1
      if (item.filter.includes('fatura')) return 2
      if (item.filter.includes('pending')) return 3
      return 4
    }
    return priority(a) - priority(b)
  })
}

const FILTER_CHIPS: { key: ReviewFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'transfer', label: 'Transferências' },
  { key: 'redemption', label: 'Resgates' },
  { key: 'investment', label: 'Investimentos' },
  { key: 'debt', label: 'Dívidas' },
  { key: 'neutral', label: 'Neutros' },
  { key: 'high_value', label: 'Alto valor' },
  { key: 'fatura', label: 'Fatura' },
]

export function Review({ onNavigate }: Props) {
  const { transactions, isDemo, updateTransaction } = useData()
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPatch, setEditPatch] = useState<Partial<Transaction>>({})

  const allItems = useMemo(() => getReviewItems(transactions), [transactions])

  const items = useMemo(() => {
    if (activeFilter === 'all') return allItems
    return allItems.filter(i => i.filter.includes(activeFilter))
  }, [allItems, activeFilter])

  const counts: Record<ReviewFilter, number> = useMemo(() => {
    const c = {} as Record<ReviewFilter, number>
    c.all = allItems.length
    for (const f of FILTER_CHIPS.slice(1)) {
      c[f.key] = allItems.filter(i => i.filter.includes(f.key)).length
    }
    return c
  }, [allItems])

  function startEdit(tx: Transaction) {
    setEditingId(tx.id)
    setEditPatch({
      classificationType: tx.classificationType,
      macroCategoryId: tx.macroCategoryId,
      includeInOperationalResult: tx.includeInOperationalResult,
      includeInCashflow: tx.includeInCashflow,
      includeInBudget: tx.includeInBudget,
      notes: tx.notes ?? '',
    })
  }

  function saveEdit(id: string) {
    updateTransaction(id, { ...editPatch, adjustmentReason: 'manual_reclassification' })
    setEditingId(null)
  }

  const clsOptions = classificationTypeOptions()
  const macroOptions = MACRO_CATEGORIES

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Revisão</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
              Lançamentos que pedem atenção
            </div>
          </div>
          {allItems.length > 0 && (
            <span className="badge b-warn">
              <span className="dot" />
              {allItems.length} para revisar
            </span>
          )}
        </div>

        {isDemo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent-soft)', borderRadius: 9, padding: '7px 13px', fontSize: 12, color: 'var(--ink)' }}>
            Dados demonstrativos —{' '}
            <button
              style={{ fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', fontSize: 12, fontFamily: 'var(--ui)' }}
              onClick={() => onNavigate('/conectar')}
            >
              importe seu extrato
            </button>
          </div>
        )}

        {/* ── Filter pills ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FILTER_CHIPS.map(f => {
            const count = counts[f.key]
            const active = activeFilter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`filter-pill${active ? ' active' : ''}`}
              >
                {f.label}
                {count > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                    background: active ? 'rgba(255,255,255,.22)' : 'var(--well)',
                    color: active ? '#fff' : 'var(--faint)',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Empty state ── */}
        {items.length === 0 && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-glyph" />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Nenhum lançamento para revisar</h4>
              <p style={{ fontSize: 12.5, color: 'var(--faint)' }}>Tudo em ordem neste filtro.</p>
            </div>
          </div>
        )}

        {/* ── Review cards ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(({ tx, reasons }) => {
            const isEditing = editingId === tx.id
            const macro = MACRO_CATEGORIES.find(m => m.id === tx.macroCategoryId)

            return (
              <div key={tx.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Main row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        {tx.description}
                      </p>
                      {tx.isAdjustment && (
                        <span className="chip chip-neutral">ajustado</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4, fontSize: 11, color: 'var(--faint)' }}>
                      <span className="num">{tx.competenceDate}</span>
                      {tx.accountId && <span>· {tx.accountId.replace('acc_', '')}</span>}
                      {macro && (
                        <span>·&nbsp;
                          <span style={{ fontWeight: 600, color: macro.color }}>{macro.name}</span>
                        </span>
                      )}
                    </div>
                    {/* Editorial notes */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                      {reasons.map((r, i) => (
                        <span key={i} className="review-note">{r}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p className="num" style={{ fontSize: 13.5, fontWeight: 800, color: tx.type === 'income' ? 'var(--pos)' : 'var(--ink)' }}>
                      {tx.type === 'expense' ? '−' : '+'}{formatBRL(tx.amount)}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 3 }}>
                      {tx.status === 'pending' ? 'Pendente' : 'Pago'}
                    </p>
                  </div>
                  <button
                    onClick={() => isEditing ? setEditingId(null) : startEdit(tx)}
                    className="btn-ghost"
                    style={{ width: 28, height: 28, flexShrink: 0 }}
                  >
                    <ChevronDown
                      size={14}
                      color="var(--ink-2)"
                      style={{ transform: isEditing ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    />
                  </button>
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div style={{ borderTop: '1px solid var(--line)', padding: '14px 18px', background: 'var(--well)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Classificação</label>
                        <select
                          value={editPatch.classificationType as string}
                          onChange={e => setEditPatch(p => ({ ...p, classificationType: e.target.value as ClassificationType }))}
                          className="ledger-select"
                          style={{ width: '100%' }}
                        >
                          {clsOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Macro categoria</label>
                        <select
                          value={editPatch.macroCategoryId as string ?? ''}
                          onChange={e => setEditPatch(p => ({ ...p, macroCategoryId: e.target.value }))}
                          className="ledger-select"
                          style={{ width: '100%' }}
                        >
                          {macroOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 18, fontSize: 12, color: 'var(--ink-2)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!editPatch.includeInOperationalResult}
                          onChange={e => setEditPatch(p => ({ ...p, includeInOperationalResult: e.target.checked }))}
                        />
                        Resultado operacional
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!editPatch.includeInCashflow}
                          onChange={e => setEditPatch(p => ({ ...p, includeInCashflow: e.target.checked }))}
                        />
                        Fluxo de caixa
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!editPatch.includeInBudget}
                          onChange={e => setEditPatch(p => ({ ...p, includeInBudget: e.target.checked }))}
                        />
                        Orçamento
                      </label>
                    </div>
                    <div>
                      <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Observação</label>
                      <input
                        value={editPatch.notes as string ?? ''}
                        onChange={e => setEditPatch(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Por que este ajuste?"
                        style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontSize: 12, background: 'var(--card-bg)', color: 'var(--ink)', outline: 'none', fontFamily: 'var(--ui)', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(tx.id)}>Salvar ajuste</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
