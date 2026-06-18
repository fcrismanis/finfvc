import React, { useState, useMemo, useEffect } from 'react'
import { AlertTriangle, Tag, Clock, CreditCard, Zap, X, ArrowLeft, Sparkles, CheckSquare, Square, Brain } from 'lucide-react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES, CATEGORIES } from '../config/categories'
import { formatBRL } from '../utils/currency'
import { getReviewItems } from '../utils/reviewItems'
import { generateFinancialReviewItems, countBySeverity } from '../utils/financialReview'
import type { FinancialReviewItem, FinancialReviewType } from '../utils/financialReview'
import { lookupPluggyCategory } from '../services/pluggy.service'
import { suggestTags, buildTagContext } from '../services/tagSuggester'
import { isManualTx } from '../utils/dataQuality'
import { canAutoCategorize, learnRuleFromTransaction } from '../services/categoryRules.service'
import { currentYearMonth, formatFinancialDateBR } from '../utils/date'
import type { ReviewReason } from '../utils/reviewItems'
import type { Transaction, ClassificationType } from '../types'
import { suggestCategories, buildClipboardPrompt } from '../services/categorize.service'
import { CategorySelector } from '../components/CategorySelector'
import { getAllMacroCategories } from '../services/financeParentCategories.service'

interface AISuggestion {
  id: string
  macroCategoryId: string
  subCategoryId?: string | null
  classificationType: ClassificationType
  tags: string[]
  confidence: 'high' | 'medium' | 'low'
  reason: string
  rulePattern: string
}

interface Props {
  onNavigate?: (route: string) => void
}

type ActivePanel = ReviewReason | 'all' | 'import_api' | null

const CLS_LABELS: Record<ClassificationType, string> = {
  operational_income: 'Receita Op.', extraordinary_income: 'Rec. Eventual',
  operational_expense: 'Desp. Op.', debt_cost: 'Dívida',
  investment: 'Investimento', redemption: 'Resgate',
  transfer: 'Transferência', reimbursement: 'Reembolso',
  adjustment: 'Ajuste', neutral: 'Neutro',
}

const SUGGESTION_SOURCE_LABEL: Record<NonNullable<Transaction['categorySuggestionSource']>, string> = {
  pluggy_id:      'Pluggy categoryId',
  pluggy_name:    'Pluggy category',
  text_inference: 'Inferência por texto',
  history:        'Histórico',
  rule:           'Regra aprendida',
  ai:             'IA',
  command:        'Comando',
  manual:         'Manual',
  none:           '—',
}

const CONFIDENCE_META: Record<NonNullable<Transaction['categoryConfidence']>, { label: string; color: string }> = {
  high:   { label: 'alta confiança',  color: 'var(--pos)' },
  medium: { label: 'média confiança', color: 'var(--warn)' },
  low:    { label: 'baixa confiança', color: 'var(--faint)' },
}

/** Deriva a origem da sugestão; usa o campo persistido e cai para heurística em lançamentos legados. */
function deriveSuggestionSource(tx: Transaction): string | null {
  if (tx.categorySuggestionSource && tx.categorySuggestionSource !== 'none') {
    return SUGGESTION_SOURCE_LABEL[tx.categorySuggestionSource]
  }
  if (tx.manualCategoryOverride || tx.manualSubCategoryOverride) return SUGGESTION_SOURCE_LABEL.manual
  if (tx.pluggyCategoryMapped && tx.pluggyCategoryId) return SUGGESTION_SOURCE_LABEL.pluggy_id
  if (tx.pluggyCategoryMapped && tx.pluggyCategory)   return SUGGESTION_SOURCE_LABEL.pluggy_name
  if (tx.categoryConfidence === 'low')                return SUGGESTION_SOURCE_LABEL.text_inference
  return null
}

export function Review({ onNavigate: _onNavigate }: Props) {
  const { transactions, updateTransaction, updateTransactions, subCategories } = useData()
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [modalTx, setModalTx] = useState<Transaction | null>(null)
  const [modalPatch, setModalPatch] = useState<Partial<Transaction>>({})
  const [applyingAll, setApplyingAll] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[] | null>(null)
  const [dismissedAI, setDismissedAI] = useState<Set<string>>(new Set())
  const [panelSearch, setPanelSearch] = useState('')
  const [applyToSimilar, setApplyToSimilar] = useState(false)

  useEffect(() => { setSelected(new Set()); setPanelSearch('') }, [activePanel])

  const tagCtx = useMemo(() => buildTagContext(transactions), [transactions])

  const reviewItems = useMemo(() => getReviewItems(transactions), [transactions])

  const pluggyItems = useMemo(() =>
    transactions.filter(t => t.origin === 'import_api'),
    [transactions]
  )

  const suggestions = useMemo(() =>
    suggestCategories(pluggyItems.filter(t => !t.macroCategoryId)),
    [pluggyItems]
  )

  // Intelligent review (Fase 2.1)
  const intelligentItems = useMemo(
    () => generateFinancialReviewItems(transactions, currentYearMonth()),
    [transactions],
  )
  const intelligentCounts = useMemo(() => countBySeverity(intelligentItems), [intelligentItems])
  const [intelligentFilter, setIntelligentFilter] = useState<'all' | FinancialReviewType | 'severity_high' | 'severity_medium' | 'severity_low'>('all')
  const [dismissedIntelligent, setDismissedIntelligent] = useState<Set<string>>(new Set())

  const filteredIntelligent = useMemo(() => {
    const visible = intelligentItems.filter(i => !dismissedIntelligent.has(i.id))
    if (intelligentFilter === 'all') return visible
    if (intelligentFilter === 'severity_high') return visible.filter(i => i.severity === 'high')
    if (intelligentFilter === 'severity_medium') return visible.filter(i => i.severity === 'medium')
    if (intelligentFilter === 'severity_low') return visible.filter(i => i.severity === 'low')
    return visible.filter(i => i.type === intelligentFilter)
  }, [intelligentItems, intelligentFilter, dismissedIntelligent])

  const counts = useMemo(() => ({
    all:          reviewItems.length,
    no_category:  reviewItems.filter(i => i.tags.includes('no_category')).length,
    pending:      reviewItems.filter(i => i.tags.includes('pending')).length,
    transfer:     reviewItems.filter(i => i.tags.includes('transfer')).length,
    high_value:   reviewItems.filter(i => i.tags.includes('high_value')).length,
    needs_review: reviewItems.filter(i => i.tags.includes('needs_review')).length,
    import_api:   pluggyItems.length,
  }), [reviewItems, pluggyItems])

  const panelItems = useMemo(() => {
    if (!activePanel) return []
    if (activePanel === 'all') return reviewItems
    if (activePanel === 'import_api') return []  // handled separately
    return reviewItems.filter(i => i.tags.includes(activePanel as ReviewReason))
  }, [reviewItems, activePanel])

  const filteredPanelItems = useMemo(() => {
    const q = panelSearch.trim().toLowerCase()
    if (!q) return panelItems
    return panelItems.filter(i =>
      i.tx.description.toLowerCase().includes(q) ||
      (MACRO_CATEGORIES.find(m => m.id === i.tx.macroCategoryId)?.name ?? '').toLowerCase().includes(q)
    )
  }, [panelItems, panelSearch])

  function applySuggestion(tx: Transaction) {
    const s = suggestions.get(tx.id)
    if (!s) return
    updateTransaction(tx.id, {
      macroCategoryId:    s.macroCategoryId,
      categoryId:         s.categoryId,
      classificationType: s.classificationType,
    })
  }

  /**
   * Apply every high-confidence suggestion in one batch:
   *  - history/text suggestions flagged 'high'
   *  - Pluggy categoryId map (confidence 'high')
   * Manual overrides are protected (skipped). Auto application → markManual:false.
   */
  async function applyAllSuggestions() {
    setApplyingAll(true)
    const items: Array<{ id: string; patch: Partial<Transaction> }> = []
    for (const tx of pluggyItems) {
      if (isManualTx(tx)) continue
      if (tx.macroCategoryId && !tx.needsReview) continue

      const s = suggestions.get(tx.id)
      if (s && s.confidence === 'high') {
        items.push({ id: tx.id, patch: {
          macroCategoryId: s.macroCategoryId,
          categoryId: s.categoryId || undefined,
          subCategoryId: s.subCategoryId,
          classificationType: s.classificationType,
          needsReview: false,
        } })
        continue
      }
      const pluggy = lookupPluggyCategory(tx.pluggyCategoryId ?? null, tx.pluggyCategory ?? null)
      if (pluggy && pluggy.confidence === 'high') {
        items.push({ id: tx.id, patch: {
          macroCategoryId: pluggy.macroCategoryId,
          subCategoryId: pluggy.subCategoryId,
          subCategoryNameSuggested: pluggy.subCategoryNameSuggested,
          classificationType: pluggy.classificationType,
          includeInOperationalResult: pluggy.includeInOperationalResult,
          includeInBudget: pluggy.includeInBudget,
          includeInCashflow: pluggy.includeInCashflow,
          isInternalTransfer: pluggy.isInternalTransfer ?? false,
          pluggyCategoryMapped: true,
          categoryConfidence: 'high',
          categorySuggestionSource: 'pluggy_id',
          needsReview: false,
        } })
      }
    }
    if (items.length) await updateTransactions(items, { markManual: false })
    setApplyingAll(false)
  }

  // ── Bulk selection + actions ────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll(ids: string[]) {
    setSelected(prev => {
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id))
      if (allSelected) {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      }
      return new Set([...prev, ...ids])
    })
  }

  function clearSelection() { setSelected(new Set()) }

  /** Build + apply a patch over the current selection, then clear it. */
  async function applyToSelected(
    build: (tx: Transaction) => Partial<Transaction> | null,
    opts?: { markManual?: boolean },
  ) {
    const items: Array<{ id: string; patch: Partial<Transaction> }> = []
    for (const id of selected) {
      const tx = transactions.find(t => t.id === id)
      if (!tx) continue
      const patch = build(tx)
      if (patch) items.push({ id, patch })
    }
    if (items.length) await updateTransactions(items, opts)
    clearSelection()
  }

  function bulkApplyCategory(macroId: string) {
    if (!macroId) return
    void applyToSelected(() => ({ macroCategoryId: macroId, subCategoryId: undefined, needsReview: false }), { markManual: true })
  }

  function bulkApplySubcategory(subId: string) {
    if (!subId) return
    const sub = subCategories.find(s => s.id === subId)
    void applyToSelected(() => ({
      subCategoryId: subId,
      ...(sub ? { macroCategoryId: sub.macroCategoryId } : {}),
      needsReview: false,
    }), { markManual: true })
  }

  function bulkAddTag(tag: string) {
    const t = tag.trim().toLowerCase().replace(/\s+/g, '_')
    if (!t) return
    void applyToSelected(tx => {
      const tags = [...(tx.tags ?? [])]
      if (tags.includes(t)) return null
      tags.push(t)
      return { tags }
    })
  }

  function bulkRemoveTag(tag: string) {
    const t = tag.trim().toLowerCase().replace(/\s+/g, '_')
    if (!t) return
    void applyToSelected(tx => (tx.tags?.includes(t) ? { tags: tx.tags.filter(x => x !== t) } : null))
  }

  function bulkMarkReviewed() {
    void applyToSelected(() => ({ needsReview: false }))
  }

  function bulkMarkNeutral() {
    void applyToSelected(() => ({
      classificationType: 'neutral',
      macroCategoryId: 'mac_movfin',
      includeInBudget: false,
      includeInOperationalResult: false,
      includeInCashflow: true,
      isInternalTransfer: false,
      needsReview: false,
    }), { markManual: true })
  }

  function bulkApplyClassification(cls: ClassificationType) {
    if (!cls) return
    void applyToSelected(() => ({ classificationType: cls, needsReview: false }), { markManual: true })
  }

  function bulkApplySuggestedTags() {
    void applyToSelected(tx => {
      const sugg = suggestTags(tx, tagCtx)
      if (sugg.length === 0) return null
      return { tags: Array.from(new Set([...(tx.tags ?? []), ...sugg])) }
    })
  }

  function copyPendingToClipboard() {
    const uncategorized = pluggyItems.filter(t => !t.macroCategoryId)
    const prompt = buildClipboardPrompt(uncategorized)
    navigator.clipboard.writeText(prompt).catch(() => {/* ignore */})
  }

  async function categorizeWithAI() {
    const candidates = transactions.filter(t =>
      canAutoCategorize(t) && (!t.macroCategoryId || t.needsReview || t.categoryConfidence === 'low')
    )
    if (candidates.length === 0) {
      setAiError('Nenhuma transação pendente de categorização (sem manual override).')
      return
    }
    setAiLoading(true)
    setAiError(null)
    setAiSuggestions(null)
    try {
      const res = await fetch('http://localhost:8787/api/ai/categorize-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: candidates.slice(0, 80),
          categories: MACRO_CATEGORIES.map(m => ({ id: m.id, name: m.name, classificationType: m.classificationType })),
          subCategories: subCategories.map(s => ({ id: s.id, name: s.name, macroCategoryId: s.macroCategoryId })),
          rules: [],
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
          setAiError(data.error ?? 'Nenhuma IA configurada. Configure ANTHROPIC_API_KEY, OPENAI_API_KEY ou rode Ollama local (ollama serve).')
        return
      }
      setAiSuggestions((data.suggestions as AISuggestion[]) ?? [])
      setDismissedAI(new Set())
    } catch {
      setAiError('Falha de conexão com o servidor backend (localhost:8787). Verifique se está rodando.')
    } finally {
      setAiLoading(false)
    }
  }

  function applyAISuggestion(sugg: AISuggestion) {
    const tx = transactions.find(t => t.id === sugg.id)
    if (!tx || !canAutoCategorize(tx)) return
    updateTransaction(tx.id, {
      macroCategoryId: sugg.macroCategoryId,
      subCategoryId: sugg.subCategoryId ?? undefined,
      classificationType: sugg.classificationType,
      tags: Array.from(new Set([...(tx.tags ?? []), ...(sugg.tags ?? [])])),
      categorySuggestionSource: 'ai',
      categoryConfidence: sugg.confidence,
      needsReview: sugg.confidence !== 'high',
    })
    if (sugg.rulePattern) {
      learnRuleFromTransaction(
        { ...tx, macroCategoryId: sugg.macroCategoryId, subCategoryId: sugg.subCategoryId ?? undefined, classificationType: sugg.classificationType },
        'ai',
      )
    }
    setDismissedAI(prev => { const n = new Set(prev); n.add(sugg.id); return n })
  }

  async function applyAllHighAI() {
    if (!aiSuggestions) return
    const highConf = aiSuggestions.filter(s => s.confidence === 'high' && !dismissedAI.has(s.id))
    const items: Array<{ id: string; patch: Partial<Transaction> }> = []
    for (const sugg of highConf) {
      const tx = transactions.find(t => t.id === sugg.id)
      if (!tx || !canAutoCategorize(tx)) continue
      items.push({ id: sugg.id, patch: {
        macroCategoryId: sugg.macroCategoryId,
        subCategoryId: sugg.subCategoryId ?? undefined,
        classificationType: sugg.classificationType,
        tags: Array.from(new Set([...(tx.tags ?? []), ...(sugg.tags ?? [])])),
        categorySuggestionSource: 'ai',
        categoryConfidence: 'high',
        needsReview: false,
      } })
      if (sugg.rulePattern) {
        learnRuleFromTransaction(
          { ...tx, macroCategoryId: sugg.macroCategoryId, subCategoryId: sugg.subCategoryId ?? undefined, classificationType: sugg.classificationType },
          'ai',
        )
      }
    }
    if (items.length) await updateTransactions(items, { markManual: false })
    setDismissedAI(prev => new Set([...prev, ...highConf.map(s => s.id)]))
  }


  function openModal(tx: Transaction) {
    setModalTx(tx)
    setApplyToSimilar(false)
    setModalPatch({
      description: tx.description,
      status: tx.status,
      classificationType: tx.classificationType,
      macroCategoryId: tx.macroCategoryId,
      subCategoryId: tx.subCategoryId,
      notes: tx.notes ?? '',
      competenceDate: tx.competenceDate,
    })
  }

  function saveModal() {
    if (!modalTx) return
    updateTransaction(modalTx.id, modalPatch)
    if (applyToSimilar && modalPatch.macroCategoryId) {
      const norm = modalTx.description.trim().toLowerCase()
      const similar = transactions.filter(t => t.id !== modalTx.id && t.description.trim().toLowerCase() === norm)
      if (similar.length) {
        void updateTransactions(
          similar.map(t => ({ id: t.id, patch: { macroCategoryId: modalPatch.macroCategoryId, subCategoryId: modalPatch.subCategoryId, classificationType: modalPatch.classificationType, needsReview: false } })),
          { markManual: true },
        )
      }
    }
    setModalTx(null)
  }

  const TRIAGE_CARDS: Array<{
    key: ActivePanel
    label: string
    description: string
    icon: React.ReactNode
    color: string
    count: number
  }> = [
    {
      key: 'no_category',
      label: 'Sem categoria',
      description: 'Lançamentos sem macro categoria definida',
      icon: <Tag size={18} />,
      color: 'var(--warn)',
      count: counts.no_category,
    },
    {
      key: 'pending',
      label: 'Pendentes',
      description: 'Compromissos futuros não confirmados',
      icon: <Clock size={18} />,
      color: 'var(--ink-2)',
      count: counts.pending,
    },
    {
      key: 'transfer',
      label: 'Possíveis transferências',
      description: 'Movimentações internas que podem duplicar despesas',
      icon: <CreditCard size={18} />,
      color: 'var(--faint)',
      count: counts.transfer,
    },
    {
      key: 'high_value',
      label: 'Alto valor',
      description: 'Despesas acima da média × 4 ou acima de R$ 2.000',
      icon: <AlertTriangle size={18} />,
      color: 'var(--crit)',
      count: counts.high_value,
    },
    {
      key: 'needs_review',
      label: 'Precisa revisar',
      description: 'Classificações atípicas que merecem atenção',
      icon: <Zap size={18} />,
      color: 'var(--accent)',
      count: counts.needs_review,
    },
    {
      key: 'import_api' as ActivePanel,
      label: 'Importadas via Pluggy',
      description: `${suggestions.size} com sugestão de categoria automática`,
      icon: <Sparkles size={18} />,
      color: 'var(--pos)',
      count: counts.import_api,
    },
  ]

  return (
    <main className="page-shell">
      <div className="page-content section-gap">

        {/* ── Header ── */}
        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Revisão</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Central de triagem — {counts.all} {counts.all === 1 ? 'item precisa' : 'itens precisam'} de atenção
          </div>
        </div>

        {/* ── Revisão Inteligente (Fase 2.1) ── */}
        {!activePanel && intelligentItems.length > 0 && (
          <IntelligentReviewPanel
            items={intelligentItems}
            filteredItems={filteredIntelligent}
            counts={intelligentCounts}
            filter={intelligentFilter}
            dismissed={dismissedIntelligent}
            onFilterChange={setIntelligentFilter}
            onDismiss={id => setDismissedIntelligent(prev => new Set([...prev, id]))}
            onNavigateToTx={txId => {
              const tx = transactions.find(t => t.id === txId)
              if (tx) openModal(tx)
            }}
          />
        )}

        {/* ── Triage cards ── */}
        {!activePanel && (
          <>
            <div className="stats-grid-3" style={{ gap: 12 }}>
              {TRIAGE_CARDS.map(card => (
                <button
                  key={card.key as string}
                  onClick={() => card.count > 0 && setActivePanel(card.key)}
                  disabled={card.count === 0}
                  style={{
                    textAlign: 'left', background: 'var(--card-bg)',
                    border: `1px solid ${card.count > 0 ? card.color + '55' : 'var(--line)'}`,
                    borderRadius: 12, padding: '16px 18px', cursor: card.count > 0 ? 'pointer' : 'default',
                    opacity: card.count === 0 ? 0.4 : 1,
                    transition: 'border-color .15s, box-shadow .15s',
                    fontFamily: 'var(--ui)',
                  }}
                  onMouseEnter={e => { if (card.count > 0) (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(0,0,0,.08)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: card.color }}>{card.icon}</span>
                    <span style={{
                      fontSize: 18, fontWeight: 800, color: card.count > 0 ? card.color : 'var(--faint)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {card.count}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{card.label}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>{card.description}</p>
                </button>
              ))}

              {/* All items card */}
              <button
                onClick={() => setActivePanel('all')}
                disabled={counts.all === 0}
                style={{
                  textAlign: 'left', background: counts.all > 0 ? 'var(--accent-soft)' : 'var(--card-bg)',
                  border: '1px solid var(--line)',
                  borderRadius: 12, padding: '16px 18px', cursor: counts.all > 0 ? 'pointer' : 'default',
                  opacity: counts.all === 0 ? 0.4 : 1,
                  fontFamily: 'var(--ui)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: 'var(--ink-2)', fontSize: 18 }}>⚡</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {counts.all}
                  </span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Todos os itens</p>
                <p style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>Ver tudo que precisa de revisão</p>
              </button>
            </div>

            {counts.all === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--pos)', marginBottom: 8 }}>Tudo revisado!</h3>
                <p style={{ fontSize: 13, color: 'var(--faint)' }}>Nenhum lançamento precisa de atenção no momento.</p>
              </div>
            )}
          </>
        )}

        {/* ── Active panel: list ── */}
        {activePanel && (
          <>
            {/* Back to triage cards */}
            <button
              onClick={() => setActivePanel(null)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
                background: 'var(--well)', border: '1px solid var(--line)',
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                fontFamily: 'var(--ui)', alignSelf: 'flex-start',
              }}
            >
              <ArrowLeft size={13} />
              Voltar para Revisão
            </button>

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              {activePanel === 'import_api' ? pluggyItems.length : panelItems.length}&nbsp;
              {(activePanel === 'import_api' ? pluggyItems.length : panelItems.length) === 1 ? 'item' : 'itens'} · {
                activePanel === 'all' ? 'Todos os itens' :
                activePanel === 'import_api' ? 'Importadas via Pluggy' :
                TRIAGE_CARDS.find(c => c.key === activePanel)?.label ?? activePanel
              }
            </div>

            {/* ── Pluggy import panel ── */}
            {activePanel === 'import_api' && (
              <>
                {pluggyItems.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                      {suggestions.size} com sugestão de histórico · marque linhas para ações em lote
                    </span>
                    <button
                      onClick={applyAllSuggestions}
                      disabled={applyingAll}
                      style={{
                        fontSize: 11.5, fontWeight: 700, color: '#fff',
                        background: 'var(--pos)', border: 'none', borderRadius: 7,
                        padding: '5px 14px', cursor: 'pointer', fontFamily: 'var(--ui)',
                      }}
                    >
                      {applyingAll ? 'Aplicando…' : 'Aplicar todas de alta confiança'}
                    </button>
                    {pluggyItems.filter(t => !t.macroCategoryId).length > 0 && (
                      <button
                        onClick={copyPendingToClipboard}
                        style={{
                          fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)',
                          background: 'var(--well)', border: '1px solid var(--line)', borderRadius: 7,
                          padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--ui)',
                        }}
                      >
                        Copiar pendências para ChatGPT
                      </button>
                    )}
                    <button
                      onClick={categorizeWithAI}
                      disabled={aiLoading}
                      title="Envia pendentes para IA e mostra sugestões de categoria para aprovação"
                      style={{
                        fontSize: 11.5, fontWeight: 700, color: '#fff',
                        background: 'var(--accent)', border: 'none', borderRadius: 7,
                        padding: '5px 14px', cursor: 'pointer', fontFamily: 'var(--ui)',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        opacity: aiLoading ? 0.65 : 1,
                      }}
                    >
                      <Brain size={13} />
                      {aiLoading ? 'Consultando IA…' : 'Categorizar com IA'}
                    </button>
                    {aiError && (
                      <span style={{ fontSize: 11, color: 'var(--crit)', fontWeight: 600 }}>{aiError}</span>
                    )}
                  </div>
                )}
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                      <thead>
                        <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                          <th className="table-th" style={{ width: 32 }}>
                            <button
                              onClick={() => toggleSelectAll(pluggyItems.map(t => t.id))}
                              aria-label="Selecionar todos"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', padding: 0, display: 'flex' }}
                            >
                              {pluggyItems.length > 0 && pluggyItems.every(t => selected.has(t.id))
                                ? <CheckSquare size={15} /> : <Square size={15} />}
                            </button>
                          </th>
                          <th className="table-th">Data</th>
                          <th className="table-th">Descrição</th>
                          <th className="table-th table-th-right">Valor</th>
                          <th className="table-th">Cat. Pluggy</th>
                          <th className="table-th">Categoria atual</th>
                          <th className="table-th">Sugestão</th>
                          <th style={{ width: 100 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {pluggyItems.map(tx => {
                          const macro   = MACRO_CATEGORIES.find(m => m.id === tx.macroCategoryId)
                          const sugg    = suggestions.get(tx.id)
                          const suggMacro = sugg ? MACRO_CATEGORIES.find(m => m.id === sugg.macroCategoryId) : null
                          const suggCat   = sugg ? CATEGORIES.find(c => c.id === sugg.categoryId) : null
                          const suggSource = deriveSuggestionSource(tx)
                          const confMeta   = tx.categoryConfidence ? CONFIDENCE_META[tx.categoryConfidence] : null
                          const isSel = selected.has(tx.id)
                          return (
                            <tr key={tx.id} className="table-row" style={{ background: isSel ? 'var(--accent-soft)' : undefined }}>
                              <td className="table-td">
                                <button
                                  onClick={() => toggleSelect(tx.id)}
                                  aria-label={isSel ? 'Desmarcar' : 'Selecionar'}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSel ? 'var(--accent)' : 'var(--faint)', padding: 0, display: 'flex' }}
                                >
                                  {isSel ? <CheckSquare size={15} /> : <Square size={15} />}
                                </button>
                              </td>
                              <td className="table-td" style={{ color: 'var(--faint)', whiteSpace: 'nowrap', fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
                                {formatFinancialDateBR(tx.competenceDate)}
                              </td>
                              <td className="table-td" style={{ maxWidth: 200 }}>
                                <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>
                                  {tx.description}
                                </p>
                                {tx.pluggyInstitutionName && (
                                  <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>{tx.pluggyInstitutionName}</p>
                                )}
                              </td>
                              <td className="table-td" style={{ whiteSpace: 'nowrap' }}>
                                {(tx.pluggyCategory || tx.pluggyCategoryId) ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {tx.pluggyCategory && (
                                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--well)', color: 'var(--ink-2)', fontWeight: 500, border: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
                                        {tx.pluggyCategory}
                                      </span>
                                    )}
                                    {tx.pluggyCategoryId && (
                                      <span style={{ fontSize: 9, color: 'var(--faint)', fontFamily: 'var(--mono)' }}>
                                        {tx.pluggyCategoryId}
                                      </span>
                                    )}
                                  </div>
                                ) : <span style={{ fontSize: 10, color: 'var(--faint)' }}>—</span>}
                              </td>
                              <td className="table-td table-th-right" style={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: tx.type === 'income' ? 'var(--pos)' : 'var(--crit)' }}>
                                {tx.type === 'expense' ? '−' : '+'}{formatBRL(tx.amount)}
                              </td>
                              <td className="table-td">
                                {macro ? (
                                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, border: `1px solid ${macro.color}50`, color: macro.color, fontWeight: 600, background: `${macro.color}12` }}>
                                    {macro.name}
                                  </span>
                                ) : <span style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 600 }}>Sem categoria</span>}
                              </td>
                              <td className="table-td">
                                {sugg && suggMacro ? (
                                  <div>
                                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, border: `1px solid ${suggMacro.color}50`, color: suggMacro.color, fontWeight: 600, background: `${suggMacro.color}12` }}>
                                      {suggCat?.name ?? suggMacro.name}
                                    </span>
                                    <span style={{ display: 'block', fontSize: 9.5, color: 'var(--faint)', marginTop: 2 }}>
                                      Histórico · {sugg.reason} · {sugg.confidence === 'high' ? 'alta confiança' : 'média confiança'}
                                    </span>
                                  </div>
                                ) : (tx.subCategoryNameSuggested || confMeta || suggSource) ? (
                                  <div>
                                    {tx.subCategoryNameSuggested && (
                                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '1px dashed var(--line)', color: 'var(--ink-2)', fontWeight: 600, background: 'var(--well)' }}>
                                        {tx.subCategoryNameSuggested}
                                      </span>
                                    )}
                                    <span style={{ display: 'block', fontSize: 9.5, color: 'var(--faint)', marginTop: 2 }}>
                                      {suggSource ?? 'Sugestão'}
                                      {confMeta && <> · <span style={{ color: confMeta.color, fontWeight: 600 }}>{confMeta.label}</span></>}
                                    </span>
                                  </div>
                                ) : <span style={{ fontSize: 10, color: 'var(--faint)' }}>—</span>}
                              </td>
                              <td className="table-td" style={{ whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {sugg && !tx.macroCategoryId && (
                                    <button
                                      onClick={() => applySuggestion(tx)}
                                      style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--pos)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                                    >
                                      Aplicar
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openModal(tx)}
                                    style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                                  >
                                    Editar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {pluggyItems.length === 0 && (
                          <tr><td colSpan={8}><div className="empty-state"><h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Nenhuma transação importada via Pluggy</h4></div></td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ── Standard review panel ── */}
            {activePanel !== 'import_api' && (
            <React.Fragment>
              {/* Search bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    value={panelSearch}
                    onChange={e => setPanelSearch(e.target.value)}
                    placeholder="Buscar por descrição ou categoria…"
                    className="login-field"
                    style={{ width: '100%', fontSize: 12.5, paddingLeft: 32 }}
                  />
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', pointerEvents: 'none', fontSize: 13 }}>🔍</span>
                </div>
                {panelSearch && (
                  <button onClick={() => setPanelSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', display: 'flex', padding: 4 }}>
                    <X size={14} />
                  </button>
                )}
                <span style={{ fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>
                  {filteredPanelItems.length} de {panelItems.length} · marque para editar em lote
                </span>
              </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                  <thead>
                    <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                      <th className="table-th" style={{ width: 32 }}>
                        <button
                          onClick={() => toggleSelectAll(filteredPanelItems.map(i => i.tx.id))}
                          aria-label="Selecionar todos"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', padding: 0, display: 'flex' }}
                        >
                          {filteredPanelItems.length > 0 && filteredPanelItems.every(i => selected.has(i.tx.id))
                            ? <CheckSquare size={15} /> : <Square size={15} />}
                        </button>
                      </th>
                      <th className="table-th">Data</th>
                      <th className="table-th">Descrição</th>
                      <th className="table-th table-th-right">Valor</th>
                      <th className="table-th">Categoria</th>
                      <th className="table-th">Atenção</th>
                      <th style={{ width: 64 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPanelItems.map(item => {
                      const macro = MACRO_CATEGORIES.find(m => m.id === item.tx.macroCategoryId)
                      const isSel = selected.has(item.tx.id)
                      return (
                        <tr key={item.tx.id} className="table-row" style={{ opacity: item.tx.status === 'pending' ? 0.7 : 1, background: isSel ? 'var(--accent-soft)' : undefined }}>
                          <td className="table-td">
                            <button
                              onClick={() => toggleSelect(item.tx.id)}
                              aria-label={isSel ? 'Desmarcar' : 'Selecionar'}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSel ? 'var(--accent)' : 'var(--faint)', padding: 0, display: 'flex' }}
                            >
                              {isSel ? <CheckSquare size={15} /> : <Square size={15} />}
                            </button>
                          </td>
                          <td className="table-td" style={{ color: 'var(--faint)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 11.5 }}>
                            {formatFinancialDateBR(item.tx.competenceDate)}
                          </td>
                          <td className="table-td" style={{ maxWidth: 240 }}>
                            <p
                              onClick={() => setPanelSearch(item.tx.description)}
                              title="Filtrar por esta descrição"
                              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer' }}
                            >
                              {item.tx.description}
                            </p>
                            <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>
                              {CLS_LABELS[item.tx.classificationType] ?? item.tx.classificationType}
                            </p>
                          </td>
                          <td className="table-td table-th-right" style={{
                            fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 13,
                            color: item.tx.type === 'income' ? 'var(--pos)' : 'var(--crit)',
                          }}>
                            {item.tx.type === 'expense' ? '−' : '+'}{formatBRL(item.tx.amount)}
                          </td>
                          <td className="table-td">
                            {macro ? (
                              <span
                                onClick={() => setPanelSearch(macro.name)}
                                title="Filtrar por esta categoria"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  fontSize: 10, padding: '2px 7px', borderRadius: 4,
                                  border: `1px solid ${macro.color}50`, color: macro.color,
                                  fontWeight: 600, background: `${macro.color}12`, cursor: 'pointer',
                                }}
                              >
                                {macro.name}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 600 }}>Sem categoria</span>
                            )}
                          </td>
                          <td className="table-td" style={{ maxWidth: 200 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {item.reasons.map((r, i) => (
                                <span key={i} className="review-note" style={{ fontSize: 10.5 }}>{r}</span>
                              ))}
                            </div>
                          </td>
                          <td className="table-td" style={{ whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => openModal(item.tx)}
                              style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredPanelItems.length === 0 && (
                      <tr>
                        <td colSpan={7}>
                          <div className="empty-state">
                            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                              {panelSearch ? 'Nenhum resultado para esta busca' : 'Nenhum item nesta categoria'}
                            </h4>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </React.Fragment>
            )}

            <div style={{ paddingBottom: 8 }}>
              <button
                onClick={() => setActivePanel(null)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
                  background: 'var(--well)', border: '1px solid var(--line)',
                  borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                  fontFamily: 'var(--ui)',
                }}
              >
                <ArrowLeft size={13} />
                Voltar para Revisão
              </button>
            </div>
          </>
        )}

      </div>

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          subCategories={subCategories}
          onApplyCategory={bulkApplyCategory}
          onApplySubcategory={bulkApplySubcategory}
          onApplyClassification={bulkApplyClassification}
          onAddTag={bulkAddTag}
          onRemoveTag={bulkRemoveTag}
          onMarkReviewed={bulkMarkReviewed}
          onMarkNeutral={bulkMarkNeutral}
          onApplySuggestedTags={bulkApplySuggestedTags}
          onClear={clearSelection}
        />
      )}

      {/* ── AI suggestions modal ── */}
      {aiSuggestions !== null && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 110,
            background: 'rgba(16,15,10,.55)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={e => e.target === e.currentTarget && setAiSuggestions(null)}
        >
          <div style={{
            background: 'var(--card-bg)', borderRadius: 14, padding: '24px 28px',
            width: '100%', maxWidth: 660, maxHeight: '80vh',
            display: 'flex', flexDirection: 'column', gap: 14,
            boxShadow: '0 8px 40px rgba(0,0,0,.22)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Brain size={16} color="var(--accent)" />
                  Sugestões da IA
                </h2>
                <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 3 }}>
                  {aiSuggestions.length} sugestões · aplique individualmente ou todas de alta confiança. Dados sensíveis não são enviados.
                </p>
              </div>
              <button onClick={() => setAiSuggestions(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={applyAllHighAI}
                style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--pos)', border: 'none', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--ui)' }}
              >
                Aplicar alta confiança ({aiSuggestions.filter(s => s.confidence === 'high' && !dismissedAI.has(s.id)).length})
              </button>
              <button
                onClick={() => setAiSuggestions(null)}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--well)', border: '1px solid var(--line)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--ui)' }}
              >
                Fechar
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aiSuggestions.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--faint)', textAlign: 'center', padding: '24px 0' }}>
                  A IA não encontrou sugestões com confiança suficiente.
                </p>
              ) : aiSuggestions.map(sugg => {
                const dismissed = dismissedAI.has(sugg.id)
                const tx = transactions.find(t => t.id === sugg.id)
                const macro = MACRO_CATEGORIES.find(m => m.id === sugg.macroCategoryId)
                const confColor = sugg.confidence === 'high' ? 'var(--pos)' : sugg.confidence === 'medium' ? 'var(--warn)' : 'var(--faint)'
                return (
                  <div
                    key={sugg.id}
                    style={{
                      padding: '12px 14px', borderRadius: 8,
                      border: `1px solid ${dismissed ? 'var(--line)' : 'var(--line)'}`,
                      background: dismissed ? 'var(--well)' : 'var(--paper)',
                      opacity: dismissed ? 0.5 : 1,
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx?.description ?? sugg.id}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {macro && (
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: `1px solid ${macro.color}50`, color: macro.color, fontWeight: 600, background: `${macro.color}12` }}>
                            {macro.name}
                          </span>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 700, color: confColor }}>
                          {sugg.confidence === 'high' ? 'alta' : sugg.confidence === 'medium' ? 'média' : 'baixa'} confiança
                        </span>
                        <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{sugg.reason}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {!dismissed && (
                        <button
                          onClick={() => applyAISuggestion(sugg)}
                          style={{ fontSize: 11, fontWeight: 700, color: 'var(--pos)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                        >
                          Aplicar
                        </button>
                      )}
                      <button
                        onClick={() => setDismissedAI(prev => { const n = new Set(prev); n.add(sugg.id); return n })}
                        style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                      >
                        Ignorar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

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
                const staticSubs = CATEGORIES.filter(c => c.macroCategoryId === modalPatch.macroCategoryId && c.active)
                const userSubs = subCategories.filter(s => s.macroCategoryId === modalPatch.macroCategoryId && s.active)
                const staticIds = new Set(staticSubs.map(s => s.id))
                const allSubs = [...staticSubs, ...userSubs.filter(s => !staticIds.has(s.id))].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                if (allSubs.length === 0) return null
                return (
                  <ModalField label="Subcategoria">
                    <select
                      value={(modalPatch.subCategoryId as string | undefined) ?? ''}
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

              <ModalField label="Observações">
                <textarea
                  value={modalPatch.notes ?? ''}
                  onChange={e => setModalPatch(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
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

            {/* Similar transactions */}
            {modalTx && (() => {
              const norm = modalTx.description.trim().toLowerCase()
              const similar = transactions.filter(t => t.id !== modalTx.id && t.description.trim().toLowerCase() === norm)
              if (similar.length === 0) return null
              const cats = Array.from(new Set(similar.map(t => MACRO_CATEGORIES.find(m => m.id === t.macroCategoryId)?.name).filter(Boolean)))
              return (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>
                    {similar.length} outro{similar.length !== 1 ? 's' : ''} com mesma descrição
                    {cats.length > 0 && <span style={{ fontWeight: 400, color: 'var(--faint)' }}> · atualmente: {cats.join(', ')}</span>}
                  </p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--ink)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={applyToSimilar}
                      onChange={e => setApplyToSimilar(e.target.checked)}
                    />
                    Aplicar categoria/classificação a todos os similares ao salvar
                  </label>
                </div>
              )
            })()}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button className="btn btn-primary" onClick={saveModal}>Salvar</button>
              <button className="btn btn-secondary" onClick={() => setModalTx(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

const REVIEW_TYPE_LABELS: Record<FinancialReviewType, string> = {
  uncategorized:        'Sem categoria',
  missing_subcategory:  'Sem subcategoria',
  low_confidence:       'Baixa confiança',
  possible_duplicate:   'Duplicidade',
  possible_wrong_neutral: 'Neutro suspeito',
  new_recurring:        'Novo recorrente',
  above_average:        'Acima da média',
  unexpected_income:    'Receita inesperada',
  card_payment_check:   'Pagamento de fatura',
  financial_cost:       'Custo financeiro',
}

const SEV_COLOR: Record<string, string> = {
  high: 'var(--crit)',
  medium: 'var(--warn)',
  low: 'var(--faint)',
}

function IntelligentReviewPanel({
  items, filteredItems, counts, filter, dismissed, onFilterChange, onDismiss, onNavigateToTx,
}: {
  items: FinancialReviewItem[]
  filteredItems: FinancialReviewItem[]
  counts: { high: number; medium: number; low: number }
  filter: string
  dismissed: Set<string>
  onFilterChange: (f: any) => void
  onDismiss: (id: string) => void
  onNavigateToTx: (txId: string) => void
}) {
  const visible = filteredItems.length
  const totalDismissed = dismissed.size

  return (
    <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} color="var(--accent)" />
            Revisão inteligente · mês atual
          </h3>
          <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
            {items.length} itens detectados · {totalDismissed > 0 && `${totalDismissed} ignorados · `}
            <span style={{ color: 'var(--crit)', fontWeight: 600 }}>{counts.high} alta</span> ·{' '}
            <span style={{ color: 'var(--warn)' }}>{counts.medium} média</span> ·{' '}
            <span>{counts.low} baixa</span>
          </p>
        </div>
        {totalDismissed > 0 && (
          <span style={{ fontSize: 11, color: 'var(--faint)' }}>{totalDismissed} ignorados</span>
        )}
      </div>

      {/* Severity filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['all', 'severity_high', 'severity_medium', 'severity_low'] as const).map(f => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--line)'}`,
              background: filter === f ? 'var(--accent)' : 'transparent',
              color: filter === f ? '#fff' : 'var(--ink-2)',
              cursor: 'pointer', fontFamily: 'var(--ui)',
            }}
          >
            {f === 'all' ? `Todos (${items.filter(i => !dismissed.has(i.id)).length})` :
             f === 'severity_high' ? `Alta (${counts.high})` :
             f === 'severity_medium' ? `Média (${counts.medium})` :
             `Baixa (${counts.low})`}
          </button>
        ))}
      </div>

      {/* Items list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
        {visible === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--faint)', fontSize: 13 }}>
            Nenhum item neste filtro
          </div>
        )}
        {filteredItems.map(item => (
          <div
            key={item.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${SEV_COLOR[item.severity]}30`,
              background: `${SEV_COLOR[item.severity]}08`,
            }}
          >
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <span style={{
                fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                background: `${SEV_COLOR[item.severity]}20`,
                color: SEV_COLOR[item.severity],
                textTransform: 'uppercase', letterSpacing: '.04em',
              }}>
                {item.severity === 'high' ? 'Alta' : item.severity === 'medium' ? 'Média' : 'Baixa'}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{item.title}</span>
                <span style={{
                  fontSize: 9.5, padding: '1px 6px', borderRadius: 8,
                  background: 'var(--well)', color: 'var(--faint)', border: '1px solid var(--line)',
                }}>
                  {REVIEW_TYPE_LABELS[item.type]}
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>{item.description}</p>
              <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>{item.suggestedAction}</p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
              {item.transactionId && (
                <button
                  onClick={() => onNavigateToTx(item.transactionId!)}
                  style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                >
                  Abrir
                </button>
              )}
              <button
                onClick={() => onDismiss(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 2, display: 'flex' }}
                title="Ignorar este item"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BulkActionBar({
  count, subCategories, onApplyCategory, onApplySubcategory, onApplyClassification, onAddTag, onRemoveTag,
  onMarkReviewed, onMarkNeutral, onApplySuggestedTags, onClear,
}: {
  count: number
  subCategories: import('../types').SubCategory[]
  onApplyCategory: (macroId: string) => void
  onApplySubcategory: (subId: string) => void
  onApplyClassification: (cls: ClassificationType) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onMarkReviewed: () => void
  onMarkNeutral: () => void
  onApplySuggestedTags: () => void
  onClear: () => void
}) {
  const [tagInput, setTagInput] = useState('')
  const [pendingMacro, setPendingMacro] = useState<string | undefined>(undefined)
  const [pendingSub, setPendingSub] = useState<string | undefined>(undefined)
  const [pendingCls, setPendingCls] = useState('')
  const allMacros = useMemo(() => getAllMacroCategories(), [])

  const hasPending = !!(pendingMacro || pendingSub || pendingCls)

  function applyPending() {
    if (pendingMacro) onApplyCategory(pendingMacro)
    if (pendingSub) onApplySubcategory(pendingSub)
    if (pendingCls) onApplyClassification(pendingCls as ClassificationType)
    setPendingMacro(undefined)
    setPendingSub(undefined)
    setPendingCls('')
  }

  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 18, zIndex: 120,
      background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 12,
      boxShadow: '0 8px 30px rgba(0,0,0,.18)', padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', maxWidth: 'min(960px, 94vw)',
    }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>
        {count} selecionado{count !== 1 ? 's' : ''}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: hasPending ? 'var(--accent-soft)' : 'var(--well)', border: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200 }}>
          <CategorySelector
            macroCategoryId={pendingMacro}
            subCategoryId={pendingSub}
            allMacros={allMacros}
            subCategories={subCategories}
            onChange={(macroId, subId) => { setPendingMacro(macroId); setPendingSub(subId) }}
          />
        </div>

        <select className="ledger-select" style={{ fontSize: 11.5 }} value={pendingCls} onChange={e => setPendingCls(e.target.value)}>
          <option value="">Classificação…</option>
          {Object.entries(CLS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <button
          className="btn btn-primary btn-sm"
          disabled={!hasPending}
          onClick={applyPending}
          style={{ fontSize: 11.5, opacity: hasPending ? 1 : 0.4 }}
        >
          Aplicar
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { onAddTag(tagInput); setTagInput('') } }}
          placeholder="tag…"
          className="login-field"
          style={{ fontSize: 11.5, width: 90 }}
        />
        <button className="btn btn-secondary btn-sm" disabled={!tagInput.trim()} onClick={() => { onAddTag(tagInput); setTagInput('') }}>+ tag</button>
        <button className="btn btn-secondary btn-sm" disabled={!tagInput.trim()} onClick={() => { onRemoveTag(tagInput); setTagInput('') }}>− tag</button>
      </div>

      <button className="btn btn-secondary btn-sm" onClick={onApplySuggestedTags} title="Aplica as tags sugeridas a cada selecionado">Tags sugeridas</button>

      <button className="btn btn-secondary btn-sm" onClick={onMarkReviewed}>Marcar revisado</button>
      <button className="btn btn-secondary btn-sm" onClick={onMarkReviewed} title="Dispensa a sugestão sem alterar a categoria">Ignorar sugestão</button>
      <button className="btn btn-secondary btn-sm" onClick={onMarkNeutral}>Marcar neutro</button>
      <button onClick={onClear} aria-label="Limpar seleção" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', display: 'flex', padding: 4 }}>
        <X size={15} />
      </button>
    </div>
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
