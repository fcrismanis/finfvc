import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES } from '../config/categories'
import { formatBRL } from '../utils/currency'
import { getCompetenceMonth } from '../utils/date'
import type { Transaction, ClassificationType, SortField, SortDir } from '../types'

interface Props {
  selectedMonth: string
  onNavigate: (route: string) => void
}

const PAGE_SIZE = 50

const NEUTRAL_TYPES = new Set<ClassificationType>(['transfer', 'neutral', 'adjustment', 'investment', 'redemption'])

const CLS_LABELS: Record<ClassificationType, string> = {
  operational_income: 'Receita Op.', extraordinary_income: 'Rec. Eventual',
  operational_expense: 'Desp. Op.', debt_cost: 'Dívida',
  investment: 'Investimento', redemption: 'Resgate',
  transfer: 'Transferência', reimbursement: 'Reembolso',
  adjustment: 'Ajuste', neutral: 'Neutro',
}

function clsColor(cls: ClassificationType): string {
  if (cls === 'operational_income' || cls === 'extraordinary_income') return '#16A34A'
  if (cls === 'debt_cost') return '#DC2626'
  if (NEUTRAL_TYPES.has(cls)) return '#9CA3AF'
  return '#EF4444'
}

export function Transactions({ selectedMonth, onNavigate }: Props) {
  const { transactions, isDemo, updateTransaction } = useData()

  const [search, setSearch] = useState('')
  const [filterMonth, setFilterMonth] = useState(selectedMonth)
  const [filterType, setFilterType] = useState('')
  const [filterCls, setFilterCls] = useState('')
  const [filterMacro, setFilterMacro] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortField, setSortField] = useState<SortField>('competenceDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPatch, setEditPatch] = useState<Partial<Transaction>>({})

  const allMonths = useMemo(() => {
    const set = new Set(transactions.map(t => getCompetenceMonth(t.competenceDate)).filter(Boolean))
    return Array.from(set).sort().reverse()
  }, [transactions])

  const filtered = useMemo(() => {
    let result = transactions
    if (filterMonth) result = result.filter(t => getCompetenceMonth(t.competenceDate) === filterMonth)
    if (filterType) result = result.filter(t => t.type === filterType)
    if (filterCls) result = result.filter(t => t.classificationType === filterCls)
    if (filterMacro) result = result.filter(t => t.macroCategoryId === filterMacro)
    if (filterStatus) result = result.filter(t => t.status === filterStatus)
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      result = result.filter(t => t.description.toUpperCase().includes(q) || t.originalDescription.toUpperCase().includes(q))
    }
    return [...result].sort((a, b) => {
      let cmp = 0
      if (sortField === 'competenceDate') cmp = a.competenceDate.localeCompare(b.competenceDate)
      else if (sortField === 'amount') cmp = a.amount - b.amount
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortField === 'category') cmp = (a.macroCategoryId ?? '').localeCompare(b.macroCategoryId ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [transactions, filterMonth, filterType, filterCls, filterMacro, filterStatus, search, sortField, sortDir])

  const summary = useMemo(() => ({
    total: filtered.length,
    income: filtered.filter(t => t.type === 'income' && t.includeInOperationalResult).reduce((s, t) => s + t.amount, 0),
    expense: filtered.filter(t => t.type === 'expense' && t.includeInOperationalResult).reduce((s, t) => s + t.amount, 0),
    neutral: filtered.filter(t => NEUTRAL_TYPES.has(t.classificationType)).length,
    pending: filtered.filter(t => t.status === 'pending').length,
  }), [filtered])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    setPage(0)
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronDown size={11} color="#D1D5DB" />
    return sortDir === 'asc' ? <ChevronUp size={11} color="#4F46E5" /> : <ChevronDown size={11} color="#4F46E5" />
  }

  function startEdit(tx: Transaction) {
    setEditingId(tx.id)
    setEditPatch({ classificationType: tx.classificationType, macroCategoryId: tx.macroCategoryId, notes: tx.notes })
  }

  function saveEdit(id: string) {
    updateTransaction(id, editPatch)
    setEditingId(null)
  }


  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 p-5">
      <div className="max-w-[1280px] mx-auto space-y-4">

        {isDemo && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
            <FlaskConical size={12} />
            <span>Dados demonstrativos — <button className="underline" onClick={() => onNavigate('/conectar')}>importe seu extrato</button></span>
          </div>
        )}

        {/* Summary bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap gap-4 text-sm">
          <span className="text-gray-500">{summary.total} lançamentos</span>
          <span className="text-green-700 font-medium">+{formatBRL(summary.income)}</span>
          <span className="text-red-700 font-medium">-{formatBRL(summary.expense)}</span>
          <span className="text-gray-500">{summary.neutral} neutros</span>
          {summary.pending > 0 && <span className="text-amber-700">{summary.pending} pendentes</span>}
          <span
            className="ml-auto font-semibold"
            style={{ color: summary.income - summary.expense >= 0 ? '#16A34A' : '#DC2626' }}
          >
            {formatBRL(summary.income - summary.expense)}
          </span>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[180px]">
            <Search size={13} color="#9CA3AF" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="Buscar por descrição…"
              className="flex-1 text-xs outline-none bg-transparent text-gray-700 placeholder:text-gray-400"
            />
          </div>

          <Select value={filterMonth} onChange={v => { setFilterMonth(v); setPage(0) }} label="Mês">
            <option value="">Todos os meses</option>
            {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </Select>

          <Select value={filterType} onChange={v => { setFilterType(v); setPage(0) }} label="Tipo">
            <option value="">Todos</option>
            <option value="income">Receita</option>
            <option value="expense">Despesa</option>
          </Select>

          <Select value={filterStatus} onChange={v => { setFilterStatus(v); setPage(0) }} label="Status">
            <option value="">Todos</option>
            <option value="paid">Pago</option>
            <option value="pending">Pendente</option>
            <option value="cancelled">Cancelado</option>
          </Select>

          <Select value={filterMacro} onChange={v => { setFilterMacro(v); setPage(0) }} label="Macro">
            <option value="">Todas</option>
            {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>

          {(search || filterType || filterStatus || filterMacro || filterCls) && (
            <button
              onClick={() => { setSearch(''); setFilterType(''); setFilterStatus(''); setFilterMacro(''); setFilterCls(''); setPage(0) }}
              className="text-xs text-red-600 hover:text-red-800 px-2"
            >Limpar</button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
                <th className="text-left px-3 py-2.5 cursor-pointer select-none font-medium" onClick={() => toggleSort('competenceDate')}>
                  <span className="flex items-center gap-1">Data <SortIcon field="competenceDate" /></span>
                </th>
                <th className="text-left px-3 py-2.5 font-medium">Descrição</th>
                <th className="text-right px-3 py-2.5 cursor-pointer select-none font-medium" onClick={() => toggleSort('amount')}>
                  <span className="flex items-center justify-end gap-1">Valor <SortIcon field="amount" /></span>
                </th>
                <th className="text-left px-3 py-2.5 cursor-pointer select-none font-medium" onClick={() => toggleSort('category')}>
                  <span className="flex items-center gap-1">Categoria <SortIcon field="category" /></span>
                </th>
                <th className="text-left px-3 py-2.5 font-medium">Classificação</th>
                <th className="text-left px-3 py-2.5 cursor-pointer select-none font-medium" onClick={() => toggleSort('status')}>
                  <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
                </th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageItems.map(tx => {
                const macro = MACRO_CATEGORIES.find(m => m.id === tx.macroCategoryId)
                const isEditing = editingId === tx.id
                return (
                  <tr key={tx.id} className={`hover:bg-gray-50 transition-colors ${tx.status === 'pending' ? 'opacity-70' : ''}`}>
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{tx.competenceDate}</td>
                    <td className="px-3 py-2 text-gray-800 max-w-[260px]">
                      <p className="truncate font-medium">{tx.description}</p>
                      {tx.isAdjustment && <p className="text-[10px] text-indigo-500">ajustado manualmente</p>}
                    </td>
                    <td className="px-3 py-2 text-right font-medium whitespace-nowrap"
                      style={{ color: clsColor(tx.classificationType) }}>
                      {tx.type === 'expense' ? '-' : '+'}{formatBRL(tx.amount)}
                    </td>
                    <td className="px-3 py-2">
                      {macro && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: macro.color + '22', color: macro.color }}>
                          {macro.name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          value={editPatch.classificationType as string}
                          onChange={e => setEditPatch(p => ({ ...p, classificationType: e.target.value as ClassificationType }))}
                          className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none"
                        >
                          {Object.entries(CLS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : (
                        <span className="text-gray-500">{CLS_LABELS[tx.classificationType] ?? tx.classificationType}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        tx.status === 'paid' ? 'bg-green-50 text-green-700'
                        : tx.status === 'pending' ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-100 text-gray-500'
                      }`}>{tx.status === 'paid' ? 'Pago' : tx.status === 'pending' ? 'Pendente' : 'Cancelado'}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(tx.id)} className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded font-medium">Salvar</button>
                          <button onClick={() => setEditingId(null)} className="text-[10px] px-2 py-0.5 border border-gray-300 text-gray-600 rounded">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(tx)} className="text-[10px] text-indigo-600 hover:text-indigo-800">Editar</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {pageItems.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400 text-sm">Nenhum lançamento encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-600 pb-4">
            <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0} className="p-1 rounded hover:bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
            <span>Página {page + 1} de {totalPages} ({filtered.length} registros)</span>
            <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page === totalPages-1} className="p-1 rounded hover:bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
          </div>
        )}
      </div>
    </main>
  )
}

function Select({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label={label}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
    >
      {children}
    </select>
  )
}
