import { useState, useMemo } from 'react'
import { Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import { MACRO_CATEGORIES } from '../config/categories'
import { useData } from '../context/DataContext'
import {
  loadRules, deleteRule, toggleRule, updateRule, upsertRule,
  type CategoryRule,
} from '../services/categoryRules.service'

const ORIGIN_LABEL: Record<CategoryRule['origin'], string> = {
  manual: 'Manual', pluggy: 'Pluggy', csv: 'CSV',
}

export function CategoryRulesPage() {
  const { subCategories } = useData()
  const [rules, setRules] = useState<CategoryRule[]>(() => loadRules())
  const [newPattern, setNewPattern] = useState('')
  const [newMacro, setNewMacro] = useState('')

  function refresh() { setRules(loadRules()) }

  const sorted = useMemo(
    () => [...rules].sort((a, b) => b.useCount - a.useCount || a.pattern.localeCompare(b.pattern)),
    [rules]
  )

  function handleAdd() {
    if (!newPattern.trim() || !newMacro) return
    upsertRule({ pattern: newPattern, macroCategoryId: newMacro, origin: 'manual' })
    setNewPattern(''); setNewMacro(''); refresh()
  }

  function handleDelete(id: string) {
    if (!confirm('Remover esta regra aprendida?')) return
    deleteRule(id); refresh()
  }

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Regras de categoria</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Quando você corrige uma categoria, o FIN aprende uma regra. Próximas importações parecidas já vêm classificadas.
          </div>
        </div>

        {/* Add rule */}
        <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={newPattern}
            onChange={e => setNewPattern(e.target.value)}
            placeholder="Texto (ex: AGGILE ENGLISH)"
            className="login-field"
            style={{ fontSize: 12.5, flex: '1 1 200px' }}
          />
          <select value={newMacro} onChange={e => setNewMacro(e.target.value)} className="ledger-select" style={{ fontSize: 12 }}>
            <option value="">Categoria…</option>
            {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" disabled={!newPattern.trim() || !newMacro} onClick={handleAdd}>
            <Plus size={13} /> Adicionar regra
          </button>
        </div>

        {/* Rules list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {sorted.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Nenhuma regra aprendida ainda</h4>
              <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 320, textAlign: 'center' }}>
                Corrija a categoria de um lançamento ou adicione uma regra manual acima.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                <thead>
                  <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                    <th className="table-th">Padrão</th>
                    <th className="table-th">Categoria</th>
                    <th className="table-th">Subcategoria</th>
                    <th className="table-th">Origem</th>
                    <th className="table-th table-th-right">Usos</th>
                    <th className="table-th">Ativa</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(rule => {
                    const macro = MACRO_CATEGORIES.find(m => m.id === rule.macroCategoryId)
                    const subOptions = subCategories.filter(s => s.macroCategoryId === rule.macroCategoryId && s.active)
                    return (
                      <tr key={rule.id} className="table-row" style={{ opacity: rule.active ? 1 : 0.5 }}>
                        <td className="table-td" style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink)' }}>{rule.pattern}</td>
                        <td className="table-td">
                          <select
                            value={rule.macroCategoryId}
                            onChange={e => { updateRule(rule.id, { macroCategoryId: e.target.value, subCategoryId: undefined }); refresh() }}
                            className="ledger-select"
                            style={{ fontSize: 11.5, minWidth: 130 }}
                          >
                            {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </td>
                        <td className="table-td">
                          {subOptions.length > 0 ? (
                            <select
                              value={rule.subCategoryId ?? ''}
                              onChange={e => { updateRule(rule.id, { subCategoryId: e.target.value || undefined }); refresh() }}
                              className="ledger-select"
                              style={{ fontSize: 11.5, minWidth: 120 }}
                            >
                              <option value="">—</option>
                              {subOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--faint)' }}>{macro ? '—' : 'sem macro'}</span>
                          )}
                        </td>
                        <td className="table-td" style={{ fontSize: 11, color: 'var(--faint)' }}>{ORIGIN_LABEL[rule.origin]}</td>
                        <td className="table-td table-th-right" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--ink-2)' }}>{rule.useCount}</td>
                        <td className="table-td">
                          <button
                            onClick={() => { toggleRule(rule.id, !rule.active); refresh() }}
                            aria-label={rule.active ? 'Desativar' : 'Ativar'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: rule.active ? 'var(--pos)' : 'var(--faint)', display: 'flex', padding: 0 }}
                          >
                            {rule.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                          </button>
                        </td>
                        <td className="table-td">
                          <button
                            onClick={() => handleDelete(rule.id)}
                            aria-label="Remover"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crit)', display: 'flex', padding: 4 }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
