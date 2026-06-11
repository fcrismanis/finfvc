import { useState, useMemo } from 'react'
import { AlertTriangle, CheckCircle, ChevronDown, ClipboardCheck } from 'lucide-react'
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
    <main className="flex-1 overflow-y-auto p-5" style={{ background: 'var(--bg-page)' }}>
      <div className="max-w-[900px] mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <ClipboardCheck size={18} color="#D97706" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Revisão financeira</h1>
            <p className="text-xs text-gray-400">Lançamentos que precisam de atenção</p>
          </div>
          <span className="ml-auto text-sm font-semibold text-gray-500">{allItems.length} para revisar</span>
        </div>

        {isDemo && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
            Dados demonstrativos — <button className="underline ml-1 font-medium" onClick={() => onNavigate('/conectar')}>importe seu extrato</button>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_CHIPS.map(f => {
            const count = counts[f.key]
            const active = activeFilter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: active ? 'var(--sidebar-active)' : 'white',
                  color: active ? 'white' : '#6B7280',
                  border: active ? '1px solid transparent' : '1px solid var(--border-card)',
                  boxShadow: active ? 'none' : 'var(--shadow-card)',
                }}
              >
                {f.label}
                {count > 0 && (
                  <span
                    className="text-[9px] font-bold px-1 py-px rounded-full"
                    style={{
                      background: active ? 'rgba(255,255,255,0.25)' : '#F3F4F6',
                      color: active ? 'white' : '#6B7280',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {items.length === 0 && (
          <div className="card p-10 flex flex-col items-center gap-3">
            <CheckCircle size={32} color="#16A34A" />
            <p className="text-sm text-gray-600 font-medium">Nenhum lançamento para revisar</p>
            <p className="text-xs text-gray-400">Tudo em ordem neste filtro</p>
          </div>
        )}

        {/* Review cards */}
        <div className="space-y-2">
          {items.map(({ tx, reasons }) => {
            const isEditing = editingId === tx.id
            const macro = MACRO_CATEGORIES.find(m => m.id === tx.macroCategoryId)

            return (
              <div key={tx.id} className="card overflow-hidden">
                {/* Main row */}
                <div className="flex items-start gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{tx.description}</p>
                      {tx.isAdjustment && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-500 font-semibold">
                          ajustado
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-gray-400">
                      <span className="num">{tx.competenceDate}</span>
                      {tx.accountId && <span>· {tx.accountId.replace('acc_', '')}</span>}
                      {macro && (
                        <span>·
                          <span className="ml-1 font-medium" style={{ color: macro.color }}>{macro.name}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {reasons.map((r, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium"
                        >
                          <AlertTriangle size={8} /> {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold num" style={{ color: tx.type === 'income' ? '#059669' : '#DC2626' }}>
                      {tx.type === 'expense' ? '−' : '+'}{formatBRL(tx.amount)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {tx.status === 'pending' ? 'Pendente' : 'Pago'}
                    </p>
                  </div>
                  <button
                    onClick={() => isEditing ? setEditingId(null) : startEdit(tx)}
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <ChevronDown
                      size={15}
                      style={{ transform: isEditing ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    />
                  </button>
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div
                    className="border-t p-4 space-y-3"
                    style={{ background: '#F8FAFC', borderColor: 'var(--border-card)' }}
                  >
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-gray-500 mb-1.5 font-semibold text-[11px] uppercase tracking-wide">
                          Classificação
                        </label>
                        <select
                          value={editPatch.classificationType as string}
                          onChange={e => setEditPatch(p => ({ ...p, classificationType: e.target.value as ClassificationType }))}
                          className="w-full rounded-lg px-2.5 py-2 bg-white focus:outline-none text-xs"
                          style={{ border: '1px solid var(--border-card)' }}
                        >
                          {clsOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1.5 font-semibold text-[11px] uppercase tracking-wide">
                          Macro categoria
                        </label>
                        <select
                          value={editPatch.macroCategoryId as string ?? ''}
                          onChange={e => setEditPatch(p => ({ ...p, macroCategoryId: e.target.value }))}
                          className="w-full rounded-lg px-2.5 py-2 bg-white focus:outline-none text-xs"
                          style={{ border: '1px solid var(--border-card)' }}
                        >
                          {macroOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-5 text-xs text-gray-600">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!editPatch.includeInOperationalResult}
                          onChange={e => setEditPatch(p => ({ ...p, includeInOperationalResult: e.target.checked }))}
                          className="rounded"
                        />
                        Resultado operacional
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!editPatch.includeInCashflow}
                          onChange={e => setEditPatch(p => ({ ...p, includeInCashflow: e.target.checked }))}
                          className="rounded"
                        />
                        Fluxo de caixa
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!editPatch.includeInBudget}
                          onChange={e => setEditPatch(p => ({ ...p, includeInBudget: e.target.checked }))}
                          className="rounded"
                        />
                        Orçamento
                      </label>
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1.5 font-semibold text-[11px] uppercase tracking-wide">
                        Observação
                      </label>
                      <input
                        value={editPatch.notes as string ?? ''}
                        onChange={e => setEditPatch(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Por que este ajuste?"
                        className="w-full rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none"
                        style={{ border: '1px solid var(--border-card)' }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(tx.id)}
                        className="px-4 py-2 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                        style={{ background: 'var(--sidebar-active)' }}
                      >
                        Salvar ajuste
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 text-xs text-gray-600 rounded-lg hover:bg-white transition-colors"
                        style={{ border: '1px solid var(--border-card)' }}
                      >
                        Cancelar
                      </button>
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
