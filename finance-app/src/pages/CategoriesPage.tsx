import { useState, useMemo, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES, CATEGORIES } from '../config/categories'
import {
  loadCustomMacroCategories,
  upsertCustomMacroCategory,
} from '../services/financeParentCategories.service'
import { BUDGET_CLASSIFICATION_LABELS } from '../services/categoryHelpers'
import { newSubCategoryId } from '../services/subcategory.service'
import type {
  MacroCategory, SubCategory, SubCategoryEssentiality,
  BudgetClassification, CategoryTabType,
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

interface ModalState {
  open: boolean
  // editing an existing SubCategory
  editSubId?: string
  // editing an existing custom MacroCategory
  editMacroId?: string
  // fields
  name: string
  type: ActiveTab
  parentMacroId: string  // '' = creating parent category
  keywords: string[]
  kwDraft: string
  budgetClassification: BudgetClassification
  group: 'personal' | 'business'
}

const MODAL_BLANK: ModalState = {
  open: false,
  name: '',
  type: 'expense',
  parentMacroId: '',
  keywords: [],
  kwDraft: '',
  budgetClassification: 'none',
  group: 'personal',
}

// ─── Migration (idempotent) ───────────────────────────────────────────────────
// Ensures all legacy SubCategories have keywords field (no data changes needed
// since we now display SubCategories directly in the tree).

function migrateLegacySubcategoriesIntoCategories(subs: SubCategory[]): void {
  const DONE_KEY = 'fin_subcats_migrated_v1'
  if (localStorage.getItem(DONE_KEY)) return
  // Migration is display-only: SubCategories now appear in CategoriesPage tree.
  // No structural data changes needed. Just mark as done.
  localStorage.setItem(DONE_KEY, '1')
  if (subs.length > 0) {
    console.log(`[CategoriesPage] Legacy migration: ${subs.length} subcats now visible in category tree`)
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CategoriesPage({ onNavigate: _onNavigate }: Props) {
  const { subCategories, saveSubCategory, deleteSubCategory } = useData()
  const [tab, setTab] = useState<ActiveTab>('expense')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal] = useState<ModalState>(MODAL_BLANK)
  const [customMacros, setCustomMacros] = useState<MacroCategory[]>(() => loadCustomMacroCategories())

  // Run migration once
  useEffect(() => {
    migrateLegacySubcategoriesIntoCategories(subCategories)
  }, [subCategories])

  // All macros for the current tab
  const allMacros = useMemo(
    () => [...MACRO_CATEGORIES, ...customMacros],
    [customMacros],
  )

  const tabMacros = useMemo(() => {
    return allMacros
      .filter(m => m.tabType === tab || m.tabType === 'both')
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [allMacros, tab])

  // For a given macro: static default categories + user SubCategories
  function getDefaultsForMacro(macroId: string) {
    return CATEGORIES.filter(c => c.macroCategoryId === macroId && c.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function getSubCatsForMacro(macroId: string): SubCategory[] {
    return subCategories
      .filter(s => s.macroCategoryId === macroId)
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
      open: true,
      editMacroId: macro.id,
      name: macro.name,
      type: (macro.tabType === 'income' ? 'income' : 'expense') as ActiveTab,
      parentMacroId: '',
      keywords: macro.keywords ?? [],
      kwDraft: '',
      budgetClassification: macro.budgetClassification ?? 'none',
      group: macro.group ?? 'personal',
    })
  }

  function openEditSub(sub: SubCategory) {
    setModal({
      open: true,
      editSubId: sub.id,
      name: sub.name,
      type: tab,
      parentMacroId: sub.macroCategoryId,
      keywords: sub.keywords ?? [],
      kwDraft: '',
      budgetClassification: essentialityToBudgetClass(sub.essentiality),
      group: 'personal',
    })
  }

  async function removeSubCat(id: string) {
    if (!confirm('Remover subcategoria? Lançamentos existentes não serão afetados.')) return
    await deleteSubCategory(id)
  }

  // ── save modal ──────────────────────────────────────────────────────────────

  async function saveModal() {
    if (!modal.name.trim()) return
    const isParent = !modal.parentMacroId

    if (isParent) {
      // Create/update a custom parent category (MacroCategory)
      const tabType: CategoryTabType = modal.type === 'expense' ? 'expense' : 'income'
      const saved = upsertCustomMacroCategory({
        id: modal.editMacroId,
        name: modal.name.trim(),
        tabType,
        keywords: modal.keywords,
        budgetClassification: modal.budgetClassification,
        group: modal.group,
      })
      setCustomMacros(prev => [...prev.filter(m => m.id !== saved.id), saved])
    } else {
      // Create/update a SubCategory (compatible with Review, Transactions, Assistant)
      const sub: SubCategory = {
        id: modal.editSubId ?? newSubCategoryId(),
        name: modal.name.trim(),
        macroCategoryId: modal.parentMacroId,
        essentiality: budgetClassToEssentiality(modal.budgetClassification),
        active: true,
        createdAt: new Date().toISOString(),
        keywords: modal.keywords,
      }
      await saveSubCategory(sub)
    }

    setModal(MODAL_BLANK)
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
            const visibleSubs = showInactive ? userSubs : userSubs.filter(s => s.active)
            const expanded = expandedIds.has(macro.id)
            const totalCount = defaults.length + visibleSubs.length

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
                      {macro.isDefault && (
                        <Chip label="Padrão" color={macro.color} />
                      )}
                      {macro.isNeutral && (
                        <Chip label="Neutra" color="#9CA3AF" />
                      )}
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
                    {!macro.isDefault && (
                      <button
                        onClick={e => { e.stopPropagation(); openEditMacro(macro) }}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 10, padding: '2px 6px' }}
                      >editar</button>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--faint)', userSelect: 'none' }}>
                      {expanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Expanded: defaults then user subs */}
                {expanded && (
                  <div style={{ background: 'var(--well)' }}>
                    {/* Static defaults (read-only) */}
                    {defaults.map((cat, i) => {
                      const bc = cat.budgetClassification ?? 'none'
                      const badge = badgeClass(bc)
                      return (
                        <div key={cat.id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '9px 16px 9px 36px',
                          borderBottom: (i < defaults.length - 1 || visibleSubs.length > 0) ? '1px solid var(--line)' : 'none',
                        }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>{cat.name}</span>
                              <Chip label="Padrão" color="#94a3b8" small />
                            </div>
                            {kwRow(cat.keywords)}
                          </div>
                          {badge && (
                            <span style={{
                              fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                              background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                              flexShrink: 0,
                            }}>{BUDGET_CLASSIFICATION_LABELS[bc]}</span>
                          )}
                        </div>
                      )
                    })}

                    {/* User-created SubCategories */}
                    {visibleSubs.map((sub, i) => {
                      const bc = essentialityToBudgetClass(sub.essentiality)
                      const badge = badgeClass(bc)
                      return (
                        <div key={sub.id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '9px 16px 9px 36px',
                          borderBottom: i < visibleSubs.length - 1 ? '1px solid var(--line)' : 'none',
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

                    {defaults.length === 0 && visibleSubs.length === 0 && (
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

      {/* Modal */}
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
  const isEditing = Boolean(modal.editSubId || modal.editMacroId)
  const isParent = !modal.parentMacroId
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
          <Field label="Grupo">
            <ToggleGroup
              options={[{ value: 'personal', label: 'Pessoal' }, { value: 'business', label: 'Negócio' }]}
              value={modal.group}
              onChange={v => setModal(m => ({ ...m, group: v as 'personal' | 'business' }))}
            />
          </Field>

          {/* Tipo (only when creating parent) */}
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

          {/* Nome */}
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

          {/* Palavras-chave */}
          <Field label="Palavras-chave para organização automática">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Tag chips */}
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
            disabled={!modal.name.trim()}
          >
            {isEditing ? 'Salvar alterações' : `Criar ${typeLabel}`}
          </button>
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
