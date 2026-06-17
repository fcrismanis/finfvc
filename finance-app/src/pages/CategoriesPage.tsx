import { useState, useMemo } from 'react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES, CATEGORIES } from '../config/categories'
import { loadCustomCategories, upsertCustomCategory } from '../services/financeCategories.service'
import {
  loadCustomMacroCategories,
  upsertCustomMacroCategory,
} from '../services/financeParentCategories.service'
import { BUDGET_CLASSIFICATION_LABELS } from '../services/categoryHelpers'
import type { MacroCategory, Category, BudgetClassification, CategoryTabType } from '../types'

interface Props {
  onNavigate?: (route: string) => void
}

type ActiveTab = 'expense' | 'income'

// ─── modal state ─────────────────────────────────────────────────────────────

interface ModalState {
  open: boolean
  // editing existing
  editMacroId?: string
  editCategoryId?: string
  // fields
  name: string
  type: ActiveTab
  parentMacroId: string // '' = creating parent
  keywords: string[]
  kwDraft: string
  budgetClassification: BudgetClassification
  group: 'personal' | 'business'
  icon: string
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
  icon: 'tag',
}

// ─── component ───────────────────────────────────────────────────────────────

export function CategoriesPage({ onNavigate: _onNavigate }: Props) {
  useData()
  const [tab, setTab] = useState<ActiveTab>('expense')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal] = useState<ModalState>(MODAL_BLANK)
  const [customMacros, setCustomMacros] = useState<MacroCategory[]>(() => loadCustomMacroCategories())
  const [customCats, setCustomCats] = useState<Category[]>(() => loadCustomCategories())

  // All macros visible in this tab
  const allMacros = useMemo(
    () => [...MACRO_CATEGORIES, ...customMacros],
    [customMacros],
  )

  const allCats = useMemo(
    () => [...CATEGORIES, ...customCats],
    [customCats],
  )

  const tabMacros = useMemo(() => {
    return allMacros
      .filter(m => m.tabType === tab || m.tabType === 'both')
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [allMacros, tab])

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function getCategoriesForMacro(macroId: string): Category[] {
    return allCats
      .filter(c => c.macroCategoryId === macroId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function inactiveCount(): number {
    return tabMacros.filter(m => {
      const cats = getCategoriesForMacro(m.id)
      return cats.some(c => !c.active)
    }).length
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
      icon: macro.icon ?? 'tag',
    })
  }

  function openEditCat(cat: Category) {
    setModal({
      open: true,
      editCategoryId: cat.id,
      name: cat.name,
      type: tab,
      parentMacroId: cat.macroCategoryId,
      keywords: cat.keywords ?? [],
      kwDraft: '',
      budgetClassification: cat.budgetClassification ?? 'none',
      group: cat.group ?? 'personal',
      icon: cat.icon ?? 'tag',
    })
  }

  // ── save modal ──────────────────────────────────────────────────────────────

  function saveModal() {
    if (!modal.name.trim()) return
    const isParent = !modal.parentMacroId

    if (isParent) {
      // create / update parent category (MacroCategory)
      const tabType: CategoryTabType = modal.type === 'expense' ? 'expense' : 'income'
      const saved = upsertCustomMacroCategory({
        id: modal.editMacroId,
        name: modal.name.trim(),
        tabType,
        keywords: modal.keywords,
        budgetClassification: modal.budgetClassification,
        group: modal.group,
        icon: modal.icon,
      })
      setCustomMacros(prev => {
        const next = prev.filter(m => m.id !== saved.id)
        return [...next, saved]
      })
    } else {
      // create / update subcategory (Category)
      const macro = allMacros.find(m => m.id === modal.parentMacroId)
      if (!macro) return
      const saved = upsertCustomCategory({
        id: modal.editCategoryId,
        name: modal.name.trim(),
        macroCategoryId: modal.parentMacroId,
        classificationType: macro.classificationType,
        keywords: modal.keywords,
        budgetClassification: modal.budgetClassification,
        group: modal.group,
      })
      setCustomCats(prev => {
        const next = prev.filter(c => c.id !== saved.id)
        return [...next, saved]
      })
    }

    setModal(MODAL_BLANK)
  }

  // ── render helpers ──────────────────────────────────────────────────────────

  const kw = (keywords: string[] | undefined) => {
    if (!keywords?.length) return null
    return (
      <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 400 }}>
        {keywords.join(', ')}
      </span>
    )
  }

  // ── main render ─────────────────────────────────────────────────────────────

  const inCount = inactiveCount()

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
                : `Mostrar desativadas${inCount > 0 ? ` (${inCount})` : ''}`}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={openNewParent}
            >
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
                padding: '8px 20px',
                fontSize: 13, fontWeight: tab === t ? 750 : 500,
                color: tab === t ? 'var(--accent)' : 'var(--faint)',
                background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -2,
                cursor: 'pointer', fontFamily: 'var(--ui)',
              }}
            >
              {t === 'expense' ? 'Despesas' : 'Receitas'}
            </button>
          ))}
        </div>

        {/* Category list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tabMacros.map(macro => {
            const cats = getCategoriesForMacro(macro.id)
            const visibleCats = showInactive ? cats : cats.filter(c => c.active)
            const expanded = expandedIds.has(macro.id)

            return (
              <div key={macro.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Parent row */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: expanded ? '1px solid var(--line)' : 'none',
                  }}
                  onClick={() => toggleExpand(macro.id)}
                >
                  <span
                    style={{
                      width: 9, height: 9, borderRadius: 3, background: macro.color,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                        {macro.name}
                      </span>
                      {macro.isDefault && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                          background: `${macro.color}18`, color: macro.color, border: `1px solid ${macro.color}30`,
                          letterSpacing: '.04em',
                        }}>PADRÃO</span>
                      )}
                      {macro.isNeutral && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                          background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb',
                          letterSpacing: '.04em',
                        }}>NEUTRA</span>
                      )}
                    </div>
                    {kw(macro.keywords)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {visibleCats.length > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: `${macro.color}18`, color: macro.color, border: `1px solid ${macro.color}30`,
                      }}>
                        {visibleCats.length}
                      </span>
                    )}
                    {!macro.isDefault && (
                      <button
                        onClick={e => { e.stopPropagation(); openEditMacro(macro) }}
                        style={{
                          fontSize: 10, color: 'var(--faint)', background: 'none', border: 'none',
                          cursor: 'pointer', fontFamily: 'var(--ui)', padding: '2px 4px',
                        }}
                      >
                        editar
                      </button>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--faint)', userSelect: 'none' }}>
                      {expanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Subcategories */}
                {expanded && (
                  <div style={{ background: 'var(--well)' }}>
                    {visibleCats.length === 0 ? (
                      <div style={{ padding: '12px 16px 12px 36px', fontSize: 12, color: 'var(--faint)' }}>
                        Nenhuma subcategoria.
                      </div>
                    ) : (
                      visibleCats.map((cat, i) => (
                        <div
                          key={cat.id}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '9px 16px 9px 36px',
                            borderBottom: i < visibleCats.length - 1 ? '1px solid var(--line)' : 'none',
                            opacity: cat.active ? 1 : 0.5,
                          }}
                        >
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                              {cat.name}
                              {!cat.active && (
                                <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--faint)' }}>
                                  desativada
                                </span>
                              )}
                            </span>
                            {kw(cat.keywords)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {cat.budgetClassification && cat.budgetClassification !== 'none' && (
                              <span style={{
                                fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                                background: cat.budgetClassification === 'essential' ? '#dcfce7' : '#fef9c3',
                                color: cat.budgetClassification === 'essential' ? '#16a34a' : '#a16207',
                                border: `1px solid ${cat.budgetClassification === 'essential' ? '#bbf7d0' : '#fef08a'}`,
                              }}>
                                {BUDGET_CLASSIFICATION_LABELS[cat.budgetClassification]}
                              </span>
                            )}
                            <button
                              onClick={() => openEditCat(cat)}
                              style={{
                                fontSize: 10, color: 'var(--faint)', background: 'none', border: 'none',
                                cursor: 'pointer', fontFamily: 'var(--ui)', padding: '2px 4px',
                              }}
                            >
                              editar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                    {/* Add subcategory */}
                    <div style={{ padding: '8px 16px 8px 36px', borderTop: '1px solid var(--line)' }}>
                      <button
                        onClick={() => openNewSub(macro.id)}
                        style={{
                          fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)',
                        }}
                      >
                        + Adicionar subcategoria
                      </button>
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
        <ModalOverlay onClose={() => setModal(MODAL_BLANK)}>
          <ModalForm
            modal={modal}
            setModal={setModal}
            allMacros={[...MACRO_CATEGORIES, ...customMacros]}
            onAddKeyword={addKeyword}
            onRemoveKeyword={removeKeyword}
            onKwKeyDown={handleKwKeyDown}
            onSave={saveModal}
            onClose={() => setModal(MODAL_BLANK)}
          />
        </ModalOverlay>
      )}
    </main>
  )
}

// ─── modal overlay ────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}

// ─── modal form ───────────────────────────────────────────────────────────────

interface ModalFormProps {
  modal: ModalState
  setModal: React.Dispatch<React.SetStateAction<ModalState>>
  allMacros: MacroCategory[]
  onAddKeyword: (kw: string) => void
  onRemoveKeyword: (kw: string) => void
  onKwKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onSave: () => void
  onClose: () => void
}

function ModalForm({
  modal, setModal, allMacros,
  onAddKeyword, onRemoveKeyword, onKwKeyDown,
  onSave, onClose,
}: ModalFormProps) {
  const isEditing = Boolean(modal.editMacroId || modal.editCategoryId)
  const isParent = !modal.parentMacroId

  const typeLabel = isParent ? 'categoria pai' : 'subcategoria'
  const title = isEditing
    ? `Editar ${typeLabel}`
    : `Nova ${typeLabel}`

  const parentOptions = allMacros
    .filter(m => m.tabType === modal.type || m.tabType === 'both')
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div
      style={{
        background: 'var(--surface)', borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        width: '100%', maxWidth: 480,
        display: 'flex', flexDirection: 'column', gap: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px 20px 14px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)' }}>{title}</h3>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--faint)' }}
        >×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Grupo */}
        <FieldRow label="Grupo">
          <ToggleGroup
            options={[{ value: 'personal', label: 'Pessoal' }, { value: 'business', label: 'Negócio' }]}
            value={modal.group}
            onChange={v => setModal(m => ({ ...m, group: v as 'personal' | 'business' }))}
          />
        </FieldRow>

        {/* Tipo */}
        {isParent && (
          <FieldRow label="Tipo">
            <ToggleGroup
              options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]}
              value={modal.type}
              onChange={v => setModal(m => ({ ...m, type: v as ActiveTab }))}
            />
          </FieldRow>
        )}

        {/* Categoria Pai */}
        {!isParent || isEditing ? null : null}
        <FieldRow label="Categoria Pai">
          <select
            value={modal.parentMacroId}
            onChange={e => setModal(m => ({ ...m, parentMacroId: e.target.value }))}
            className="ledger-select"
            style={{ fontSize: 12, width: '100%' }}
          >
            <option value="">Nenhuma (criar categoria pai)</option>
            {parentOptions.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </FieldRow>

        {/* Nome */}
        <FieldRow label="Nome">
          <input
            value={modal.name}
            onChange={e => setModal(m => ({ ...m, name: e.target.value }))}
            placeholder={isParent ? 'Ex: Alimentação' : 'Ex: Açougue'}
            className="login-field"
            style={{ fontSize: 13, width: '100%' }}
            autoFocus
          />
        </FieldRow>

        {/* Classificação */}
        <FieldRow label="Classificação do Orçamento">
          <select
            value={modal.budgetClassification}
            onChange={e => setModal(m => ({ ...m, budgetClassification: e.target.value as BudgetClassification }))}
            className="ledger-select"
            style={{ fontSize: 12, width: '100%' }}
          >
            <option value="none">Sem classificação</option>
            <option value="essential">Essencial</option>
            <option value="non_essential">Não essencial</option>
          </select>
        </FieldRow>

        {/* Keywords */}
        <FieldRow label="Palavras-chave para organização automática">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 5,
              minHeight: 32, padding: '4px 6px',
              border: '1px solid var(--line)', borderRadius: 6,
              background: 'var(--well)',
            }}>
              {modal.keywords.map(kw => (
                <span key={kw} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  background: 'var(--accent-soft)', color: 'var(--ink-2)',
                  fontSize: 11, fontWeight: 600,
                  padding: '2px 7px', borderRadius: 4,
                  border: '1px solid var(--accent-border)',
                }}>
                  {kw}
                  <button
                    onClick={() => onRemoveKeyword(kw)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 0, fontSize: 12, lineHeight: 1, color: 'var(--faint)',
                    }}
                  >×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={modal.kwDraft}
                onChange={e => setModal(m => ({ ...m, kwDraft: e.target.value }))}
                onKeyDown={onKwKeyDown}
                placeholder="Digite e pressione Enter"
                className="login-field"
                style={{ fontSize: 12, flex: 1 }}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onAddKeyword(modal.kwDraft)}
                style={{ fontSize: 11 }}
              >
                + Add
              </button>
            </div>
          </div>
        </FieldRow>

      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 20px', borderTop: '1px solid var(--line)',
        display: 'flex', justifyContent: 'flex-end', gap: 8,
      }}>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-primary btn-sm"
          onClick={onSave}
          disabled={!modal.name.trim()}
        >
          {isEditing ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </div>
  )
}

// ─── small helpers ─────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

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
            padding: '5px 14px', fontSize: 12, fontWeight: value === o.value ? 700 : 400,
            color: value === o.value ? 'var(--accent)' : 'var(--ink-2)',
            background: value === o.value ? 'var(--accent-soft)' : 'var(--well)',
            border: `1px solid ${value === o.value ? 'var(--accent-border)' : 'var(--line)'}`,
            borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--ui)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
