import { useState, useMemo, useEffect, useLayoutEffect, useRef, Fragment } from 'react'
import { useRouteScroll } from '../hooks/useRouteScroll'
import { Search, ChevronLeft, ChevronRight, FlaskConical, X, ArrowLeft, Pencil, Download, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { getAllMacroCategories } from '../services/financeParentCategories.service'
import { CATEGORIES } from '../config/categories'
import { CategorySelector, TxCatIcon } from '../components/CategorySelector'
import { formatBRL } from '../utils/currency'
import { getCompetenceMonth, normalizeFinancialDate } from '../utils/date'
import { getReviewItems } from '../utils/reviewItems'
import { getLocalConnections } from '../services/pluggy.service'
import {
  highValueThreshold, findDuplicateCandidateIds, matchesQuickFilter,
  QUICK_FILTER_LABELS, type QuickFilterKey,
} from '../utils/dataQuality'
import { learnRuleFromTransaction, incrementRuleUseCount } from '../services/categoryRules.service'
import { findSimilarUncategorized } from '../utils/similarTransactions'
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
const SAVED_FILTERS_KEY = 'fin_ledger_filters'

interface SavedFilters {
  filterType?: string
  filterStatus?: string
  filterMacro?: string
  filterTag?: string
  filterInstitution?: string
  quickFilter?: string
}

function loadSavedFilters(): SavedFilters {
  try {
    const raw = localStorage.getItem(SAVED_FILTERS_KEY)
    return raw ? (JSON.parse(raw) as SavedFilters) : {}
  } catch {
    return {}
  }
}

const CLS_LABELS: Record<ClassificationType, string> = {
  operational_income: 'Receita Op.', extraordinary_income: 'Rec. Eventual',
  operational_expense: 'Desp. Op.', debt_cost: 'Dívida',
  investment: 'Investimento', redemption: 'Resgate',
  transfer: 'Transferência', reimbursement: 'Reembolso',
  adjustment: 'Ajuste', neutral: 'Neutro',
}

function fmtGroupDate(isoDate: string): string {
  return normalizeFinancialDate(isoDate, isoDate)
}

export function Transactions({ selectedMonth, onNavigate, navFilter, onClearFilter }: Props) {
  const { transactions, isDemo, updateTransaction, subCategories } = useData()

  const savedFilters = useMemo(() => loadSavedFilters(), [])
  const [search, setSearch] = useState('')
  const [filterMonth, setFilterMonth] = useState(selectedMonth)
  const [filterType, setFilterType] = useState(savedFilters.filterType ?? '')
  const [filterMacro, setFilterMacro] = useState(savedFilters.filterMacro ?? '')
  const [filterStatus, setFilterStatus] = useState(savedFilters.filterStatus ?? '')
  const [filterTag, setFilterTag] = useState(savedFilters.filterTag ?? '')
  const [filterInstitution, setFilterInstitution] = useState(savedFilters.filterInstitution ?? '')
  const [sortField, setSortField] = useState<SortField>('competenceDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showStatusBadges, setShowStatusBadges] = useState<boolean>(() => localStorage.getItem('fin_show_status_badges') !== 'false')
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
  const inlineDescRef = useRef<HTMLInputElement>(null)
  const mainRef = useRouteScroll('/lancamentos')

  // Inline-edit scroll anchor — restored in useLayoutEffect before paint
  interface ScrollAnchor {
    transactionId: string
    scrollTop: number
    scrollHeight: number
    elementTop: number | null
  }
  const pendingScrollAnchorRef = useRef<ScrollAnchor | null>(null)

  function captureScrollAnchor(transactionId: string): void {
    const container = mainRef.current
    if (!container) return
    const el = container.querySelector<HTMLElement>(`[data-transaction-id="${transactionId}"]`)
    const containerRect = container.getBoundingClientRect()
    pendingScrollAnchorRef.current = {
      transactionId,
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      elementTop: el ? el.getBoundingClientRect().top - containerRect.top : null,
    }
  }


  // Runs after DOM commit, before paint — no visible flicker
  // Depends on state that changes when inline edits open/close (DOM changes)
  useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current
    const container = mainRef.current
    if (!anchor || !container) return
    pendingScrollAnchorRef.current = null
    const el = container.querySelector<HTMLElement>(`[data-transaction-id="${anchor.transactionId}"]`)
    if (el && anchor.elementTop !== null) {
      const newTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top
      container.scrollTop += (newTop - anchor.elementTop)
    } else {
      // Item left the filter: restore previous scroll (browser clamps to valid range)
      container.scrollTop = anchor.scrollTop
    }
  }, [transactions, inlineCatEdit, inlineDescEdit])

  // Similar-category propagation state
  interface SimilarApplied { count: number; category: string }
  interface SimilarPending { candidates: Transaction[]; macroCategoryId: string; subCategoryId?: string; classificationType: string; ruleId?: string }
  const [similarToast, setSimilarToast] = useState<SimilarApplied | null>(null)
  const [similarModal, setSimilarModal] = useState<SimilarPending | null>(null)
  const [selectedSimilar, setSelectedSimilar] = useState<Set<string>>(new Set())

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

  const [quickFilter, setQuickFilter] = useState<QuickFilterKey | ''>((savedFilters.quickFilter as QuickFilterKey) ?? '')

  useEffect(() => {
    setPage(0)
    setReviewPill('all')
    if (navFilter && 'monthOverride' in navFilter) setFilterMonth(navFilter.monthOverride ?? '')
    if (navFilter?.quickFilter) setQuickFilter(navFilter.quickFilter as QuickFilterKey)
  }, [navFilter])

  // Persist filter selections (not search/month) across sessions
  useEffect(() => {
    const payload: SavedFilters = { filterType, filterStatus, filterMacro, filterTag, filterInstitution, quickFilter }
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(payload))
  }, [filterType, filterStatus, filterMacro, filterTag, filterInstitution, quickFilter])

  const allMacros = useMemo(() => getAllMacroCategories(), [])

  const dqCtx = useMemo(() => ({
    threshold: highValueThreshold(transactions),
    duplicateIds: findDuplicateCandidateIds(transactions),
  }), [transactions])

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
        map.set(acc.id, { name: acc.displayName ?? acc.name, institutionName: conn.connectorName, logoUrl: conn.connectorImageUrl })
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
      const acc = pInfo?.name ?? t.pluggyAccountName ?? ''
      return acc === filterInstitution
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
  }, [transactions, isReviewMode, reviewItems, reviewPill, filterMonth, filterType, filterMacro, filterStatus, filterInstitution, filterTag, quickFilter, dqCtx, navFilter, search, sortField, sortDir, pluggyAccountMap])

  const NEUTRAL_TYPES = new Set<ClassificationType>(['transfer', 'neutral', 'adjustment', 'investment', 'redemption'])

  const summary = useMemo(() => {
    const income = filtered
      .filter(t => t.type === 'income' && !NEUTRAL_TYPES.has(t.classificationType))
      .reduce((s, t) => s + t.amount, 0)
    const expense = filtered
      .filter(t => t.type === 'expense' && !NEUTRAL_TYPES.has(t.classificationType))
      .reduce((s, t) => s + t.amount, 0)
    return {
      total: filtered.length,
      pending: filtered.filter(t => t.status === 'pending').length,
      income,
      expense,
      result: income - expense,
    }
  }, [filtered, NEUTRAL_TYPES])

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
    const patch = { ...modalPatch }
    const catChanged = patch.macroCategoryId !== modalTx.macroCategoryId
    const subChanged = patch.subCategoryId !== modalTx.subCategoryId
    if (catChanged || subChanged) {
      patch.manualCategoryOverride = true
      patch.manualSubCategoryOverride = !!patch.subCategoryId
      patch.manualEditedAt = new Date().toISOString()
      patch.categorySuggestionSource = 'manual'
      patch.categoryConfidence = 'high'
      patch.needsReview = false
      if (catChanged) {
        const macro = allMacros.find(m => m.id === patch.macroCategoryId)
        if (macro) {
          patch.classificationType = macro.classificationType
          patch.includeInOperationalResult = macro.displayInResult
          patch.includeInCashflow = macro.displayInCashflow
          patch.includeInBudget = macro.displayInBudget
        }
      }
    }
    updateTransaction(modalTx.id, patch)
    setModalTx(null)
  }

  function openInlineCat(tx: Transaction) {
    setInlineCatEdit({ id: tx.id, catId: tx.macroCategoryId ?? '' })
  }

  function openInlineDesc(tx: Transaction) {
    setInlineDescEdit({ id: tx.id, value: tx.description })
  }

  function saveInlineDesc(newDesc: string, txId: string) {
    const tx = transactions.find(t => t.id === txId)
    if (tx && newDesc.trim() && newDesc.trim() !== tx.description) {
      captureScrollAnchor(txId)
      updateTransaction(txId, { description: newDesc.trim() })
    }
    setInlineDescEdit(null)
  }

  function saveInlineCatWithSub(macroId: string | undefined, subId: string | undefined, txId: string) {
    const tx = transactions.find(t => t.id === txId)
    setInlineCatEdit(null)
    if (!tx) return
    const macro = macroId ? allMacros.find(m => m.id === macroId) : undefined
    updateTransaction(txId, {
      macroCategoryId: macroId,
      subCategoryId: subId,
      manualCategoryOverride: true,
      manualSubCategoryOverride: subId ? true : undefined,
      manualEditedAt: new Date().toISOString(),
      categorySuggestionSource: 'manual',
      categoryConfidence: 'high',
      needsReview: false,
      classificationType: macro?.classificationType ?? tx.classificationType,
      includeInOperationalResult: macro ? macro.displayInResult : tx.includeInOperationalResult,
      includeInCashflow: macro ? macro.displayInCashflow : tx.includeInCashflow,
      includeInBudget: macro ? macro.displayInBudget : tx.includeInBudget,
    })
    if (macroId && macroId !== (tx.macroCategoryId ?? '')) {
      const updatedTx: Transaction = {
        ...tx, macroCategoryId: macroId, subCategoryId: subId,
        classificationType: macro?.classificationType ?? tx.classificationType,
        categorySuggestionSource: 'manual',
      }
      const learnedRule = learnRuleFromTransaction(updatedTx, 'manual')
      const similar = findSimilarUncategorized(updatedTx, transactions)
      if (similar.highConfidence.length > 0) {
        for (const candidate of similar.highConfidence) {
          updateTransaction(candidate.id, {
            macroCategoryId: macroId,
            subCategoryId: learnedRule?.subCategoryId ?? subId,
            classificationType: macro?.classificationType ?? candidate.classificationType,
            includeInOperationalResult: macro ? macro.displayInResult : candidate.includeInOperationalResult,
            includeInCashflow: macro ? macro.displayInCashflow : candidate.includeInCashflow,
            includeInBudget: macro ? macro.displayInBudget : candidate.includeInBudget,
            categorySuggestionSource: 'rule', categoryConfidence: 'high', needsReview: false,
          })
        }
        if (learnedRule) incrementRuleUseCount(learnedRule.id)
        setSimilarToast({ count: similar.highConfidence.length, category: macro?.name ?? macroId })
        setTimeout(() => setSimilarToast(null), 5000)
      }
      if (similar.mediumConfidence.length > 0) {
        setSimilarModal({
          candidates: similar.mediumConfidence,
          macroCategoryId: macroId,
          subCategoryId: learnedRule?.subCategoryId ?? subId,
          classificationType: macro?.classificationType ?? tx.classificationType,
          ruleId: learnedRule?.id,
        })
        setSelectedSimilar(new Set(similar.mediumConfidence.map(t => t.id)))
      }
    }
  }


  function csvCell(v: string): string {
    const s = String(v ?? '')
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  function exportCsv() {
    const headers = ['Data', 'Descrição', 'Valor', 'Tipo', 'Classificação', 'Categoria', 'Subcategoria', 'Tags', 'Status']
    const rows = filtered.map(t => {
      const macroName = allMacros.find(m => m.id === t.macroCategoryId)?.name ?? ''
      const subName = t.subCategoryId ? (subCategories.find(s => s.id === t.subCategoryId)?.name ?? '') : ''
      return [
        t.transactionDate,
        t.description,
        (t.type === 'expense' ? '-' : '') + t.amount.toFixed(2),
        t.type === 'income' ? 'Receita' : 'Despesa',
        CLS_LABELS[t.classificationType] ?? t.classificationType,
        macroName, subName,
        (t.tags ?? []).join(' '),
        t.status,
      ].map(csvCell).join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lancamentos_${filterMonth || 'todos'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of transactions) t.tags?.forEach(tag => set.add(tag))
    return Array.from(set).sort()
  }, [transactions])

  const allInstitutions = useMemo(() => {
    const set = new Set<string>()
    for (const t of transactions) {
      if (t.source !== 'pluggy') continue
      const pInfo = pluggyAccountMap.get(t.accountId)
      const acc = pInfo?.name ?? t.pluggyAccountName
      if (acc) set.add(acc)
    }
    return Array.from(set).sort()
  }, [transactions, pluggyAccountMap])

  const hasFilters = !!(search || filterType || filterStatus || filterMacro || filterTag || filterInstitution || quickFilter)

  return (
    <main ref={mainRef} className="page-shell">
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

        {/* Summary cards */}
        {!isReviewMode && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div className="card" style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Receitas</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--pos)', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>+{formatBRL(summary.income)}</p>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Despesas</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--crit)', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>−{formatBRL(summary.expense)}</p>
            </div>
            <div className="card" style={{ padding: '14px 16px', background: 'var(--accent-soft)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Resultado</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: summary.result >= 0 ? 'var(--pos)' : 'var(--crit)', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>
                {summary.result >= 0 ? '+' : ''}{formatBRL(summary.result)}
              </p>
            </div>
          </div>
        )}

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
              {allMacros.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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

            <button
              onClick={() => {
                const next = !showStatusBadges
                setShowStatusBadges(next)
                localStorage.setItem('fin_show_status_badges', String(next))
              }}
              title={showStatusBadges ? 'Ocultar status das linhas' : 'Mostrar status das linhas'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: showStatusBadges ? 'var(--accent)' : 'var(--ink-2)', background: showStatusBadges ? 'var(--accent-soft)' : 'var(--well)', border: `1px solid ${showStatusBadges ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--ui)' }}
            >
              status
            </button>
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              title="Exportar lançamentos do filtro atual em CSV"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-2)', background: 'var(--well)', border: '1px solid var(--line)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--ui)', marginLeft: 'auto' }}
            >
              <Download size={12} /> CSV
            </button>
          </div>
        )}

        {/* ── Quick filter pills ── */}
        {!isReviewMode && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(['no_category', 'pluggy', 'manual', 'neutral', 'high_value', 'with_tags', 'no_tags'] as QuickFilterKey[]).map(key => (
              <button
                key={key}
                onClick={() => { setQuickFilter(q => q === key ? '' : key); setPage(0) }}
                className={`filter-pill${quickFilter === key ? ' active' : ''}`}
              >
                {QUICK_FILTER_LABELS[key]}
              </button>
            ))}
          </div>
        )}

        {/* ── Ledger grouped by day ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {grouped.length === 0 ? (
            <div className="empty-state">
              <div className="empty-glyph" />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Nenhum lançamento encontrado</h4>
              {filterMonth && transactions.length > 0 ? (
                <>
                  <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 260, marginBottom: 10 }}>
                    Não há lançamentos em <strong>{filterMonth}</strong>. Existem {transactions.length} lançamentos em outros meses.
                  </p>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setFilterMonth(''); setPage(0) }}
                  >
                    Ver todos os meses
                  </button>
                </>
              ) : (
                <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 220 }}>
                  Ajuste os filtros ou importe um extrato.
                </p>
              )}
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
                    <Fragment key={date}>
                      {/* Day group header */}
                      <tr style={{ background: 'var(--well)' }}>
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
                        const macro = allMacros.find(m => m.id === tx.macroCategoryId)
                        const sub = tx.subCategoryId
                          ? subCategories.find(s => s.id === tx.subCategoryId) ??
                            (CATEGORIES.find(c => c.id === tx.subCategoryId) ? { id: tx.subCategoryId, name: CATEGORIES.find(c => c.id === tx.subCategoryId)!.name, macroCategoryId: tx.macroCategoryId ?? '', essentiality: 'inherit' as const, active: true, createdAt: '' } : null)
                          : null
                        const reviewItem = isReviewMode ? reviewItems.find(i => i.tx.id === tx.id) : undefined
                        const isInlineCat = inlineCatEdit?.id === tx.id
                        const isInlineDesc = inlineDescEdit?.id === tx.id

                        return (
                          <tr
                            key={tx.id}
                            data-transaction-id={tx.id}
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
                                  onBlur={() => { captureScrollAnchor(tx.id); saveInlineDesc(inlineDescEdit.value, tx.id) }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') { captureScrollAnchor(tx.id); saveInlineDesc(inlineDescEdit.value, tx.id) }
                                    if (e.key === 'Escape') { captureScrollAnchor(tx.id); setInlineDescEdit(null) }
                                  }}
                                  style={{ fontSize: 12.5, fontWeight: 600, width: '100%', background: 'var(--paper)', border: '1px solid var(--accent)', borderRadius: 5, padding: '2px 6px', outline: 'none', color: 'var(--ink)', fontFamily: 'var(--ui)' }}
                                />
                              ) : (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    {(tx.tags ?? []).map(tag => (
                                      <span
                                        key={tag}
                                        title={`Filtrar por #${tag}`}
                                        onClick={() => setFilterTag(tag)}
                                        style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'var(--well)', border: '1px solid var(--line)', color: 'var(--ink-2)', cursor: 'pointer', flexShrink: 0 }}
                                      >#{tag}</span>
                                    ))}
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
                                    {showStatusBadges && (tx.manualCategoryOverride || tx.manualTextOverride) && (
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--pos-soft)', color: 'var(--pos)', border: '1px solid var(--pos)30', flexShrink: 0 }}>
                                        editado
                                      </span>
                                    )}
                                    {showStatusBadges && tx.status === 'pending' && (
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--warn-soft, #fef3c7)', color: 'var(--warn)', flexShrink: 0 }}>
                                        pendente
                                      </span>
                                    )}
                                    {showStatusBadges && tx.categorySuggestionSource === 'rule' && (
                                      <span title="Classificado por regra aprendida" style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--accent-soft)', color: 'var(--accent)', flexShrink: 0 }}>
                                        regra
                                      </span>
                                    )}
                                    {showStatusBadges && tx.classificationType === 'neutral' && (
                                      <span title="Movimento neutro — fora do resultado/orçamento" style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--well)', color: 'var(--faint)', border: '1px solid var(--line)', flexShrink: 0 }}>
                                        neutro
                                      </span>
                                    )}
                                    {showStatusBadges && tx.needsReview && (
                                      <span title="Precisa revisar" style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--warn-soft, #fef3c7)', color: 'var(--warn)', flexShrink: 0 }}>
                                        revisar
                                      </span>
                                    )}
                                    {showStatusBadges && tx.installmentCurrent && tx.installmentTotal && (
                                      <span title={`Parcela ${tx.installmentCurrent} de ${tx.installmentTotal}`} style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--accent-soft)', color: 'var(--accent)', flexShrink: 0 }}>
                                        {tx.installmentCurrent}/{tx.installmentTotal}
                                      </span>
                                    )}
                                  </div>
                                  {tx.source === 'pluggy' && (() => {
                                    const pInfo = pluggyAccountMap.get(tx.accountId)
                                    const account = pInfo?.name ?? tx.pluggyAccountName
                                    if (!account) return null
                                    return (
                                      <div style={{ marginTop: 2 }}>
                                        <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                                          {account}
                                        </span>
                                      </div>
                                    )
                                  })()}
                                </>
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
                                <CategorySelector
                                  macroCategoryId={tx.macroCategoryId}
                                  subCategoryId={tx.subCategoryId}
                                  allMacros={allMacros}
                                  subCategories={subCategories}
                                  defaultOpen
                                  onClose={() => setInlineCatEdit(null)}
                                  onChange={(macroId, subId) => {
                                    captureScrollAnchor(tx.id)
                                    saveInlineCatWithSub(macroId, subId, tx.id)
                                  }}
                                />
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
                                      display: 'inline-flex', alignItems: 'center', gap: 5,
                                      fontSize: 10, padding: '2px 7px', borderRadius: 4,
                                      border: `1px solid ${macro.color}50`, color: macro.color,
                                      fontWeight: 600, background: `${macro.color}12`,
                                    }}>
                                      <TxCatIcon iconName={sub?.icon ?? macro.icon} size={11} color={macro.color} />
                                      {macro.name}
                                      {sub && (
                                        <span style={{ color: `${macro.color}bb`, fontWeight: 500 }}>
                                          › {sub.name}
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 600, padding: '2px 4px', borderRadius: 4, border: '1px dashed var(--line)', whiteSpace: 'nowrap' }}>
                                      A classificar
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Actions — direct icons */}
                            <td className="table-td" style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <button
                                  onClick={e => { e.stopPropagation(); openModal(tx) }}
                                  aria-label="Editar"
                                  title="Editar"
                                  style={{ display: 'flex', alignItems: 'center', color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 5 }}
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    if (window.confirm('Excluir este lançamento?')) {
                                      updateTransaction(tx.id, { status: 'cancelled' })
                                    }
                                  }}
                                  aria-label="Excluir"
                                  title="Excluir"
                                  style={{ display: 'flex', alignItems: 'center', color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 5 }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
                {filtered.length > 0 && (() => {
                  // Brutal sum: every visible item, sign matches display (expense = negative)
                  const filteredTotal = filtered.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0)
                  const totalColor = filteredTotal > 0 ? 'var(--pos)' : filteredTotal < 0 ? 'var(--crit)' : 'var(--faint)'
                  return (
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--line)' }}>
                        <td className="table-td" style={{ fontWeight: 700, fontSize: 12, color: 'var(--faint)', paddingTop: 10 }}>
                          Total filtrado ({filtered.length})
                        </td>
                        <td className="table-td table-th-right" style={{ fontWeight: 800, fontSize: 13, color: totalColor, paddingTop: 10, whiteSpace: 'nowrap' }}>
                          {filteredTotal >= 0 ? '+' : ''}{formatBRL(filteredTotal)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )
                })()}
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
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>
                  Editar lançamento
                  {modalTx.installmentCurrent && modalTx.installmentTotal && (
                    <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 8, padding: '2px 7px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent)', verticalAlign: 'middle' }}>
                      Parcela {modalTx.installmentCurrent}/{modalTx.installmentTotal}
                    </span>
                  )}
                </h2>
              </div>
              <button onClick={() => setModalTx(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            {/* Type toggle */}
            <div style={{ display: 'flex', gap: 6, padding: '4px', background: 'var(--well)', borderRadius: 9, border: '1px solid var(--line)' }}>
              {(['income', 'expense'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setModalPatch(p => ({ ...p, type: t }))}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, fontFamily: 'var(--ui)',
                    background: (modalPatch.type ?? modalTx.type) === t ? 'var(--card-bg)' : 'transparent',
                    color: (modalPatch.type ?? modalTx.type) === t
                      ? (t === 'income' ? 'var(--pos)' : 'var(--crit)')
                      : 'var(--faint)',
                    boxShadow: (modalPatch.type ?? modalTx.type) === t ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
                    transition: 'all .15s',
                  }}
                >
                  {t === 'income' ? 'Receita' : 'Despesa'}
                </button>
              ))}
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

              <ModalField label="Status">
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

              <ModalField label="Categoria">
                <CategorySelector
                  macroCategoryId={modalPatch.macroCategoryId}
                  subCategoryId={modalPatch.subCategoryId}
                  allMacros={allMacros}
                  subCategories={subCategories}
                  onChange={(macroId, subId) => setModalPatch(p => ({ ...p, macroCategoryId: macroId, subCategoryId: subId }))}
                />
              </ModalField>

              {modalPatch.macroCategoryId && (() => {
                const staticSubs = CATEGORIES.filter(c => c.macroCategoryId === modalPatch.macroCategoryId && c.active)
                const userSubs = subCategories.filter(s => s.macroCategoryId === modalPatch.macroCategoryId && s.active)
                const staticIds = new Set(staticSubs.map(s => s.id))
                const allSubs = [...staticSubs, ...userSubs.filter(s => !staticIds.has(s.id))].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                if (allSubs.length === 0) return null
                return (
                  <ModalField label="Subcategoria">
                    <select
                      value={modalPatch.subCategoryId ?? ''}
                      onChange={e => setModalPatch(p => ({ ...p, subCategoryId: e.target.value || undefined }))}
                      className="ledger-select"
                      style={{ width: '100%', fontSize: 12 }}
                    >
                      <option value="">— nenhuma —</option>
                      {allSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </ModalField>
                )
              })()}

              <ModalField label="Classificação">
                <select
                  value={modalPatch.classificationType ?? modalTx?.classificationType ?? ''}
                  onChange={e => setModalPatch(p => ({ ...p, classificationType: e.target.value as ClassificationType }))}
                  className="ledger-select"
                  style={{ width: '100%', fontSize: 12 }}
                >
                  <option value="">— automático —</option>
                  <option value="operational_income">Receita operacional</option>
                  <option value="extraordinary_income">Receita eventual</option>
                  <option value="operational_expense">Despesa operacional</option>
                  <option value="debt_cost">Custo de dívida</option>
                  <option value="investment">Investimento</option>
                  <option value="redemption">Resgate</option>
                  <option value="transfer">Transferência</option>
                  <option value="reimbursement">Reembolso</option>
                  <option value="neutral">Neutra</option>
                  <option value="adjustment">Ajuste</option>
                </select>
              </ModalField>

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

      {/* Similar-category toast */}
      {similarToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 400, background: 'var(--card-bg)', border: '1px solid var(--pos)',
          borderRadius: 10, padding: '11px 18px', boxShadow: '0 6px 24px rgba(0,0,0,.15)',
          display: 'flex', alignItems: 'center', gap: 12, maxWidth: 420,
        }}>
          <p style={{ fontSize: 12.5, color: 'var(--ink)', flex: 1 }}>
            <strong>{similarToast.count}</strong> lançamento{similarToast.count !== 1 ? 's' : ''} semelhante{similarToast.count !== 1 ? 's' : ''} sem categoria {similarToast.count !== 1 ? 'receberam' : 'recebeu'} <strong>{similarToast.category}</strong> automaticamente.
          </p>
          <button onClick={() => setSimilarToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Similar-category modal (medium confidence) */}
      {similarModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(16,15,10,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setSimilarModal(null)}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 540, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Lançamentos parecidos sem categoria</p>
              <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3 }}>
                Somente lançamentos sem categoria e sem ajuste manual serão alterados.
              </p>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
              Categoria proposta: <strong>{allMacros.find(m => m.id === similarModal.macroCategoryId)?.name ?? similarModal.macroCategoryId}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
              {similarModal.candidates.map(tx => (
                <label key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--line)', cursor: 'pointer', background: selectedSimilar.has(tx.id) ? 'var(--accent-soft)' : 'var(--well)' }}>
                  <input
                    type="checkbox"
                    checked={selectedSimilar.has(tx.id)}
                    onChange={e => {
                      const s = new Set(selectedSimilar)
                      e.target.checked ? s.add(tx.id) : s.delete(tx.id)
                      setSelectedSimilar(s)
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</p>
                    <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 1 }}>{tx.transactionDate} · {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSimilarModal(null)}>Ignorar</button>
              <button
                className="btn btn-primary btn-sm"
                disabled={selectedSimilar.size === 0}
                onClick={() => {
                  const macro = allMacros.find(m => m.id === similarModal.macroCategoryId)
                  for (const tx of similarModal.candidates) {
                    if (!selectedSimilar.has(tx.id)) continue
                    updateTransaction(tx.id, {
                      macroCategoryId: similarModal.macroCategoryId,
                      subCategoryId: similarModal.subCategoryId,
                      classificationType: similarModal.classificationType as Transaction['classificationType'],
                      categorySuggestionSource: 'rule',
                      categoryConfidence: 'medium',
                      needsReview: false,
                    })
                  }
                  if (similarModal.ruleId) {
                    incrementRuleUseCount(similarModal.ruleId)
                  }
                  setSimilarToast({ count: selectedSimilar.size, category: macro?.name ?? similarModal.macroCategoryId })
                  setTimeout(() => setSimilarToast(null), 5000)
                  setSimilarModal(null)
                }}
              >
                Aplicar aos selecionados ({selectedSimilar.size})
              </button>
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

