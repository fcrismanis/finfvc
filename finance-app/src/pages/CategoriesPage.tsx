import { useState, useMemo, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES, CATEGORIES } from '../config/categories'
import {
  loadCustomMacroCategories,
  upsertCustomMacroCategory,
  overrideDefaultMacro,
} from '../services/financeParentCategories.service'
import {
  loadCustomCategories,
  overrideDefaultCategory,
  upsertCustomCategory,
} from '../services/financeCategories.service'
import { BUDGET_CLASSIFICATION_LABELS, matchCategoryByKeywords } from '../services/categoryHelpers'
import { newSubCategoryId } from '../services/subcategory.service'
import type {
  MacroCategory, Category, SubCategory, Transaction,
  SubCategoryEssentiality, BudgetClassification, CategoryTabType,
} from '../types'

interface Props {
  onNavigate?: (route: string) => void
}

type ActiveTab = 'expense' | 'income'

// ─── Budget classification helpers ───────────────────────────────────────────

function essentialityToBudgetClass(e: SubCategoryEssentiality): BudgetClassification {
  if (e === 'essential') return 'essential'
  if (e === 'non_essential') return 'non_essential'
  return 'none'
}

function budgetClassToEssentiality(bc: BudgetClassification): SubCategoryEssentiality {
  if (bc === 'essential') return 'essential'
  if (bc === 'non_essential') return 'non_essential'
  return 'inherit'
}

// ─── Modal state ──────────────────────────────────────────────────────────────

type EditKind = 'macro' | 'defaultMacro' | 'cat' | 'defaultCat' | 'sub' | null

interface ModalState {
  open: boolean
  editKind: EditKind
  editId?: string            // ID being edited (any kind)
  parentMacroId: string      // '' = creating/editing parent category
  name: string
  type: ActiveTab
  keywords: string[]
  kwDraft: string
  budgetClassification: BudgetClassification
  group: 'personal' | 'business'
  active: boolean
}

const MODAL_BLANK: ModalState = {
  open: false,
  editKind: null,
  parentMacroId: '',
  name: '',
  type: 'expense',
  keywords: [],
  kwDraft: '',
  budgetClassification: 'none',
  group: 'personal',
  active: true,
}

// ─── Apply-keywords preview ───────────────────────────────────────────────────

interface KwSuggestion {
  tx: Transaction
  macroCategoryId: string
  categoryId?: string
  subCategoryId?: string
  confidence: 'high' | 'medium' | 'low'
  matchedKeyword: string
  matchedOn: string
}

// ─── Migration (idempotent) ───────────────────────────────────────────────────

function migrateLegacySubcategoriesIntoCategories(subs: SubCategory[]): void {
  const DONE_KEY = 'fin_subcats_migrated_v1'
  if (localStorage.getItem(DONE_KEY)) return
  localStorage.setItem(DONE_KEY, '1')
  if (subs.length > 0) {
    console.log(`[CategoriesPage] Legacy migration: ${subs.length} subcats now visible in category tree`)
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CategoriesPage({ onNavigate: _onNavigate }: Props) {
  const { subCategories, saveSubCategory, deleteSubCategory, transactions, updateTransactions } = useData()
  const [tab, setTab] = useState<ActiveTab>('expense')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal] = useState<ModalState>(MODAL_BLANK)
  const [customMacros, setCustomMacros] = useState<MacroCategory[]>(() => loadCustomMacroCategories())
  const [customCats, setCustomCats] = useState<Category[]>(() => loadCustomCategories())
  const [kwPreview, setKwPreview] = useState<KwSuggestion[] | null>(null)
  const [kwApplying, setKwApplying] = useState(false)

  useEffect(() => {
    migrateLegacySubcategoriesIntoCategories(subCategories)
  }, [subCategories])

  // Merged macros: custom overrides win over static defaults
  const allMacros = useMemo(() => {
    const customIds = new Set(customMacros.map(m => m.id))
    return [
      ...MACRO_CATEGORIES.filter(m => !customIds.has(m.id)),
      ...customMacros,
    ].sort((a, b) => a.sortOrder - b.sortOrder)
  }, [customMacros])

  const tabMacros = useMemo(
    () => allMacros.filter(m => m.tabType === tab || m.tabType === 'both'),
    [allMacros, tab],
  )

  // For a given macro: merged static+custom categories, then user SubCategories
  function getDefaultsForMacro(macroId: string): Category[] {
    const customIds = new Set(customCats.map(c => c.id))
    const merged = [
      ...CATEGORIES.filter(c => !customIds.has(c.id)),
      ...customCats,
    ]
    return merged
      .filter(c => c.macroCategoryId === macroId && (showInactive || c.active))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function getSubCatsForMacro(macroId: string): SubCategory[] {
    return subCategories
      .filter(s => s.macroCategoryId === macroId && (showInactive || s.active))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function inactiveSubCount(): number {
    return subCategories.filter(s => !s.active).length
  }

  // ── keyword helpers ─────────────────────────────────────────────────────────

  function addKeyword(kw: string) {
    const trimmed = kw.trim().toLowerCase()
    if (!trimmed || modal.keywords.includes(trimmed)) return
    setModal(m => ({ ...m, keywords: [...m.keywords, trimmed], kwDraft: '' }))
  }

  function removeKeyword(kw: string) {
    setModal(m => ({ ...m, keywords: m.keywords.filter(k => k !== kw) }))
  }

  function handleKwKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addKeyword(modal.kwDraft)
    }
  }

  // ── open modal ──────────────────────────────────────────────────────────────

  function openNewParent() {
    setModal({ ...MODAL_BLANK, open: true, type: tab })
  }

  function openNewSub(macroId: string) {
    setModal({ ...MODAL_BLANK, open: true, type: tab, parentMacroId: macroId })
  }

  function openEditMacro(macro: MacroCategory) {
    setModal({
      ...MODAL_BLANK,
      open: true,
      editKind: macro.isDefault ? 'defaultMacro' : 'macro',
      editId: macro.id,
      name: macro.name,
      type: (macro.tabType === 'income' ? 'income' : 'expense') as ActiveTab,
      parentMacroId: '',
      keywords: macro.keywords ?? [],
      budgetClassification: macro.budgetClassification ?? 'none',
      group: macro.group ?? 'personal',
      active: true,
    })
  }

  function openEditCat(cat: Category) {
    setModal({
      ...MODAL_BLANK,
      open: true,
      editKind: 'defaultCat',
      editId: cat.id,
      name: cat.name,
      type: tab,
      parentMacroId: cat.macroCategoryId,
      keywords: cat.keywords ?? [],
      budgetClassification: cat.budgetClassification ?? 'none',
      group: cat.group ?? 'personal',
      active: cat.active,
    })
  }

  function openEditSub(sub: SubCategory) {
    setModal({
      ...MODAL_BLANK,
      open: true,
      editKind: 'sub',
      editId: sub.id,
      name: sub.name,
      type: tab,
      parentMacroId: sub.macroCategoryId,
      keywords: sub.keywords ?? [],
      budgetClassification: essentialityToBudgetClass(sub.essentiality),
      group: 'personal',
      active: sub.active,
    })
  }

  async function removeSubCat(id: string) {
    if (!confirm('Remover subcategoria? Lançamentos existentes não serão afetados.')) return
    await deleteSubCategory(id)
  }

  // ── save modal ──────────────────────────────────────────────────────────────

  async function saveModal() {
    if (!modal.name.trim()) return

    switch (modal.editKind) {
      case 'defaultMacro': {
        // Patch only editable fields on a default macro
        const saved = overrideDefaultMacro(modal.editId!, {
          keywords: modal.keywords,
          budgetClassification: modal.budgetClassification,
          group: modal.group,
        })
        setCustomMacros(prev => [...prev.filter(m => m.id !== saved.id), saved])
        break
      }
      case 'macro': {
        const saved = upsertCustomMacroCategory({
          id: modal.editId,
          name: modal.name.trim(),
          tabType: modal.type === 'expense' ? 'expense' : 'income',
          keywords: modal.keywords,
          budgetClassification: modal.budgetClassification,
          group: modal.group,
        })
        setCustomMacros(prev => [...prev.filter(m => m.id !== saved.id), saved])
        break
      }
      case null: {
        // New parent category
        if (!modal.parentMacroId) {
          const tabType: CategoryTabType = modal.type === 'expense' ? 'expense' : 'income'
          const saved = upsertCustomMacroCategory({
            name: modal.name.trim(),
            tabType,
            keywords: modal.keywords,
            budgetClassification: modal.budgetClassification,
            group: modal.group,
          })
          setCustomMacros(prev => [...prev.filter(m => m.id !== saved.id), saved])
          break
        }
        // New subcategory (fall through to sub logic)
        const sub: SubCategory = {
          id: newSubCategoryId(),
          name: modal.name.trim(),
          macroCategoryId: modal.parentMacroId,
          essentiality: budgetClassToEssentiality(modal.budgetClassification),
          active: true,
          createdAt: new Date().toISOString(),
          keywords: modal.keywords,
        }
        await saveSubCategory(sub)
        break
      }
      case 'defaultCat': {
        const saved = overrideDefaultCategory(modal.editId!, {
          keywords: modal.keywords,
          budgetClassification: modal.budgetClassification,
          active: modal.active,
        })
        setCustomCats(prev => [...prev.filter(c => c.id !== saved.id), saved])
        break
      }
      case 'cat': {
        const saved = upsertCustomCategory({
          id: modal.editId,
          name: modal.name.trim(),
          macroCategoryId: modal.parentMacroId,
          keywords: modal.keywords,
          budgetClassification: modal.budgetClassification,
          group: modal.group,
          active: modal.active,
        })
        setCustomCats(prev => [...prev.filter(c => c.id !== saved.id), saved])
        break
      }
      case 'sub': {
        const sub: SubCategory = {
          id: modal.editId ?? newSubCategoryId(),
          name: modal.name.trim(),
          macroCategoryId: modal.parentMacroId,
          essentiality: budgetClassToEssentiality(modal.budgetClassification),
          active: modal.active,
          createdAt: new Date().toISOString(),
          keywords: modal.keywords,
        }
        await saveSubCategory(sub)
        break
      }
    }

    setModal(MODAL_BLANK)
  }

  // ── apply keywords to uncategorized transactions ────────────────────────────

  function buildKwPreview() {
    const uncategorized = transactions.filter(
      t => !t.macroCategoryId && !t.manualCategoryOverride,
    )
    const suggestions: KwSuggestion[] = []
    for (const tx of uncategorized) {
      const match = matchCategoryByKeywords(tx.description)
      if (match) {
        suggestions.push({
          tx,
          macroCategoryId: match.macroCategoryId,
          categoryId: match.categoryId,
          subCategoryId: match.subCategoryId,
          confidence: match.confidence,
          matchedKeyword: match.matchedKeyword,
          matchedOn: match.matchedOn,
        })
      }
    }
    setKwPreview(suggestions)
  }

  async function applyKwSuggestions() {
    if (!kwPreview?.length) return
    setKwApplying(true)
    const patches = kwPreview.map(s => ({
      id: s.tx.id,
      patch: {
        macroCategoryId: s.macroCategoryId,
        ...(s.categoryId ? { categoryId: s.categoryId } : {}),
        ...(s.subCategoryId ? { subCategoryId: s.subCategoryId } : {}),
        categorySuggestionSource: 'rule' as const,
        categoryConfidence: s.confidence,
      },
    }))
    await updateTransactions(patches, { markManual: false })
    setKwApplying(false)
    setKwPreview(null)
  }

  // ── render helpers ──────────────────────────────────────────────────────────

  const kwRow = (keywords: string[] | undefined) => {
    if (!keywords?.length) return null
    return (
      <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 400, lineHeight: 1.4 }}>
        {keywords.join(', ')}
      </span>
    )
  }

  const badgeClass = (bc: BudgetClassification) => {
    if (bc === 'essential') return { bg: '#dcfce7', color: '#16a34a', border: '#bbf7d0' }
    if (bc === 'non_essential') return { bg: '#fef9c3', color: '#a16207', border: '#fef08a' }
    return null
  }

  const confidenceColor = (c: 'high' | 'medium' | 'low') => {
    if (c === 'high') return '#16a34a'
    if (c === 'medium') return '#a16207'
    return '#6b7280'
  }

  // ── main render ─────────────────────────────────────────────────────────────

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 740, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Categorias</h1>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 2 }}>
              Organize suas categorias por grupo
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={buildKwPreview}
              style={{ fontSize: 11 }}
            >
              Verificar sem categoria
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowInactive(v => !v)}
              style={{ fontSize: 11 }}
            >
              {showInactive
                ? 'Ocultar desativadas'
                : `Mostrar desativadas${inactiveSubCount() > 0 ? ` (${inactiveSubCount()})` : ''}`}
            </button>
            <button className="btn btn-primary btn-sm" onClick={openNewParent}>
              + Nova Categoria
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--line)' }}>
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 22px', fontSize: 13,
                fontWeight: tab === t ? 750 : 500,
                color: tab === t ? 'var(--accent)' : 'var(--faint)',
                background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -2, cursor: 'pointer', fontFamily: 'var(--ui)',
              }}
            >
              {t === 'expense' ? 'Despesas' : 'Receitas'}
            </button>
          ))}
        </div>

        {/* Category list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tabMacros.map(macro => {
            const defaults = getDefaultsForMacro(macro.id)
            const userSubs = getSubCatsForMacro(macro.id)
            const expanded = expandedIds.has(macro.id)
            const totalCount = defaults.length + userSubs.length

            return (
              <div key={macro.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Parent row */}
                <div
                  onClick={() => toggleExpand(macro.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', cursor: 'pointer',
                    borderBottom: expanded ? '1px solid var(--line)' : 'none',
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: macro.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{macro.name}</span>
                      {macro.isDefault && <Chip label="Padrão" color={macro.color} />}
                      {macro.isNeutral && <Chip label="Neutra" color="#9CA3AF" />}
                    </div>
                    {kwRow(macro.keywords)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {totalCount > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: `${macro.color}18`, color: macro.color, border: `1px solid ${macro.color}30`,
                      }}>{totalCount}</span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); openEditMacro(macro) }}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                    >editar</button>
                    <span style={{ fontSize: 11, color: 'var(--faint)', userSelect: 'none' }}>
                      {expanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Expanded: defaults then user subs */}
                {expanded && (
                  <div style={{ background: 'var(--well)' }}>
                    {/* Static/overridden default categories */}
                    {defaults.map((cat, i) => {
                      const bc = cat.budgetClassification ?? 'none'
                      const badge = badgeClass(bc)
                      return (
                        <div key={cat.id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '9px 16px 9px 36px',
                          borderBottom: (i < defaults.length - 1 || userSubs.length > 0) ? '1px solid var(--line)' : 'none',
                          opacity: cat.active ? 1 : 0.5,
                        }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>{cat.name}</span>
                              <Chip label="Padrão" color="#94a3b8" small />
                              {!cat.active && <span style={{ fontSize: 10, color: 'var(--faint)' }}>desativada</span>}
                            </div>
                            {kwRow(cat.keywords)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {badge && (
                              <span style={{
                                fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                                background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                              }}>{BUDGET_CLASSIFICATION_LABELS[bc]}</span>
                            )}
                            <button
                              onClick={() => openEditCat(cat)}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 10, padding: '2px 6px' }}
                            >editar</button>
                          </div>
                        </div>
                      )
                    })}

                    {/* User-created SubCategories */}
                    {userSubs.map((sub, i) => {
                      const bc = essentialityToBudgetClass(sub.essentiality)
                      const badge = badgeClass(bc)
                      return (
                        <div key={sub.id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '9px 16px 9px 36px',
                          borderBottom: i < userSubs.length - 1 ? '1px solid var(--line)' : 'none',
                          opacity: sub.active ? 1 : 0.5,
                        }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>{sub.name}</span>
                              {!sub.active && <span style={{ fontSize: 10, color: 'var(--faint)' }}>desativada</span>}
                            </div>
                            {kwRow(sub.keywords)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {badge && (
                              <span style={{
                                fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                                background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                              }}>{BUDGET_CLASSIFICATION_LABELS[bc]}</span>
                            )}
                            <button
                              onClick={() => openEditSub(sub)}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 10, padding: '2px 6px' }}
                            >editar</button>
                            <button
                              onClick={() => removeSubCat(sub.id)}
                              style={{ fontSize: 10, color: 'var(--crit)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)', padding: '2px 4px' }}
                            >×</button>
                          </div>
                        </div>
                      )
                    })}

                    {defaults.length === 0 && userSubs.length === 0 && (
                      <div style={{ padding: '12px 16px 12px 36px', fontSize: 12, color: 'var(--faint)' }}>
                        Nenhuma subcategoria.
                      </div>
                    )}

                    {/* Add sub */}
                    <div style={{ padding: '8px 16px 8px 36px', borderTop: '1px solid var(--line)' }}>
                      <button
                        onClick={() => openNewSub(macro.id)}
                        style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                      >+ Adicionar subcategoria</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit/New Category Modal */}
      {modal.open && (
        <CategoryModal
          modal={modal}
          setModal={setModal}
          allMacros={allMacros}
          onAddKeyword={addKeyword}
          onRemoveKeyword={removeKeyword}
          onKwKeyDown={handleKwKeyDown}
          onSave={saveModal}
          onClose={() => setModal(MODAL_BLANK)}
        />
      )}

      {/* Apply keywords preview modal */}
      {kwPreview !== null && (
        <KwPreviewModal
          suggestions={kwPreview}
          allMacros={allMacros}
          applying={kwApplying}
          confidenceColor={confidenceColor}
          onApply={() => void applyKwSuggestions()}
          onClose={() => setKwPreview(null)}
        />
      )}
    </main>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, color, small }: { label: string; color: string; small?: boolean }) {
  return (
    <span style={{
      fontSize: small ? 8.5 : 9, fontWeight: 700, padding: small ? '1px 4px' : '1px 5px',
      borderRadius: 3, background: `${color}18`, color,
      border: `1px solid ${color}30`, letterSpacing: '.04em',
    }}>
      {label.toUpperCase()}
    </span>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  modal: ModalState
  setModal: React.Dispatch<React.SetStateAction<ModalState>>
  allMacros: MacroCategory[]
  onAddKeyword: (kw: string) => void
  onRemoveKeyword: (kw: string) => void
  onKwKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onSave: () => void
  onClose: () => void
}

function CategoryModal({
  modal, setModal, allMacros,
  onAddKeyword, onRemoveKeyword, onKwKeyDown,
  onSave, onClose,
}: ModalProps) {
  const isEditing = Boolean(modal.editKind)
  const isParent = !modal.parentMacroId
  const isDefaultItem = modal.editKind === 'defaultMacro' || modal.editKind === 'defaultCat'
  const showActiveToggle = isEditing && (modal.editKind === 'sub' || modal.editKind === 'defaultCat' || modal.editKind === 'cat')
  const typeLabel = isParent ? 'categoria' : 'subcategoria'
  const title = isEditing ? `Editar ${typeLabel}` : `Nova ${typeLabel}`

  const parentOptions = allMacros
    .filter(m => m.tabType === modal.type || m.tabType === 'both')
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(16,15,10,.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--card-bg)', borderRadius: 14,
        boxShadow: '0 12px 40px rgba(0,0,0,.22)',
        width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px 14px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 750, color: 'var(--ink)', margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--faint)', lineHeight: 1, padding: '0 2px' }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Grupo */}
          {!isDefaultItem && (
            <Field label="Grupo">
              <ToggleGroup
                options={[{ value: 'personal', label: 'Pessoal' }, { value: 'business', label: 'Negócio' }]}
                value={modal.group}
                onChange={v => setModal(m => ({ ...m, group: v as 'personal' | 'business' }))}
              />
            </Field>
          )}

          {/* Tipo (only when creating parent, not editing default) */}
          {isParent && !isDefaultItem && (
            <Field label="Tipo">
              <ToggleGroup
                options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]}
                value={modal.type}
                onChange={v => setModal(m => ({ ...m, type: v as ActiveTab }))}
              />
            </Field>
          )}

          {/* Nome — read-only for default items */}
          {!isDefaultItem ? (
            <>
              {/* Categoria Pai (shown only when not editing parent and not a default item) */}
              {(!isEditing || !isParent) && (
                <Field label="Categoria Pai">
                  <select
                    value={modal.parentMacroId}
                    onChange={e => setModal(m => ({ ...m, parentMacroId: e.target.value }))}
                    className="ledger-select"
                    style={{ fontSize: 12.5, width: '100%' }}
                  >
                    <option value="">Nenhuma (criar categoria principal)</option>
                    {parentOptions.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Nome">
                <input
                  value={modal.name}
                  onChange={e => setModal(m => ({ ...m, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') void onSave() }}
                  placeholder={isParent ? 'Ex: Alimentação' : 'Ex: Açougue'}
                  className="login-field"
                  style={{ fontSize: 13, width: '100%' }}
                  autoFocus
                />
              </Field>
            </>
          ) : (
            <Field label="Nome">
              <div style={{
                padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)',
                background: 'var(--well)', fontSize: 13, color: 'var(--ink-2)',
              }}>
                {modal.name}
              </div>
            </Field>
          )}

          {/* Classificação do Orçamento */}
          <Field label="Classificação do Orçamento">
            <select
              value={modal.budgetClassification}
              onChange={e => setModal(m => ({ ...m, budgetClassification: e.target.value as BudgetClassification }))}
              className="ledger-select"
              style={{ fontSize: 12.5, width: '100%' }}
            >
              <option value="none">Sem classificação{!isParent ? ' (herda do pai)' : ''}</option>
              <option value="essential">Essencial</option>
              <option value="non_essential">Não essencial</option>
            </select>
          </Field>

          {/* Ativo toggle (only for editable active items) */}
          {showActiveToggle && (
            <Field label="Status">
              <ToggleGroup
                options={[{ value: 'true', label: 'Ativo' }, { value: 'false', label: 'Inativo' }]}
                value={modal.active ? 'true' : 'false'}
                onChange={v => setModal(m => ({ ...m, active: v === 'true' }))}
              />
            </Field>
          )}

          {/* Palavras-chave */}
          <Field label="Palavras-chave para organização automática">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 5, minHeight: 36,
                padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 8,
                background: 'var(--well)', cursor: 'text',
              }}>
                {modal.keywords.length === 0 && (
                  <span style={{ fontSize: 11.5, color: 'var(--faint)', alignSelf: 'center' }}>
                    Nenhuma palavra-chave adicionada
                  </span>
                )}
                {modal.keywords.map(kw => (
                  <span key={kw} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                    border: '1px solid var(--accent-border)',
                  }}>
                    {kw}
                    <button
                      onClick={() => onRemoveKeyword(kw)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1, color: 'var(--faint)' }}
                    >×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={modal.kwDraft}
                  onChange={e => setModal(m => ({ ...m, kwDraft: e.target.value }))}
                  onKeyDown={onKwKeyDown}
                  placeholder="Ex: supermercado — pressione Enter para adicionar"
                  className="login-field"
                  style={{ fontSize: 12, flex: 1 }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onAddKeyword(modal.kwDraft)}
                  style={{ flexShrink: 0 }}
                >Adicionar</button>
              </div>
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid var(--line)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          position: 'sticky', bottom: 0, background: 'var(--card-bg)',
        }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void onSave()}
            disabled={!isDefaultItem && !modal.name.trim()}
          >
            {isEditing ? 'Salvar alterações' : `Criar ${typeLabel}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── KwPreviewModal ───────────────────────────────────────────────────────────

function KwPreviewModal({
  suggestions, allMacros, applying, confidenceColor, onApply, onClose,
}: {
  suggestions: KwSuggestion[]
  allMacros: MacroCategory[]
  applying: boolean
  confidenceColor: (c: 'high' | 'medium' | 'low') => string
  onApply: () => void
  onClose: () => void
}) {
  const macroMap = useMemo(() => new Map(allMacros.map(m => [m.id, m])), [allMacros])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(16,15,10,.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--card-bg)', borderRadius: 14,
        boxShadow: '0 12px 40px rgba(0,0,0,.22)',
        width: '100%', maxWidth: 620,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px 14px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1,
        }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 750, color: 'var(--ink)', margin: 0 }}>
              Lançamentos sem categoria
            </h3>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 3 }}>
              {suggestions.length === 0
                ? 'Nenhum lançamento encontrado com sugestão de keyword.'
                : `${suggestions.length} sugestão${suggestions.length !== 1 ? 'ões' : ''} encontrada${suggestions.length !== 1 ? 's' : ''}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--faint)', lineHeight: 1, padding: '0 2px' }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 0' }}>
          {suggestions.length === 0 ? (
            <div style={{ padding: '20px 22px', fontSize: 13, color: 'var(--faint)', textAlign: 'center' }}>
              Todos os lançamentos já têm categoria ou nenhuma keyword correspondeu.
            </div>
          ) : (
            suggestions.map(s => {
              const macro = macroMap.get(s.macroCategoryId)
              return (
                <div key={s.tx.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '10px 22px', borderBottom: '1px solid var(--line)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 2 }}>
                      {s.tx.description}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--faint)' }}>
                      {s.tx.competenceDate} · R$ {Math.abs(s.tx.amount).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: macro?.color ?? 'var(--ink-2)' }}>
                      {macro?.name ?? s.macroCategoryId}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>
                      via <em>{s.matchedKeyword}</em>
                    </div>
                    <div style={{ fontSize: 10, color: confidenceColor(s.confidence), fontWeight: 700 }}>
                      {s.confidence === 'high' ? 'Alta' : s.confidence === 'medium' ? 'Média' : 'Baixa'} confiança
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid var(--line)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          position: 'sticky', bottom: 0, background: 'var(--card-bg)',
        }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Fechar</button>
          {suggestions.length > 0 && (
            <button
              className="btn btn-primary btn-sm"
              onClick={onApply}
              disabled={applying}
            >
              {applying ? 'Aplicando…' : `Aplicar ${suggestions.length} sugestão${suggestions.length !== 1 ? 'ões' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Field row ────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--faint)',
        textTransform: 'uppercase', letterSpacing: '.06em',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── Toggle group ─────────────────────────────────────────────────────────────

function ToggleGroup({ options, value, onChange }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: '5px 16px', fontSize: 12.5,
            fontWeight: value === o.value ? 700 : 400,
            color: value === o.value ? 'var(--accent)' : 'var(--ink-2)',
            background: value === o.value ? 'var(--accent-soft)' : 'var(--card-bg)',
            border: `1px solid ${value === o.value ? 'var(--accent-border)' : 'var(--line)'}`,
            borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--ui)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
