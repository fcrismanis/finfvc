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
    // debt and high_value first
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
    <main className="flex-1 overflow-y-auto bg-gray-50 p-5">
      <div className="max-w-[900px] mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-50">
            <ClipboardCheck size={20} color="#D97706" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Revisão financeira</h1>
            <p className="text-xs text-gray-500">Lançamentos que precisam de atenção</p>
          </div>
          <span className="ml-auto text-sm text-gray-500">{allItems.length} para revisar</span>
        </div>

        {isDemo && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
            Dados demonstrativos — <button className="underline ml-1" onClick={() => onNavigate('/conectar')}>importe seu extrato</button>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {FILTER_CHIPS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background: activeFilter === f.key ? '#4F46E5' : '#F3F4F6',
                color: activeFilter === f.key ? 'white' : '#6B7280',
              }}
            >
              {f.label} {counts[f.key] > 0 && <span className="ml-1 opacity-75">({counts[f.key]})</span>}
            </button>
          ))}
        </div>

        {items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center gap-3">
            <CheckCircle size={32} color="#16A34A" />
            <p className="text-sm text-gray-600">Nenhum lançamento para revisar neste filtro.</p>
          </div>
        )}

        {/* Review cards */}
        <div className="space-y-2">
          {items.map(({ tx, reasons }) => {
            const isEditing = editingId === tx.id
            const macro = MACRO_CATEGORIES.find(m => m.id === tx.macroCategoryId)

            return (
              <div key={tx.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Main row */}
                <div className="flex items-start gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                      {tx.isAdjustment && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">ajustado</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-400">
                      <span>{tx.competenceDate}</span>
                      {tx.accountId && <span>· {tx.accountId.replace('acc_', '')}</span>}
                      {macro && <span>· <span style={{ color: macro.color }}>{macro.name}</span></span>}
                      <span>· {tx.classificationType}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {reasons.map((r, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          <AlertTriangle size={9} /> {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: tx.type === 'income' ? '#16A34A' : '#DC2626' }}>
                      {tx.type === 'expense' ? '-' : '+'}{formatBRL(tx.amount)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{tx.status === 'pending' ? 'Pendente' : 'Pago'}</p>
                  </div>
                  <button
                    onClick={() => isEditing ? setEditingId(null) : startEdit(tx)}
                    className="flex-shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ChevronDown size={16} style={{ transform: isEditing ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-gray-500 mb-1 font-medium">Classificação</label>
                        <select
                          value={editPatch.classificationType as string}
                          onChange={e => setEditPatch(p => ({ ...p, classificationType: e.target.value as ClassificationType }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        >
                          {clsOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1 font-medium">Macro categoria</label>
                        <select
                          value={editPatch.macroCategoryId as string ?? ''}
                          onChange={e => setEditPatch(p => ({ ...p, macroCategoryId: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        >
                          {macroOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-600">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!editPatch.includeInOperationalResult}
                          onChange={e => setEditPatch(p => ({ ...p, includeInOperationalResult: e.target.checked }))} className="rounded" />
                        Resultado operacional
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!editPatch.includeInCashflow}
                          onChange={e => setEditPatch(p => ({ ...p, includeInCashflow: e.target.checked }))} className="rounded" />
                        Fluxo de caixa
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!editPatch.includeInBudget}
                          onChange={e => setEditPatch(p => ({ ...p, includeInBudget: e.target.checked }))} className="rounded" />
                        Orçamento
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 font-medium">Observação</label>
                      <input
                        value={editPatch.notes as string ?? ''}
                        onChange={e => setEditPatch(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Por que este ajuste?"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(tx.id)} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700">Salvar ajuste</button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-1.5 border border-gray-300 text-xs text-gray-600 rounded-lg hover:bg-white">Cancelar</button>
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
