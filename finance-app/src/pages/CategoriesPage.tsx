import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Circle, Pencil, Check, X as XIcon, Minus,
} from 'lucide-react'
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
} from '../services/financeCategories.service'
import { BUDGET_CLASSIFICATION_LABELS, matchCategoryByKeywords } from '../services/categoryHelpers'
import { newSubCategoryId } from '../services/subcategory.service'
import { ICON_MAP, ICON_ENTRIES } from '../utils/categoryIcons'
import type {
  MacroCategory, Category, SubCategory, Transaction,
  SubCategoryEssentiality, BudgetClassification, CategoryTabType, ClassificationType,
} from '../types'

interface Props {
  onNavigate?: (route: string) => void
}

type ActiveTab = 'expense' | 'income'

// ─── Icon render helper ───────────────────────────────────────────────────────

type IconComp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>

function IconComp({ name, size = 14, color }: { name?: string; size?: number; color?: string }) {
  const Ic = name ? (ICON_MAP[name] ?? Circle) : Minus
  return <Ic size={size} color={color} strokeWidth={2} />
}

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

// ─── Inline edit state ────────────────────────────────────────────────────────

interface InlineEdit {
  id: string
  kind: 'macro' | 'defaultMacro' | 'defaultCat' | 'sub'
  nameReadOnly: boolean
  name: string
  icon: string
  kwText: string
  budgetClassification: BudgetClassification
  classificationType?: ClassificationType
  active: boolean
}

// ─── Create modal state (new items only) ─────────────────────────────────────

interface ModalState {
  open: boolean
  parentMacroId: string
  name: string
  type: ActiveTab
  icon: string
  keywords: string[]
  kwDraft: string
  budgetClassification: BudgetClassification
}

const MODAL_BLANK: ModalState = {
  open: false, parentMacroId: '', name: '', type: 'expense',
  icon: 'circle', keywords: [], kwDraft: '', budgetClassification: 'none',
}

// ─── Apply-keywords preview ───────────────────────────────────────────────────

interface KwSuggestion {
  tx: Transaction
  macroCategoryId: string
  categoryId?: string
  subCategoryId?: string
  confidence: 'high' | 'medium' | 'low'
  matchedKeyword: string
}

// ─── Migration (idempotent) ───────────────────────────────────────────────────

function migrateLegacy(subs: SubCategory[]): void {
  const KEY = 'fin_subcats_migrated_v1'
  if (localStorage.getItem(KEY)) return
  localStorage.setItem(KEY, '1')
  if (subs.length > 0) console.log(`[CategoriesPage] ${subs.length} subcats in category tree`)
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
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null)
  const [kwPreview, setKwPreview] = useState<KwSuggestion[] | null>(null)
  const [kwApplying, setKwApplying] = useState(false)

  useEffect(() => { migrateLegacy(subCategories) }, [subCategories])

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
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function inactiveSubCount() { return subCategories.filter(s => !s.active).length }

  // ── inline edit ─────────────────────────────────────────────────────────────

  function startEditMacro(macro: MacroCategory) {
    setInlineEdit({
      id: macro.id,
      kind: macro.isDefault ? 'defaultMacro' : 'macro',
      nameReadOnly: macro.isDefault ?? false,
      name: macro.name,
      icon: macro.icon ?? 'circle',
      kwText: (macro.keywords ?? []).join(', '),
      budgetClassification: macro.budgetClassification ?? 'none',
      classificationType: macro.classificationType,
      active: true,
    })
  }

  function startEditCat(cat: Category) {
    setInlineEdit({
      id: cat.id,
      kind: 'defaultCat',
      nameReadOnly: false,
      name: cat.name,
      icon: cat.icon ?? 'circle',
      kwText: (cat.keywords ?? []).join(', '),
      budgetClassification: cat.budgetClassification ?? 'none',
      active: cat.active,
    })
  }

  function startEditSub(sub: SubCategory) {
    setInlineEdit({
      id: sub.id,
      kind: 'sub',
      nameReadOnly: false,
      name: sub.name,
      icon: (sub as SubCategory & { icon?: string }).icon ?? 'circle',
      kwText: (sub.keywords ?? []).join(', '),
      budgetClassification: essentialityToBudgetClass(sub.essentiality),
      active: sub.active,
    })
  }

  async function saveInlineEdit() {
    const e = inlineEdit
    if (!e) return
    const kws = e.kwText.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)

    switch (e.kind) {
      case 'defaultMacro': {
        const saved = overrideDefaultMacro(e.id, {
          keywords: kws, budgetClassification: e.budgetClassification, icon: e.icon,
          ...(e.classificationType ? { classificationType: e.classificationType } : {}),
        })
        setCustomMacros(prev => [...prev.filter(m => m.id !== saved.id), saved])
        break
      }
      case 'macro': {
        const macro = allMacros.find(m => m.id === e.id)
        const saved = upsertCustomMacroCategory({
          id: e.id, name: e.name.trim(),
          tabType: (macro?.tabType ?? (tab === 'expense' ? 'expense' : 'income')) as CategoryTabType,
          icon: e.icon, keywords: kws, budgetClassification: e.budgetClassification,
          ...(e.classificationType ? { classificationType: e.classificationType } : {}),
        })
        setCustomMacros(prev => [...prev.filter(m => m.id !== saved.id), saved])
        break
      }
      case 'defaultCat': {
        const saved = overrideDefaultCategory(e.id, {
          name: e.name.trim() || undefined,
          keywords: kws, budgetClassification: e.budgetClassification,
          active: e.active, icon: e.icon,
        })
        setCustomCats(prev => [...prev.filter(c => c.id !== saved.id), saved])
        break
      }
      case 'sub': {
        const base = subCategories.find(s => s.id === e.id)
        const sub: SubCategory & { icon?: string } = {
          ...(base ?? { id: e.id, macroCategoryId: '', createdAt: new Date().toISOString() }),
          id: e.id,
          name: e.name.trim(),
          essentiality: budgetClassToEssentiality(e.budgetClassification),
          active: e.active,
          keywords: kws,
          icon: e.icon,
        }
        await saveSubCategory(sub as SubCategory)
        break
      }
    }
    setInlineEdit(null)
  }

  // ── create modal ─────────────────────────────────────────────────────────────

  function addKeyword(kw: string) {
    const t = kw.trim().toLowerCase()
    if (!t || modal.keywords.includes(t)) return
    setModal(m => ({ ...m, keywords: [...m.keywords, t], kwDraft: '' }))
  }
  function removeKeyword(kw: string) {
    setModal(m => ({ ...m, keywords: m.keywords.filter(k => k !== kw) }))
  }
  function handleKwKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(modal.kwDraft) }
  }

  async function saveModal() {
    if (!modal.name.trim()) return
    if (!modal.parentMacroId) {
      const saved = upsertCustomMacroCategory({
        name: modal.name.trim(),
        tabType: modal.type === 'expense' ? 'expense' : 'income',
        icon: modal.icon, keywords: modal.keywords,
        budgetClassification: modal.budgetClassification,
      })
      setCustomMacros(prev => [...prev.filter(m => m.id !== saved.id), saved])
    } else {
      await saveSubCategory({
        id: newSubCategoryId(), name: modal.name.trim(),
        macroCategoryId: modal.parentMacroId,
        essentiality: budgetClassToEssentiality(modal.budgetClassification),
        active: true, createdAt: new Date().toISOString(),
        keywords: modal.keywords,
        ...({ icon: modal.icon } as object),
      } as SubCategory)
    }
    setModal(MODAL_BLANK)
  }

  function clearSubFromTransactions(subId: string) {
    const affected = transactions.filter(t => t.subCategoryId === subId)
    if (affected.length > 0) {
      updateTransactions(affected.map(t => ({ id: t.id, patch: { subCategoryId: undefined } })))
    }
  }

  async function removeSubCat(id: string) {
    if (!confirm('Remover subcategoria?')) return
    await deleteSubCategory(id)
    if (confirm('Limpar esta subcategoria dos lançamentos existentes?')) {
      clearSubFromTransactions(id)
    }
  }

  function deactivateDefaultCat(id: string) {
    if (!confirm('Remover subcategoria padrão?')) return
    const cat = CATEGORIES.find(c => c.id === id)
    if (!cat) return
    const saved = overrideDefaultCategory(id, {
      keywords: cat.keywords ?? [],
      budgetClassification: cat.budgetClassification ?? 'none',
      active: false,
      icon: cat.icon ?? 'circle',
    })
    setCustomCats(prev => [...prev.filter(c => c.id !== saved.id), saved])
    if (confirm('Limpar esta subcategoria dos lançamentos existentes?')) {
      clearSubFromTransactions(id)
    }
  }

  // ── apply keywords ──────────────────────────────────────────────────────────

  function buildKwPreview() {
    const uncategorized = transactions.filter(t => !t.macroCategoryId && !t.manualCategoryOverride)
    const suggestions: KwSuggestion[] = []
    for (const tx of uncategorized) {
      const match = matchCategoryByKeywords(tx.description)
      if (match) suggestions.push({ tx, ...match })
    }
    setKwPreview(suggestions)
  }

  async function applyKwSuggestions() {
    if (!kwPreview?.length) return
    setKwApplying(true)
    await updateTransactions(kwPreview.map(s => ({
      id: s.tx.id,
      patch: {
        macroCategoryId: s.macroCategoryId,
        ...(s.categoryId ? { categoryId: s.categoryId } : {}),
        ...(s.subCategoryId ? { subCategoryId: s.subCategoryId } : {}),
        categorySuggestionSource: 'rule' as const,
        categoryConfidence: s.confidence,
      },
    })), { markManual: false })
    setKwApplying(false)
    setKwPreview(null)
  }

  // ── render helpers ──────────────────────────────────────────────────────────

  const badgeStyle = (bc: BudgetClassification) => {
    if (bc === 'essential') return { bg: '#dcfce7', color: '#16a34a', border: '#bbf7d0' }
    if (bc === 'non_essential') return { bg: '#fef9c3', color: '#a16207', border: '#fef08a' }
    return null
  }

  const confidenceColor = (c: 'high' | 'medium' | 'low') =>
    c === 'high' ? '#16a34a' : c === 'medium' ? '#a16207' : '#6b7280'

  // ── main render ─────────────────────────────────────────────────────────────

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 740, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Categorias</h1>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 2 }}>Organize suas categorias por grupo</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={buildKwPreview} style={{ fontSize: 11 }}>
              Verificar sem categoria
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowInactive(v => !v)} style={{ fontSize: 11 }}>
              {showInactive ? 'Ocultar desativadas' : `Mostrar desativadas${inactiveSubCount() > 0 ? ` (${inactiveSubCount()})` : ''}`}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ ...MODAL_BLANK, open: true, type: tab })}>
              + Nova Categoria
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--line)' }}>
          {(['expense', 'income'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 22px', fontSize: 13,
              fontWeight: tab === t ? 750 : 500,
              color: tab === t ? 'var(--accent)' : 'var(--faint)',
              background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2, cursor: 'pointer', fontFamily: 'var(--ui)',
            }}>
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
            const isEditingThis = inlineEdit?.id === macro.id

            return (
              <div key={macro.id} className="card" style={{ overflow: 'hidden' }}>
                {/* ── Parent row ── */}
                {isEditingThis ? (
                  <InlineEditRow
                    edit={inlineEdit}
                    color={macro.color}
                    onChangeEdit={setInlineEdit}
                    onSave={() => void saveInlineEdit()}
                    onCancel={() => setInlineEdit(null)}
                    showActive={false}
                    borderBottom={expanded}
                  />
                ) : (
                  <div
                    onClick={() => toggleExpand(macro.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '11px 14px', cursor: 'pointer',
                      borderBottom: expanded ? '1px solid var(--line)' : 'none',
                    }}
                  >
                    <span style={{ color: macro.color, flexShrink: 0, display: 'flex' }}>
                      <IconComp name={macro.icon} size={15} color={macro.color} />
                    </span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{macro.name}</span>
                        {macro.isNeutral && <Chip label="Neutra" color="#9CA3AF" />}
                      </div>
                      {macro.keywords?.length ? (
                        <span style={{ fontSize: 10.5, color: 'var(--faint)', lineHeight: 1.4 }}>
                          {macro.keywords.join(', ')}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {totalCount > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: `${macro.color}18`, color: macro.color, border: `1px solid ${macro.color}30`,
                        }}>{totalCount}</span>
                      )}
                      <PencilBtn onClick={e => { e.stopPropagation(); startEditMacro(macro) }} />
                      <span style={{ fontSize: 11, color: 'var(--faint)', userSelect: 'none' }}>
                        {expanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Expanded children ── */}
                {expanded && (
                  <div style={{ background: 'var(--well)' }}>

                    {/* Static default categories */}
                    {defaults.map((cat, i) => {
                      const bc = cat.budgetClassification ?? 'none'
                      const badge = badgeStyle(bc)
                      const isEditingCat = inlineEdit?.id === cat.id
                      return (
                        <div key={cat.id} style={{
                          borderBottom: (i < defaults.length - 1 || userSubs.length > 0) ? '1px solid var(--line)' : 'none',
                          opacity: cat.active ? 1 : 0.5,
                        }}>
                          {isEditingCat ? (
                            <InlineEditRow
                              edit={inlineEdit}
                              color={macro.color}
                              onChangeEdit={setInlineEdit}
                              onSave={() => void saveInlineEdit()}
                              onCancel={() => setInlineEdit(null)}
                              showActive
                              indent
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 14px 9px 36px' }}>
                              <span style={{ marginTop: 1, flexShrink: 0, color: macro.color, opacity: 0.6 }}>
                                <IconComp name={cat.icon ?? macro.icon} size={13} color={macro.color} />
                              </span>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>{cat.name}</span>
                                  {!cat.active && <span style={{ fontSize: 10, color: 'var(--faint)' }}>desativada</span>}
                                </div>
                                {cat.keywords?.length ? (
                                  <span style={{ fontSize: 10.5, color: 'var(--faint)', lineHeight: 1.4 }}>
                                    {cat.keywords.join(', ')}
                                  </span>
                                ) : null}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 1 }}>
                                {badge && (
                                  <span style={{
                                    fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                                    background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                                  }}>{BUDGET_CLASSIFICATION_LABELS[bc]}</span>
                                )}
                                <PencilBtn onClick={() => startEditCat(cat)} />
                                <button
                                  onClick={() => deactivateDefaultCat(cat.id)}
                                  style={{ fontSize: 12, color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', lineHeight: 1, fontFamily: 'var(--ui)' }}
                                  title="Remover"
                                >×</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* User SubCategories */}
                    {userSubs.map((sub, i) => {
                      const bc = essentialityToBudgetClass(sub.essentiality)
                      const badge = badgeStyle(bc)
                      const isEditingSub = inlineEdit?.id === sub.id
                      const subIcon = (sub as SubCategory & { icon?: string }).icon
                      return (
                        <div key={sub.id} style={{
                          borderBottom: i < userSubs.length - 1 ? '1px solid var(--line)' : 'none',
                          opacity: sub.active ? 1 : 0.5,
                        }}>
                          {isEditingSub ? (
                            <InlineEditRow
                              edit={inlineEdit}
                              color={macro.color}
                              onChangeEdit={setInlineEdit}
                              onSave={() => void saveInlineEdit()}
                              onCancel={() => setInlineEdit(null)}
                              showActive
                              indent
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 14px 9px 36px' }}>
                              <span style={{ marginTop: 1, flexShrink: 0, color: macro.color, opacity: 0.55 }}>
                                <IconComp name={subIcon ?? macro.icon} size={13} color={macro.color} />
                              </span>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>{sub.name}</span>
                                  {!sub.active && <span style={{ fontSize: 10, color: 'var(--faint)' }}>desativada</span>}
                                </div>
                                {sub.keywords?.length ? (
                                  <span style={{ fontSize: 10.5, color: 'var(--faint)', lineHeight: 1.4 }}>
                                    {sub.keywords.join(', ')}
                                  </span>
                                ) : null}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 1 }}>
                                {badge && (
                                  <span style={{
                                    fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                                    background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                                  }}>{BUDGET_CLASSIFICATION_LABELS[bc]}</span>
                                )}
                                <PencilBtn onClick={() => startEditSub(sub)} />
                                <button
                                  onClick={() => removeSubCat(sub.id)}
                                  style={{ fontSize: 12, color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', lineHeight: 1, fontFamily: 'var(--ui)' }}
                                  title="Remover"
                                >×</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {defaults.length === 0 && userSubs.length === 0 && (
                      <div style={{ padding: '12px 16px 12px 36px', fontSize: 12, color: 'var(--faint)' }}>
                        Nenhuma subcategoria.
                      </div>
                    )}

                    <div style={{ padding: '8px 14px 8px 36px', borderTop: '1px solid var(--line)' }}>
                      <button
                        onClick={() => setModal({ ...MODAL_BLANK, open: true, type: tab, parentMacroId: macro.id })}
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

      {/* Create modal */}
      {modal.open && (
        <CreateModal
          modal={modal} setModal={setModal}
          allMacros={allMacros}
          onAddKeyword={addKeyword} onRemoveKeyword={removeKeyword}
          onKwKeyDown={handleKwKeyDown}
          onSave={() => void saveModal()}
          onClose={() => setModal(MODAL_BLANK)}
        />
      )}

      {/* Apply keywords preview */}
      {kwPreview !== null && (
        <KwPreviewModal
          suggestions={kwPreview} allMacros={allMacros}
          applying={kwApplying} confidenceColor={confidenceColor}
          onApply={() => void applyKwSuggestions()}
          onClose={() => setKwPreview(null)}
        />
      )}
    </main>
  )
}

// ─── PencilBtn ────────────────────────────────────────────────────────────────

function PencilBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      title="Editar"
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px',
        borderRadius: 4, color: 'var(--faint)', display: 'flex', alignItems: 'center',
        lineHeight: 1, flexShrink: 0,
      }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-2)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--faint)')}
    >
      <Pencil size={12} strokeWidth={2} />
    </button>
  )
}

// ─── InlineEditRow ────────────────────────────────────────────────────────────

function InlineEditRow({
  edit, color, onChangeEdit, onSave, onCancel, showActive, indent, borderBottom,
}: {
  edit: InlineEdit
  color: string
  onChangeEdit: React.Dispatch<React.SetStateAction<InlineEdit | null>>
  onSave: () => void
  onCancel: () => void
  showActive: boolean
  indent?: boolean
  borderBottom?: boolean
}) {
  const pl = indent ? 36 : 14

  const upd = (patch: Partial<InlineEdit>) => onChangeEdit(prev => prev ? { ...prev, ...patch } : prev)

  return (
    <div style={{
      padding: `10px 14px 12px ${pl}px`,
      background: 'var(--accent-soft)',
      borderBottom: borderBottom ? '1px solid var(--line)' : 'none',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Row 1: icon + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconPicker value={edit.icon} onChange={icon => upd({ icon })} color={color} />
        {edit.nameReadOnly ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{edit.name}</span>
        ) : (
          <input
            value={edit.name}
            onChange={e => upd({ name: e.target.value })}
            className="login-field"
            style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}
            autoFocus
          />
        )}
        <button
          onClick={onSave}
          style={{
            background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6,
            padding: '4px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}
        ><Check size={11} />Salvar</button>
        <button
          onClick={onCancel}
          style={{
            background: 'none', border: '1px solid var(--line)', borderRadius: 6,
            padding: '4px 8px', fontSize: 11.5, color: 'var(--faint)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', flexShrink: 0,
          }}
        ><XIcon size={11} /></button>
      </div>

      {/* Row 2: keywords */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', flexShrink: 0 }}>Keywords</span>
        <input
          value={edit.kwText}
          onChange={e => upd({ kwText: e.target.value })}
          placeholder="supermercado, delivery, mercado..."
          className="login-field"
          style={{ fontSize: 11.5, flex: 1 }}
        />
      </div>

      {/* Row 3: budget + classificação + active */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', flexShrink: 0 }}>Orçamento</span>
        <select
          value={edit.budgetClassification}
          onChange={e => upd({ budgetClassification: e.target.value as BudgetClassification })}
          className="ledger-select"
          style={{ fontSize: 11.5 }}
        >
          <option value="none">Sem classificação</option>
          <option value="essential">Essencial</option>
          <option value="non_essential">Não essencial</option>
        </select>
        {showActive && (
          <>
            <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginLeft: 8 }}>Status</span>
            <ToggleGroup
              options={[{ value: 'true', label: 'Ativo' }, { value: 'false', label: 'Inativo' }]}
              value={edit.active ? 'true' : 'false'}
              onChange={v => upd({ active: v === 'true' })}
              small
            />
          </>
        )}
      </div>
    </div>
  )
}

// ─── IconPicker ───────────────────────────────────────────────────────────────

function IconPicker({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Mudar ícone"
        style={{
          width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
          background: `${color}18`, border: `1px solid ${color}30`, color,
        }}
      >
        <IconComp name={value} size={14} color={color} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 34, left: 0, zIndex: 200,
          background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 10,
          padding: 8, display: 'grid', gridTemplateColumns: 'repeat(6, 30px)', gap: 3,
          boxShadow: '0 6px 24px rgba(0,0,0,.14)',
        }}>
          {ICON_ENTRIES.map(([name, Ic]) => (
            <button
              key={name}
              onClick={() => { onChange(name); setOpen(false) }}
              title={name}
              style={{
                width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', border: 'none',
                background: value === name ? 'var(--accent-soft)' : 'none',
                color: value === name ? 'var(--accent)' : 'var(--ink-2)',
              }}
            >
              <Ic size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, color, small }: { label: string; color: string; small?: boolean }) {
  return (
    <span style={{
      fontSize: small ? 8.5 : 9, fontWeight: 700, padding: small ? '1px 4px' : '1px 5px',
      borderRadius: 3, background: `${color}18`, color, border: `1px solid ${color}30`, letterSpacing: '.04em',
    }}>
      {label.toUpperCase()}
    </span>
  )
}

// ─── CreateModal ──────────────────────────────────────────────────────────────

interface CreateModalProps {
  modal: ModalState
  setModal: React.Dispatch<React.SetStateAction<ModalState>>
  allMacros: MacroCategory[]
  onAddKeyword: (kw: string) => void
  onRemoveKeyword: (kw: string) => void
  onKwKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onSave: () => void
  onClose: () => void
}

function CreateModal({ modal, setModal, allMacros, onAddKeyword, onRemoveKeyword, onKwKeyDown, onSave, onClose }: CreateModalProps) {
  const isParent = !modal.parentMacroId
  const typeLabel = isParent ? 'categoria' : 'subcategoria'
  const parentOptions = allMacros
    .filter(m => m.tabType === modal.type || m.tabType === 'both')
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(16,15,10,.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--card-bg)', borderRadius: 14,
        boxShadow: '0 12px 40px rgba(0,0,0,.22)',
        width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '18px 22px 14px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 750, color: 'var(--ink)', margin: 0 }}>Nova {typeLabel}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--faint)', lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Tipo */}
          {isParent && (
            <Field label="Tipo">
              <ToggleGroup
                options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]}
                value={modal.type}
                onChange={v => setModal(m => ({ ...m, type: v as ActiveTab }))}
              />
            </Field>
          )}

          {/* Categoria Pai */}
          {!isParent && (
            <Field label="Categoria Pai">
              <select
                value={modal.parentMacroId}
                onChange={e => setModal(m => ({ ...m, parentMacroId: e.target.value }))}
                className="ledger-select"
                style={{ fontSize: 12.5, width: '100%' }}
              >
                <option value="">Nenhuma (criar categoria principal)</option>
                {parentOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          )}

          {/* Ícone + Nome */}
          <Field label="Nome">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <IconPicker value={modal.icon} onChange={v => setModal(m => ({ ...m, icon: v }))} color="var(--accent)" />
              <input
                value={modal.name}
                onChange={e => setModal(m => ({ ...m, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') void onSave() }}
                placeholder={isParent ? 'Ex: Alimentação' : 'Ex: Açougue'}
                className="login-field"
                style={{ fontSize: 13, flex: 1 }}
                autoFocus
              />
            </div>
          </Field>

          {/* Classificação */}
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

          {/* Keywords */}
          <Field label="Palavras-chave para organização automática">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 5, minHeight: 36,
                padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 8,
                background: 'var(--well)',
              }}>
                {modal.keywords.length === 0 && (
                  <span style={{ fontSize: 11.5, color: 'var(--faint)', alignSelf: 'center' }}>Nenhuma palavra-chave</span>
                )}
                {modal.keywords.map(kw => (
                  <span key={kw} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                    border: '1px solid var(--accent-border)',
                  }}>
                    {kw}
                    <button onClick={() => onRemoveKeyword(kw)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1, color: 'var(--faint)' }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={modal.kwDraft}
                  onChange={e => setModal(m => ({ ...m, kwDraft: e.target.value }))}
                  onKeyDown={onKwKeyDown}
                  placeholder="Ex: supermercado — Enter para adicionar"
                  className="login-field"
                  style={{ fontSize: 12, flex: 1 }}
                />
                <button className="btn btn-secondary btn-sm" onClick={() => onAddKeyword(modal.kwDraft)} style={{ flexShrink: 0 }}>
                  Adicionar
                </button>
              </div>
            </div>
          </Field>
        </div>

        <div style={{
          padding: '14px 22px', borderTop: '1px solid var(--line)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          position: 'sticky', bottom: 0, background: 'var(--card-bg)',
        }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={() => void onSave()} disabled={!modal.name.trim()}>
            Criar {typeLabel}
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
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--card-bg)', borderRadius: 14,
        boxShadow: '0 12px 40px rgba(0,0,0,.22)',
        width: '100%', maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '18px 22px 14px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1,
        }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 750, color: 'var(--ink)', margin: 0 }}>Lançamentos sem categoria</h3>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 3 }}>
              {suggestions.length === 0
                ? 'Nenhum lançamento encontrado com sugestão de keyword.'
                : `${suggestions.length} sugestão${suggestions.length !== 1 ? 'ões' : ''} encontrada${suggestions.length !== 1 ? 's' : ''}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--faint)', lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 0' }}>
          {suggestions.length === 0 ? (
            <div style={{ padding: '20px 22px', fontSize: 13, color: 'var(--faint)', textAlign: 'center' }}>
              Todos os lançamentos já têm categoria ou nenhuma keyword correspondeu.
            </div>
          ) : suggestions.map(s => {
            const macro = macroMap.get(s.macroCategoryId)
            return (
              <div key={s.tx.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 22px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 2 }}>{s.tx.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--faint)' }}>{s.tx.competenceDate} · R$ {Math.abs(s.tx.amount).toFixed(2)}</div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: macro?.color ?? 'var(--ink-2)' }}>{macro?.name ?? s.macroCategoryId}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>via <em>{s.matchedKeyword}</em></div>
                  <div style={{ fontSize: 10, color: confidenceColor(s.confidence), fontWeight: 700 }}>
                    {s.confidence === 'high' ? 'Alta' : s.confidence === 'medium' ? 'Média' : 'Baixa'} confiança
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8, position: 'sticky', bottom: 0, background: 'var(--card-bg)' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Fechar</button>
          {suggestions.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={onApply} disabled={applying}>
              {applying ? 'Aplicando…' : `Aplicar ${suggestions.length} sugestão${suggestions.length !== 1 ? 'ões' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── ToggleGroup ──────────────────────────────────────────────────────────────

function ToggleGroup({ options, value, onChange, small }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  small?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: small ? '3px 10px' : '5px 16px', fontSize: small ? 11 : 12.5,
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
