import { useState, useMemo, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { CATEGORIES } from '../config/categories'
import { ICON_MAP } from '../utils/categoryIcons'
import type { MacroCategory, SubCategory } from '../types'

export function TxCatIcon({ iconName, size = 12, color }: { iconName?: string; size?: number; color?: string }) {
  const Ic = iconName ? (ICON_MAP[iconName] ?? null) : null
  if (!Ic) return null
  return <Ic size={size} color={color} strokeWidth={2} />
}

export function CategorySelector({
  macroCategoryId,
  subCategoryId,
  allMacros,
  subCategories,
  onChange,
  defaultOpen = false,
  onClose,
}: {
  macroCategoryId?: string
  subCategoryId?: string
  allMacros: MacroCategory[]
  subCategories: SubCategory[]
  onChange: (macroId: string | undefined, subId: string | undefined) => void
  defaultOpen?: boolean
  onClose?: () => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  function closeDropdown() {
    setOpen(false)
    onClose?.()
  }

  const selectedMacro = allMacros.find(m => m.id === macroCategoryId)
  const selectedSub = subCategoryId
    ? subCategories.find(s => s.id === subCategoryId) ??
      (CATEGORIES.find(c => c.id === subCategoryId)
        ? { id: subCategoryId, name: CATEGORIES.find(c => c.id === subCategoryId)!.name, macroCategoryId: CATEGORIES.find(c => c.id === subCategoryId)!.macroCategoryId, essentiality: 'inherit' as const, active: true, createdAt: '' }
        : null)
    : null

  const label = selectedMacro
    ? selectedSub
      ? `${selectedMacro.name} › ${selectedSub.name}`
      : selectedMacro.name
    : 'Sem categoria'

  function getEffectiveSubs(macroId: string): SubCategory[] {
    const staticSubs: SubCategory[] = CATEGORIES
      .filter(c => c.macroCategoryId === macroId && c.active)
      .map(c => ({
        id: c.id, name: c.name, macroCategoryId: c.macroCategoryId,
        essentiality: 'inherit' as const, active: true,
        createdAt: '', keywords: c.keywords, icon: c.icon,
      }))
    const userSubs = subCategories.filter(s => s.macroCategoryId === macroId && s.active)
    const staticIds = new Set(staticSubs.map(s => s.id))
    const merged = [...staticSubs, ...userSubs.filter(s => !staticIds.has(s.id))]
    return merged.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }

  function buildGroup(m: MacroCategory, q: string) {
    const allSubs = getEffectiveSubs(m.id)
    if (!q) return { macro: m, subs: allSubs }
    const macroHit = m.name.toLowerCase().includes(q) ||
      (m.keywords ?? []).some(k => k.toLowerCase().includes(q))
    const matchSubs = allSubs.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.keywords ?? []).some(k => k.toLowerCase().includes(q))
    )
    if (!macroHit && matchSubs.length === 0) return null
    return { macro: m, subs: macroHit ? allSubs : matchSubs }
  }

  const { incomeGroups, expenseGroups, totalCount } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const visibleMacros = allMacros
      .filter(m => m.tabType !== 'none')
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99) || a.name.localeCompare(b.name, 'pt-BR'))

    const income = visibleMacros
      .filter(m => m.tabType === 'income' || m.tabType === 'both')
      .map(m => buildGroup(m, q))
      .filter((g): g is NonNullable<typeof g> => g !== null)

    const expense = visibleMacros
      .filter(m => m.tabType === 'expense' || m.tabType === 'both')
      .map(m => buildGroup(m, q))
      .filter((g): g is NonNullable<typeof g> => g !== null)

    return { incomeGroups: income, expenseGroups: expense, totalCount: income.length + expense.length }
  }, [allMacros, subCategories, search])

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function renderGroup(macro: MacroCategory, subs: SubCategory[]) {
    const isOpen = !!search.trim() || expanded.has(macro.id) || macroCategoryId === macro.id
    const hasSubs = subs.length > 0
    return (
      <div key={macro.id}>
        <div
          style={{
            display: 'flex', alignItems: 'center', width: '100%',
            background: macroCategoryId === macro.id && !subCategoryId ? 'var(--accent-soft)' : 'transparent',
          }}
        >
          <button
            type="button"
            onClick={() => { onChange(macro.id, undefined); closeDropdown(); setSearch('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, flex: 1,
              padding: '7px 14px', textAlign: 'left', fontSize: 12.5, fontWeight: 600,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: macro.color ?? 'var(--ink)', fontFamily: 'var(--ui)',
            }}
          >
            <TxCatIcon iconName={macro.icon} size={13} color={macro.color} />
            {macro.name}
          </button>
          {hasSubs && (
            <button
              type="button"
              aria-label={isOpen ? 'Recolher' : 'Expandir'}
              onClick={() => setExpanded(prev => {
                const next = new Set(prev)
                if (next.has(macro.id)) next.delete(macro.id); else next.add(macro.id)
                return next
              })}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '7px 12px', color: 'var(--faint)', flexShrink: 0,
              }}
            >
              <ChevronDown
                size={12}
                style={{ transition: 'transform 160ms ease', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              />
            </button>
          )}
        </div>
        {isOpen && subs.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => { onChange(macro.id, s.id); closeDropdown(); setSearch('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, width: '100%',
              padding: '5px 14px 5px 34px', textAlign: 'left', fontSize: 11.5,
              background: subCategoryId === s.id ? 'var(--accent-soft)' : 'transparent',
              border: 'none', cursor: 'pointer', color: 'var(--ink-2)',
              fontFamily: 'var(--ui)',
            }}
          >
            <TxCatIcon iconName={s.icon ?? macro.icon} size={11} color={macro.color} />
            {s.name}
          </button>
        ))}
      </div>
    )
  }

  const iconName = selectedSub?.icon ?? selectedMacro?.icon

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => { if (open) closeDropdown(); else setOpen(true) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)',
          background: 'var(--paper)', cursor: 'pointer', fontSize: 12.5,
          color: selectedMacro ? 'var(--ink)' : 'var(--faint)',
          fontFamily: 'var(--ui)', textAlign: 'left',
        }}
      >
        {selectedMacro && iconName && (
          <TxCatIcon iconName={iconName} size={13} color={selectedMacro.color} />
        )}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <ChevronDown size={12} color="var(--faint)" />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--card-bg)', border: '1px solid var(--line)',
          borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,.14)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou keyword…"
              style={{
                width: '100%', fontSize: 12, padding: '5px 8px', borderRadius: 6,
                border: '1px solid var(--line)', outline: 'none',
                background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'var(--ui)',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <button
              type="button"
              onClick={() => { onChange(undefined, undefined); closeDropdown(); setSearch('') }}
              style={{
                display: 'block', width: '100%', padding: '7px 14px', textAlign: 'left',
                fontSize: 12, background: 'transparent', border: 'none', cursor: 'pointer',
                color: !macroCategoryId ? 'var(--accent)' : 'var(--faint)',
                fontFamily: 'var(--ui)', borderBottom: '1px solid var(--line)',
              }}
            >
              Sem categoria
            </button>

            {totalCount === 0 && (
              <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--faint)', textAlign: 'center' }}>
                Nenhuma categoria encontrada
              </div>
            )}

            {incomeGroups.length > 0 && (
              <>
                <div style={{
                  padding: '5px 14px 3px',
                  fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em',
                  textTransform: 'uppercase', color: 'var(--pos)',
                  background: 'var(--well)',
                  borderTop: '1px solid var(--line)',
                }}>
                  Receitas
                </div>
                {incomeGroups.map(({ macro, subs }) => renderGroup(macro, subs))}
              </>
            )}

            {expenseGroups.length > 0 && (
              <>
                <div style={{
                  padding: '5px 14px 3px',
                  fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em',
                  textTransform: 'uppercase', color: 'var(--crit)',
                  background: 'var(--well)',
                  borderTop: '1px solid var(--line)',
                }}>
                  Despesas
                </div>
                {expenseGroups.map(({ macro, subs }) => renderGroup(macro, subs))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
