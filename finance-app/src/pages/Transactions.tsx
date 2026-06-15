import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight, FlaskConical, X, ArrowLeft, Pencil, Tag } from 'lucide-react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES } from '../config/categories'
import { formatBRL } from '../utils/currency'
import { getCompetenceMonth } from '../utils/date'
import { getReviewItems } from '../utils/reviewItems'
import { getLocalConnections } from '../services/pluggy.service'
import {
  highValueThreshold, findDuplicateCandidateIds, matchesQuickFilter,
  type QuickFilterKey,
} from '../utils/dataQuality'
import type { ReviewReason } from '../utils/reviewItems'
import type { Transaction, SortField, SortDir, ClassificationType } from '../types'
import type { NavFilter } from '../App'

interface Props {
  selectedMonth: string
  onNavigate: (route: string) => void
  navFilter?: NavFilter | null
  onClearFilter?: () => void
}

const DEFAULT_PAGE_SIZE = 500

const CLS_LABELS: Record<ClassificationType, string> = {
  operational_income: 'Receita Op.', extraordinary_income: 'Rec. Eventual',
  operational_expense: 'Desp. Op.', debt_cost: 'Dívida',
  investment: 'Investimento', redemption: 'Resgate',
  transfer: 'Transferência', reimbursement: 'Reembolso',
  adjustment: 'Ajuste', neutral: 'Neutro',
}

const MONTHS_PT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function fmtGroupDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00')
  return `${d.getDate()} ${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`
}

export function Transactions({ selectedMonth, onNavigate, navFilter, onClearFilter }: Props) {
  const { transactions, isDemo, updateTransaction, subCategories } = useData()

  const [search, setSearch] = useState('')
  const [filterMonth, setFilterMonth] = useState(selectedMonth)
  const [filterType, setFilterType] = useState('')
  const [filterMacro, setFilterMacro] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterInstitution, setFilterInstitution] = useState('')
  const [sortField, setSortField] = useState<SortField>('competenceDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)
  const [pageSize] = useState<number>(() => {
    const v = localStorage.getItem('fin_transactions_page_size')
    return v ? parseInt(v, 10) : DEFAULT_PAGE_SIZE
  })
  const [modalTx, setModalTx] = useState<Transaction | null>(null)
  const [modalPatch, setModalPatch] = useState<Partial<Transaction>>({})
  const [reviewPill, setReviewPill] = useState<ReviewReason | 'all'>('all')
  const [inlineCatEdit, setInlineCatEdit] = useState<{ id: string; catId: string } | null>(null)
  const [inlineDescEdit, setInlineDescEdit] = useState<{ id: string; value: string } | null>(null)
  const inlineSelectRef = useRef<HTMLSelectElement>(null)
  const inlineDescRef = useRef<HTMLInputElement>(null)

  const isReviewMode = navFilter?.smartFilter === 'review'
  const drilldownSource = navFilter?.sourcePage ?? null

  function goBack() {
    const routes: Record<string, string> = {
      dashboard: '/',
      budget: '/orcamento',
      closing: '/fechamento',
      review: '/revisao',
    }
    const route = drilldownSource ? (routes[drilldownSource] ?? '/') : '/'
    onClearFilter?.()
    onNavigate(route)
  }

  const [quickFilter, setQuickFilter] = useState<QuickFilterKey | ''>('')

  useEffect(() => {
    setPage(0)
    setReviewPill('all')
    if (navFilter?.monthOverride) setFilterMonth(navFilter.monthOverride)
    if (navFilter?.quickFilter) setQuickFilter(navFilter.quickFilter as QuickFilterKey)
  }, [navFilter])

  const dqCtx = useMemo(() => ({
    threshold: highValueThreshold(transactions),
    duplicateIds: findDuplicateCandidateIds(transactions),
  }), [transactions])

  useEffect(() => {
    if (inlineCatEdit && inlineSelectRef.current) inlineSelectRef.current.focus()
  }, [inlineCatEdit])

  useEffect(() => {
    if (inlineDescEdit && inlineDescRef.current) inlineDescRef.current.focus()
  }, [inlineDescEdit])

  const allMonths = useMemo(() => {
    const set = new Set(transactions.map(t => getCompetenceMonth(t.competenceDate)).filter(Boolean))
    return Array.from(set).sort().reverse()
  }, [transactions])

  // Runtime lookup for Pluggy institution info (fallback for transactions imported without connInfo)
  const pluggyAccountMap = useMemo(() => {
    const map = new Map<string, { name: string; institutionName: string; logoUrl: string | null }>()
    for (const conn of getLocalConnections()) {
      for (const acc of conn.accounts) {
        map.set(acc.id, { name: acc.name, institutionName: conn.connectorName, logoUrl: conn.connectorImageUrl })
      }
    }
    return map
  }, [])

  const reviewItems = useMemo(
    () => isReviewMode ? getReviewItems(transactions) : [],
    [transactions, isReviewMode]
  )

  const reviewCounts = useMemo(() => {
    if (!isReviewMode) return null
    return {
      all: reviewItems.length,
      needs_review: reviewItems.filter(i => i.tags.includes('needs_review')).length,
      no_category: reviewItems.filter(i => i.tags.includes('no_category')).length,
      pending: reviewItems.filter(i => i.tags.includes('pending')).length,
      transfer: reviewItems.filter(i => i.tags.includes('transfer')).length,
      high_value: reviewItems.filter(i => i.tags.includes('high_value')).length,
    }
  }, [reviewItems, isReviewMode])

  const filtered = useMemo(() => {
    if (isReviewMode) {
      const pool = reviewPill === 'all'
        ? reviewItems
        : reviewItems.filter(i => i.tags.includes(reviewPill as ReviewReason))
      return pool.map(i => i.tx)
    }

    let result = transactions
    if (filterMonth) result = result.filter(t => getCompetenceMonth(t.competenceDate) === filterMonth)
    if (filterType) result = result.filter(t => t.type === filterType)
    if (filterMacro) result = result.filter(t => t.macroCategoryId === filterMacro)
    if (filterStatus) result = result.filter(t => t.status === filterStatus)
    if (filterInstitution) result = result.filter(t => {
      const pInfo = pluggyAccountMap.get(t.accountId)
      const inst = t.pluggyInstitutionName ?? pInfo?.institutionName ?? ''
      return inst === filterInstitution
    })
    if (navFilter?.macroCategoryIds?.length) {
      const ids = new Set(navFilter.macroCategoryIds)
      result = result.filter(t => t.macroCategoryId != null && ids.has(t.macroCategoryId))
    }
    if (filterTag) result = result.filter(t => t.tags?.includes(filterTag))
    if (quickFilter) result = result.filter(t => matchesQuickFilter(t, quickFilter, dqCtx))
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      result = result.filter(t => t.description.toUpperCase().includes(q) || t.originalDescription.toUpperCase().includes(q))
    }
    return [...result].sort((a, b) => {
      let cmp = 0
      if (sortField === 'competenceDate') cmp = a.transactionDate.localeCompare(b.transactionDate)
      else if (sortField === 'amount') cmp = a.amount - b.amount
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortField === 'category') cmp = (a.macroCategoryId ?? '').localeCompare(b.macroCategoryId ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [transactions, isReviewMode, reviewItems, reviewPill, filterMonth, filterType, filterMacro, filterStatus, filterTag, quickFilter, dqCtx, navFilter, search, sortField, sortDir])

  const NEUTRAL_TYPES = new Set<ClassificationType>(['transfer', 'neutral', 'adjustment', 'investment', 'redemption'])
  const summary = useMemo(() => ({
    total: filtered.length,
    income: filtered.filter(t => t.type === 'income' && t.includeInOperationalResult).reduce((s, t) => s + t.amount, 0),
    expense: filtered.filter(t => t.type === 'expense' && t.includeInOperationalResult).reduce((s, t) => s + t.amount, 0),
    neutral: filtered.filter(t => NEUTRAL_TYPES.has(t.classificationType)).length,
    pending: filtered.filter(t => t.status === 'pending').length,
  }), [filtered])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const pageItems = filtered.slice(page * pageSize, (page + 1) * pageSize)

  // Group page items by transactionDate
  const grouped = useMemo(() => {
    const groups: { date: string; items: Transaction[] }[] = []
    const map = new Map<string, Transaction[]>()
    for (const tx of pageItems) {
      const d = tx.transactionDate
      if (!map.has(d)) {
        const arr: Transaction[] = []
        map.set(d, arr)
        groups.push({ date: d, items: arr })
      }
      map.get(d)!.push(tx)
    }
    return groups
  }, [pageItems])

  function openModal(tx: Transaction) {
    setModalTx(tx)
    setModalPatch({
      description: tx.description,
      status: tx.status,
      classificationType: tx.classificationType,
      macroCategoryId: tx.macroCategoryId,
      subCategoryId: tx.subCategoryId,
      notes: tx.notes ?? '',
      competenceDate: tx.competenceDate,
      tags: tx.tags ? [...tx.tags] : [],
    })
  }

  function saveModal() {
    if (!modalTx) return
    updateTransaction(modalTx.id, modalPatch)
    setModalTx(null)
  }

  function openInlineCat(tx: Transaction) {
    setInlineCatEdit({ id: tx.id, catId: tx.macroCategoryId ?? '' })
  }

  function saveInlineCat(newCatId: string, txId: string) {
    const tx = transactions.find(t => t.id === txId)
    if (tx && newCatId !== (tx.macroCategoryId ?? '')) {
      updateTransaction(txId, { macroCategoryId: newCatId || undefined, subCategoryId: undefined })
    }
    setInlineCatEdit(null)
  }

  function openInlineDesc(tx: Transaction) {
    setInlineDescEdit({ id: tx.id, value: tx.description })
  }

  function saveInlineDesc(newDesc: string, txId: string) {
    const tx = transactions.find(t => t.id === txId)
    if (tx && newDesc.trim() && newDesc.trim() !== tx.description) {
      updateTransaction(txId, { description: newDesc.trim() })
    }
    setInlineDescEdit(null)
  }

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of transactions) t.tags?.forEach(tag => set.add(tag))
    return Array.from(set).sort()
  }, [transactions])

  const resultColor = summary.income - summary.expense >= 0 ? 'var(--pos)' : 'var(--crit)'
  const allInstitutions = useMemo(() => {
    const set = new Set<string>()
    for (const t of transactions) {
      if (t.source !== 'pluggy') continue
      const pInfo = pluggyAccountMap.get(t.accountId)
      const inst = t.pluggyInstitutionName ?? pInfo?.institutionName
      if (inst) set.add(inst)
    }
    return Array.from(set).sort()
  }, [transactions, pluggyAccountMap])

  const hasFilters = !!(search || filterType || filterStatus || filterMacro || filterTag || filterInstitution || quickFilter)

  return (
    <main className="page-shell">
      <div className="page-content section-gap">

        {drilldownSource && (
          <button
            onClick={goBack}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
              background: 'var(--well)', border: '1px solid var(--line)',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              fontFamily: 'var(--ui)', alignSelf: 'flex-start',
            }}
          >
            <ArrowLeft size={13} />
            Voltar para {navFilter?.sourceLabel ?? 'tela anterior'}
          </button>
        )}

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
              onClick={() => { setQuickFilter(''); onClearFilter?.() }}
              aria-label="Limpar filtro"
              style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--faint)' }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {isReviewMode && reviewCounts && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {([
              { key: 'all',          label: 'Todos',           count: reviewCounts.all },
              { key: 'needs_review', label: 'Precisa revisar', count: reviewCounts.needs_review },
              { key: 'no_category',  label: 'Sem categoria',   count: reviewCounts.no_category },
              { key: 'pending',      label: 'Pendentes',       count: reviewCounts.pending },
              { key: 'transfer',     label: 'Transferências',  count: reviewCounts.transfer },
              { key: 'high_value',   label: 'Alto valor',      count: reviewCounts.high_value },
            ] as { key: ReviewReason | 'all'; label: string; count: number }[]).map(f => (
              <button
                key={f.key}
                onClick={() => { setReviewPill(f.key); setPage(0) }}
                className={`filter-pill${reviewPill === f.key ? ' active' : ''}`}
              >
                {f.label}
                {f.count > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                    background: reviewPill === f.key ? 'rgba(255,255,255,.22)' : 'var(--well)',
                    color: reviewPill === f.key ? '#fff' : 'var(--faint)',
                  }}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

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

        {!isReviewMode && (
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

            <select className="ledger-select" value={filterMacro} onChange={e => { setFilterMacro(e.target.value); setPage(0) }} aria-label="Categoria">
              <option value="">Todas categorias</option>
              {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>

            {allTags.length > 0 && (
              <select className="ledger-select" value={filterTag} onChange={e => { setFilterTag(e.target.value); setPage(0) }} aria-label="Tag">
                <option value="">Todas as tags</option>
                {allTags.map(tag => <option key={tag} value={tag}>#{tag}</option>)}
              </select>
            )}

            {allInstitutions.length > 0 && (
              <select className="ledger-select" value={filterInstitution} onChange={e => { setFilterInstitution(e.target.value); setPage(0) }} aria-label="Instituição">
                <option value="">Todas instituições</option>
                {allInstitutions.map(inst => <option key={inst} value={inst}>{inst}</option>)}
              </select>
            )}

            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setFilterType(''); setFilterStatus(''); setFilterMacro(''); setFilterTag(''); setFilterInstitution(''); setQuickFilter(''); onClearFilter?.(); setPage(0) }}
                style={{ fontSize: 11, color: 'var(--crit)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '0 4px', fontFamily: 'var(--ui)' }}
              >
                Limpar
              </button>
            )}
          </div>
        )}

        {/* ── Ledger grouped by day ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {grouped.length === 0 ? (
            <div className="empty-state">
              <div className="empty-glyph" />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Nenhum lançamento encontrado</h4>
              <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 220 }}>
                Ajuste os filtros ou importe um extrato.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                <thead>
                  <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                    <th className="table-th" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => {
                      if (sortField === 'competenceDate') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                      else { setSortField('competenceDate'); setSortDir('desc') }
                      setPage(0)
                    }}>Descrição</th>
                    <th className="table-th table-th-right" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => {
                      if (sortField === 'amount') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                      else { setSortField('amount'); setSortDir('desc') }
                      setPage(0)
                    }}>Valor</th>
                    <th className="table-th" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => {
                      if (sortField === 'category') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                      else { setSortField('category'); setSortDir('desc') }
                      setPage(0)
                    }}>Categoria</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(({ date, items }) => (
                    <>
                      {/* Day group header */}
                      <tr key={`g-${date}`} style={{ background: 'var(--well)' }}>
                        <td
                          colSpan={4}
                          style={{
                            padding: '5px 16px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--ink-2)',
                            letterSpacing: '.03em',
                            borderBottom: '1px solid var(--line)',
                            borderTop: '1px solid var(--line)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {fmtGroupDate(date)}
                        </td>
                      </tr>
                      {items.map(tx => {
                        const macro = MACRO_CATEGORIES.find(m => m.id === tx.macroCategoryId)
                        const sub = tx.subCategoryId ? subCategories.find(s => s.id === tx.subCategoryId) : null
                        const reviewItem = isReviewMode ? reviewItems.find(i => i.tx.id === tx.id) : undefined
                        const isInlineCat = inlineCatEdit?.id === tx.id
                        const isInlineDesc = inlineDescEdit?.id === tx.id
                        const subOptions = macro ? subCategories.filter(s => s.macroCategoryId === macro.id && s.active) : []

                        return (
                          <tr
                            key={tx.id}
                            className="table-row"
                            style={{ opacity: tx.status === 'pending' ? 0.65 : 1 }}
                          >
                            {/* Description */}
                            <td className="table-td" style={{ maxWidth: 320 }}>
                              {isInlineDesc ? (
                                <input
                                  ref={inlineDescRef}
                                  value={inlineDescEdit.value}
                                  onChange={e => setInlineDescEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                  onBlur={() => saveInlineDesc(inlineDescEdit.value, tx.id)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveInlineDesc(inlineDescEdit.value, tx.id)
                                    if (e.key === 'Escape') setInlineDescEdit(null)
                                  }}
                                  style={{ fontSize: 12.5, fontWeight: 600, width: '100%', background: 'var(--paper)', border: '1px solid var(--accent)', borderRadius: 5, padding: '2px 6px', outline: 'none', color: 'var(--ink)', fontFamily: 'var(--ui)' }}
                                />
                              ) : (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <p
                                      role="button"
                                      tabIndex={0}
                                      title="Clique duplo para editar descrição"
                                      onDoubleClick={() => openInlineDesc(tx)}
                                      onKeyDown={e => e.key === 'Enter' && openInlineDesc(tx)}
                                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 12.5, color: 'var(--ink)', maxWidth: 240, cursor: 'text' }}
                                    >
                                      {tx.description}
                                    </p>
                                    {(tx.manualCategoryOverride || tx.manualTextOverride) && (
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--pos-soft)', color: 'var(--pos)', border: '1px solid var(--pos)30', flexShrink: 0 }}>
                                        editado
                                      </span>
                                    )}
                                    {tx.status === 'pending' && (
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--warn-soft, #fef3c7)', color: 'var(--warn)', flexShrink: 0 }}>
                                        pendente
                                      </span>
                                    )}
                                  </div>
                                  {tx.source === 'pluggy' && (() => {
                                    const pInfo = pluggyAccountMap.get(tx.accountId)
                                    const institution = tx.pluggyInstitutionName ?? pInfo?.institutionName
                                    const account = tx.pluggyAccountName ?? pInfo?.name
                                    const logo = tx.pluggyInstitutionLogoUrl ?? pInfo?.logoUrl
                                    if (!institution && !account) return null
                                    return (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                        {logo && <img src={logo} alt="" style={{ width: 11, height: 11, borderRadius: 2, objectFit: 'contain', flexShrink: 0, opacity: 0.7 }} />}
                                        <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                                          {institution}{account && institution ? ` · ${account}` : account}
                                        </span>
                                      </div>
                                    )
                                  })()}
                                </>
                              )}
                              {/* Tags chips (Bloco 6) */}
                              {tx.tags && tx.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
                                  {tx.tags.map(tag => (
                                    <span
                                      key={tag}
                                      onClick={() => setFilterTag(tag)}
                                      title={`Filtrar por #${tag}`}
                                      style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 10, background: 'var(--well)', border: '1px solid var(--line)', color: 'var(--ink-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                                    >
                                      <Tag size={7} />
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {reviewItem && reviewItem.reasons.map((r, i) => (
                                <span key={i} className="review-note" style={{ marginTop: 3, display: 'block' }}>{r}</span>
                              ))}
                            </td>

                            {/* Amount */}
                            <td
                              className="table-td table-th-right"
                              style={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 13,
                                color: tx.type === 'income' ? 'var(--pos)' : (tx.classificationType === 'debt_cost' ? 'var(--crit)' : 'var(--ink)') }}
                            >
                              {tx.type === 'expense' ? '−' : '+'}{formatBRL(tx.amount)}
                            </td>

                            {/* Category (inline editable) */}
                            <td className="table-td">
                              {isInlineCat ? (
                                <select
                                  ref={inlineSelectRef}
                                  value={inlineCatEdit.catId}
                                  onChange={e => setInlineCatEdit(prev => prev ? { ...prev, catId: e.target.value } : null)}
                                  onBlur={() => saveInlineCat(inlineCatEdit.catId, tx.id)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveInlineCat(inlineCatEdit.catId, tx.id)
                                    if (e.key === 'Escape') setInlineCatEdit(null)
                                  }}
                                  className="ledger-select"
                                  style={{ fontSize: 11, minWidth: 130 }}
                                >
                                  <option value="">Sem categoria</option>
                                  {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                              ) : (
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => openInlineCat(tx)}
                                  onKeyDown={e => e.key === 'Enter' && openInlineCat(tx)}
                                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}
                                  title="Clique para editar categoria"
                                >
                                  {macro ? (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      fontSize: 10, padding: '2px 7px', borderRadius: 4,
                                      border: `1px solid ${macro.color}50`, color: macro.color,
                                      fontWeight: 600, background: `${macro.color}12`,
                                    }}>
                                      {macro.name}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 600, padding: '2px 4px', borderRadius: 4, border: '1px dashed var(--line)', whiteSpace: 'nowrap' }}>
                                      A classificar
                                    </span>
                                  )}
                                  {sub ? (
                                    <span style={{ fontSize: 10.5, color: 'var(--ink-2)', fontWeight: 500 }}>· {sub.name}</span>
                                  ) : macro && subOptions.length > 0 ? (
                                    <span style={{ fontSize: 10, color: 'var(--faint)', fontStyle: 'italic' }}>· sem subcat.</span>
                                  ) : null}
                                </div>
                              )}
                            </td>

                            {/* Edit button */}
                            <td className="table-td" style={{ whiteSpace: 'nowrap' }}>
                              <button
                                onClick={() => openModal(tx)}
                                aria-label="Editar lançamento"
                                title="Editar"
                                style={{ display: 'flex', alignItems: 'center', color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 5 }}
                              >
                                <Pencil size={12} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

        {drilldownSource && (
          <div style={{ paddingBottom: 8 }}>
            <button
              onClick={goBack}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
                background: 'var(--well)', border: '1px solid var(--line)',
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                fontFamily: 'var(--ui)',
              }}
            >
              <ArrowLeft size={13} />
              Voltar para {navFilter?.sourceLabel ?? 'tela anterior'}
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
                {modalTx?.originalDescription && modalTx.originalDescription !== modalPatch.description && (
                  <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3 }}>
                    Original: {modalTx.originalDescription}
                  </p>
                )}
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
                  onChange={e => setModalPatch(p => ({ ...p, macroCategoryId: e.target.value || undefined, subCategoryId: undefined }))}
                  className="ledger-select"
                  style={{ width: '100%', fontSize: 12 }}
                >
                  <option value="">Sem categoria</option>
                  {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </ModalField>

              {modalPatch.macroCategoryId && (() => {
                const filteredSubs = subCategories.filter(s => s.macroCategoryId === modalPatch.macroCategoryId && s.active)
                if (filteredSubs.length === 0) return null
                return (
                  <ModalField label="Subcategoria">
                    <select
                      value={modalPatch.subCategoryId ?? ''}
                      onChange={e => setModalPatch(p => ({ ...p, subCategoryId: e.target.value || undefined }))}
                      className="ledger-select"
                      style={{ width: '100%', fontSize: 12 }}
                    >
                      <option value="">Sem subcategoria</option>
                      {filteredSubs.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </ModalField>
                )
              })()}

              <ModalTagsField
                tags={(modalPatch.tags as string[] | undefined) ?? []}
                onChange={tags => setModalPatch(p => ({ ...p, tags }))}
              />

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

function ModalTagsField({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')

  function addTag() {
    const t = input.trim().toLowerCase().replace(/\s+/g, '_')
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
  }

  return (
    <ModalField label="Tags">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: tags.length ? 6 : 0 }}>
        {tags.map(tag => (
          <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: 'var(--well)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
            #{tag}
            <button
              onClick={() => onChange(tags.filter(t => t !== tag))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 0, lineHeight: 1, fontSize: 12, fontFamily: 'var(--ui)' }}
              aria-label={`Remover tag ${tag}`}
            >×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder="Nova tag…"
          className="login-field"
          style={{ fontSize: 12, flex: 1 }}
        />
        <button className="btn btn-secondary btn-sm" onClick={addTag} type="button" disabled={!input.trim()}>
          + Adicionar
        </button>
      </div>
    </ModalField>
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
