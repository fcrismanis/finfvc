import { useState, useMemo, useEffect } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, FlaskConical, X } from 'lucide-react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES } from '../config/categories'
import { formatBRL } from '../utils/currency'
import { getCompetenceMonth } from '../utils/date'
import type { Transaction, ClassificationType, SortField, SortDir } from '../types'
import type { NavFilter } from '../App'

interface Props {
  selectedMonth: string
  onNavigate: (route: string) => void
  navFilter?: NavFilter | null
  onClearFilter?: () => void
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
  if (cls === 'operational_income' || cls === 'extraordinary_income') return 'var(--pos)'
  if (cls === 'debt_cost') return 'var(--crit)'
  if (NEUTRAL_TYPES.has(cls)) return 'var(--faint)'
  return 'var(--ink-2)'
}

export function Transactions({ selectedMonth, onNavigate, navFilter, onClearFilter }: Props) {
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
  const [modalTx, setModalTx] = useState<Transaction | null>(null)
  const [modalPatch, setModalPatch] = useState<Partial<Transaction>>({})

  // When navFilter arrives (e.g. funnel drilldown), reset page
  useEffect(() => {
    setPage(0)
  }, [navFilter])

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
    if (navFilter?.macroCategoryIds?.length) {
      const ids = new Set(navFilter.macroCategoryIds)
      result = result.filter(t => t.macroCategoryId != null && ids.has(t.macroCategoryId))
    }
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
  }, [transactions, filterMonth, filterType, filterCls, filterMacro, filterStatus, navFilter, search, sortField, sortDir])

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
    if (sortField !== field) return <ChevronDown size={11} color="var(--line)" />
    return sortDir === 'asc'
      ? <ChevronUp size={11} color="var(--ink)" />
      : <ChevronDown size={11} color="var(--ink)" />
  }

  const resultColor = summary.income - summary.expense >= 0 ? 'var(--pos)' : 'var(--crit)'
  const hasFilters = !!(search || filterType || filterStatus || filterMacro || filterCls)

  function openModal(tx: Transaction) {
    setModalTx(tx)
    setModalPatch({
      description: tx.description,
      status: tx.status,
      classificationType: tx.classificationType,
      macroCategoryId: tx.macroCategoryId,
      notes: tx.notes ?? '',
      competenceDate: tx.competenceDate,
    })
  }

  function saveModal() {
    if (!modalTx) return
    updateTransaction(modalTx.id, modalPatch)
    setModalTx(null)
  }

  return (
    <main className="page-shell">
      <div className="page-content section-gap">

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Lançamentos</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
              {summary.total} {summary.total === 1 ? 'lançamento' : 'lançamentos'} no filtro atual
            </div>
          </div>
          {isDemo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent-soft)', borderRadius: 9, padding: '7px 13px', fontSize: 12, color: 'var(--ink)' }}>
              <FlaskConical size={12} />
              <span>
                Dados demonstrativos —{' '}
                <button
                  style={{ fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', fontSize: 12, fontFamily: 'var(--ui)' }}
                  onClick={() => onNavigate('/conectar')}
                >
                  importe seu extrato
                </button>
              </span>
            </div>
          )}
        </div>

        {/* ── Nav filter chip ── */}
        {navFilter?.filterLabel && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 8,
            background: 'var(--accent-soft)', border: '1px solid var(--line)',
            fontSize: 12.5, color: 'var(--ink)', fontWeight: 600,
            alignSelf: 'flex-start',
          }}>
            <span style={{ color: 'var(--faint)', fontWeight: 400 }}>Filtrado por:</span>
            {navFilter.filterLabel}
            <button
              onClick={onClearFilter}
              aria-label="Limpar filtro"
              style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--faint)' }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* ── KPI cards ── */}
        <div className="stats-grid-4">
          <TxStatCard label="Receitas" value={`+${formatBRL(summary.income)}`} color="var(--pos)" />
          <TxStatCard label="Despesas" value={`−${formatBRL(summary.expense)}`} color="var(--crit)" />
          <TxStatCard label="Resultado" value={formatBRL(summary.income - summary.expense)} color={resultColor} soft />
          <TxStatCard
            label="Pendentes"
            value={`${summary.pending}`}
            sub={`${summary.neutral} neutros`}
            color={summary.pending > 0 ? 'var(--warn)' : 'var(--faint)'}
          />
        </div>

        {/* ── Filters ── */}
        <div className="card" style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            flex: '1 1 180px', border: '1px solid var(--line)', borderRadius: 8,
            padding: '5px 10px', background: 'var(--paper)',
          }}>
            <Search size={12} color="var(--faint)" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="Buscar por descrição…"
              style={{ flex: 1, fontSize: 12, outline: 'none', background: 'transparent', color: 'var(--ink)', border: 'none', fontFamily: 'var(--ui)' }}
            />
          </div>

          <select className="ledger-select" value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(0) }} aria-label="Mês">
            <option value="">Todos os meses</option>
            {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select className="ledger-select" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0) }} aria-label="Tipo">
            <option value="">Todos</option>
            <option value="income">Receita</option>
            <option value="expense">Despesa</option>
          </select>

          <select className="ledger-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0) }} aria-label="Status">
            <option value="">Todos</option>
            <option value="paid">Pago</option>
            <option value="pending">Pendente</option>
            <option value="cancelled">Cancelado</option>
          </select>

          <select className="ledger-select" value={filterMacro} onChange={e => { setFilterMacro(e.target.value); setPage(0) }} aria-label="Macro">
            <option value="">Todas</option>
            {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setFilterType(''); setFilterStatus(''); setFilterMacro(''); setFilterCls(''); setPage(0) }}
              style={{ fontSize: 11, color: 'var(--crit)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '0 4px', fontFamily: 'var(--ui)' }}
            >
              Limpar
            </button>
          )}
        </div>

        {/* ── Ledger table ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                  <th
                    className="table-th"
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('competenceDate')}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Data <SortIcon field="competenceDate" />
                    </span>
                  </th>
                  <th className="table-th">Descrição</th>
                  <th
                    className="table-th table-th-right"
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('amount')}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      Valor <SortIcon field="amount" />
                    </span>
                  </th>
                  <th
                    className="table-th"
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('category')}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Categoria <SortIcon field="category" />
                    </span>
                  </th>
                  <th className="table-th">Classificação</th>
                  <th
                    className="table-th"
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('status')}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Status <SortIcon field="status" />
                    </span>
                  </th>
                  <th style={{ width: 72 }} />
                </tr>
              </thead>
              <tbody>
                {pageItems.map(tx => {
                  const macro = MACRO_CATEGORIES.find(m => m.id === tx.macroCategoryId)
                  return (
                    <tr
                      key={tx.id}
                      className="table-row"
                      style={{ opacity: tx.status === 'pending' ? 0.65 : 1 }}
                    >
                      <td className="table-td" style={{ color: 'var(--faint)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {tx.competenceDate}
                      </td>
                      <td className="table-td" style={{ maxWidth: 280 }}>
                        <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>
                          {tx.description}
                        </p>
                        {tx.isAdjustment && (
                          <p style={{ fontSize: 10, color: 'var(--ink-2)', marginTop: 2 }}>ajustado</p>
                        )}
                      </td>
                      <td
                        className="table-td table-th-right"
                        style={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: clsColor(tx.classificationType) }}
                      >
                        {tx.type === 'expense' ? '−' : '+'}{formatBRL(tx.amount)}
                      </td>
                      <td className="table-td">
                        {macro && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10, padding: '2px 7px', borderRadius: 4,
                            border: `1px solid ${macro.color}50`, color: macro.color,
                            fontWeight: 600, background: `${macro.color}12`,
                          }}>
                            {macro.name}
                          </span>
                        )}
                      </td>
                      <td className="table-td">
                        <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                          {CLS_LABELS[tx.classificationType] ?? tx.classificationType}
                        </span>
                      </td>
                      <td className="table-td">
                        {tx.status === 'paid' && (
                          <span className="chip chip-pos">Pago</span>
                        )}
                        {tx.status === 'pending' && (
                          <span className="chip chip-warn">Pendente</span>
                        )}
                        {tx.status === 'cancelled' && (
                          <span className="chip chip-neutral">Cancelado</span>
                        )}
                      </td>
                      <td className="table-td" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => openModal(tx)}
                          style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-glyph" />
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Nenhum lançamento encontrado</h4>
                        <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 220 }}>
                          Ajuste os filtros ou importe um extrato.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 16, fontSize: 12.5, color: 'var(--ink-2)' }}>
            <button
              className="btn-ghost"
              style={{ width: 28, height: 28 }}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft size={13} />
            </button>
            <span style={{ fontWeight: 600 }}>
              Página {page + 1} de {totalPages}
              <span style={{ color: 'var(--faint)', fontWeight: 400, marginLeft: 4 }}>({filtered.length} registros)</span>
            </span>
            <button
              className="btn-ghost"
              style={{ width: 28, height: 28 }}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}

      </div>

      {/* ── Edit modal ── */}
      {modalTx && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(16,15,10,.45)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={e => e.target === e.currentTarget && setModalTx(null)}
        >
          <div style={{
            background: 'var(--card-bg)', borderRadius: 14, padding: '24px 28px',
            width: '100%', maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,.18)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>Editar lançamento</h2>
              <button onClick={() => setModalTx(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ModalField label="Descrição">
                <input
                  value={modalPatch.description ?? ''}
                  onChange={e => setModalPatch(p => ({ ...p, description: e.target.value }))}
                  className="login-field"
                  style={{ fontSize: 13 }}
                />
              </ModalField>

              <ModalField label="Data de competência">
                <input
                  type="date"
                  value={modalPatch.competenceDate ?? ''}
                  onChange={e => setModalPatch(p => ({ ...p, competenceDate: e.target.value }))}
                  className="login-field"
                  style={{ fontSize: 13 }}
                />
              </ModalField>

              <div style={{ display: 'flex', gap: 12 }}>
                <ModalField label="Classificação" style={{ flex: 1 }}>
                  <select
                    value={modalPatch.classificationType as string ?? ''}
                    onChange={e => setModalPatch(p => ({ ...p, classificationType: e.target.value as ClassificationType }))}
                    className="ledger-select"
                    style={{ width: '100%', fontSize: 12 }}
                  >
                    {Object.entries(CLS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </ModalField>

                <ModalField label="Status" style={{ flex: 1 }}>
                  <select
                    value={modalPatch.status ?? ''}
                    onChange={e => setModalPatch(p => ({ ...p, status: e.target.value as Transaction['status'] }))}
                    className="ledger-select"
                    style={{ width: '100%', fontSize: 12 }}
                  >
                    <option value="paid">Pago</option>
                    <option value="pending">Pendente</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </ModalField>
              </div>

              <ModalField label="Categoria">
                <select
                  value={modalPatch.macroCategoryId ?? ''}
                  onChange={e => setModalPatch(p => ({ ...p, macroCategoryId: e.target.value || undefined }))}
                  className="ledger-select"
                  style={{ width: '100%', fontSize: 12 }}
                >
                  <option value="">Sem categoria</option>
                  {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </ModalField>

              <ModalField label="Observações">
                <textarea
                  value={modalPatch.notes ?? ''}
                  onChange={e => setModalPatch(p => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  placeholder="Notas opcionais…"
                  style={{
                    width: '100%', fontSize: 12.5, lineHeight: 1.5,
                    border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px',
                    resize: 'none', outline: 'none', background: 'var(--paper)',
                    fontFamily: 'var(--ui)', boxSizing: 'border-box', color: 'var(--ink)',
                  } as React.CSSProperties}
                />
              </ModalField>
            </div>

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button className="btn btn-primary" onClick={saveModal}>Salvar alterações</button>
              <button className="btn btn-secondary" onClick={() => setModalTx(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}

function ModalField({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function TxStatCard({ label, value, color, sub, soft }: {
  label: string; value: string; color: string; sub?: string; soft?: boolean
}) {
  return (
    <div className="card" style={{ padding: '14px 18px', ...(soft ? { background: 'var(--accent-soft)' } : {}) }}>
      <span className="eyebrow" style={{ display: 'block', marginBottom: 7 }}>{label}</span>
      <p className="num" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', color }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{sub}</p>}
    </div>
  )
}
