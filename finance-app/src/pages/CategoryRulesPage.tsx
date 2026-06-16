import { useState, useMemo } from 'react'
import { Trash2, Plus, ToggleLeft, ToggleRight, FlaskConical } from 'lucide-react'
import { MACRO_CATEGORIES } from '../config/categories'
import { useData } from '../context/DataContext'
import {
  loadRules, deleteRule, toggleRule, updateRule, upsertRule, testRule,
  type CategoryRule,
} from '../services/categoryRules.service'

const ORIGIN_LABEL: Record<CategoryRule['origin'], string> = {
  manual: 'Manual', pluggy: 'Pluggy', csv: 'CSV', ai: 'IA', command: 'Comando',
}

const ORIGIN_COLOR: Record<CategoryRule['origin'], string> = {
  manual: 'var(--ink-2)', pluggy: 'var(--pos)', csv: 'var(--ink-2)', ai: 'var(--accent)', command: 'var(--accent)',
}

const CONFIDENCE_COLOR: Record<NonNullable<CategoryRule['confidence']>, string> = {
  high: 'var(--pos)', medium: 'var(--warn)', low: 'var(--faint)',
}

export function CategoryRulesPage() {
  const { subCategories, transactions } = useData()
  const [rules, setRules] = useState<CategoryRule[]>(() => loadRules())
  const [newPattern, setNewPattern] = useState('')
  const [newMacro, setNewMacro] = useState('')
  const [testResults, setTestResults] = useState<Record<string, number>>({})

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

  function handleTest(rule: CategoryRule) {
    const matched = testRule(rule, transactions)
    setTestResults(prev => ({ ...prev, [rule.id]: matched.length }))
  }

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Regras de categoria</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Quando você corrige uma categoria ou a IA sugere uma, o FIN aprende. Próximas importações parecidas já vêm classificadas.
          </div>
        </div>

        {/* Add rule */}
        <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={newPattern}
            onChange={e => setNewPattern(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Texto / merchant (ex: AGGILE ENGLISH)"
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

        {/* Stats */}
        {sorted.length > 0 && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--faint)' }}>
            <span><b style={{ color: 'var(--ink)' }}>{sorted.length}</b> regras</span>
            <span><b style={{ color: 'var(--pos)' }}>{sorted.filter(r => r.active).length}</b> ativas</span>
            <span><b style={{ color: 'var(--accent)' }}>{sorted.filter(r => r.origin === 'ai').length}</b> criadas por IA</span>
            <span><b style={{ color: 'var(--ink)' }}>{sorted.reduce((s, r) => s + r.useCount, 0)}</b> aplicações totais</span>
          </div>
        )}

        {/* Rules list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {sorted.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Nenhuma regra aprendida ainda</h4>
              <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 320, textAlign: 'center' }}>
                Corrija a categoria de um lançamento, use o botão "Categorizar com IA" na Revisão, ou adicione uma regra manual acima.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                    <th className="table-th">Padrão</th>
                    <th className="table-th">Receptor/Pagador</th>
                    <th className="table-th">Categoria</th>
                    <th className="table-th">Subcategoria</th>
                    <th className="table-th">Origem</th>
                    <th className="table-th table-th-right">Usos</th>
                    <th className="table-th">Confiança</th>
                    <th className="table-th">Ativa</th>
                    <th className="table-th">Atualizado</th>
                    <th style={{ width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(rule => {
                    const macro = MACRO_CATEGORIES.find(m => m.id === rule.macroCategoryId)
                    const subOptions = subCategories.filter(s => s.macroCategoryId === rule.macroCategoryId && s.active)
                    const testCount = testResults[rule.id]
                    const updatedDate = rule.updatedAt
                      ? new Date(rule.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                      : '—'

                    return (
                      <tr key={rule.id} className="table-row" style={{ opacity: rule.active ? 1 : 0.45 }}>

                        {/* Pattern */}
                        <td className="table-td" style={{ maxWidth: 160 }}>
                          {rule.pattern ? (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', wordBreak: 'break-word' }}>
                              {rule.pattern}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--faint)', fontStyle: 'italic' }}>—</span>
                          )}
                          {rule.pluggyCategoryId && (
                            <div style={{ fontSize: 9, color: 'var(--faint)', marginTop: 2 }}>
                              Pluggy ID: {rule.pluggyCategoryId}
                            </div>
                          )}
                        </td>

                        {/* Receiver / Payer */}
                        <td className="table-td" style={{ fontSize: 10.5, color: 'var(--ink-2)', maxWidth: 140 }}>
                          {rule.receiverName && (
                            <div title="Receptor">→ {rule.receiverName}</div>
                          )}
                          {rule.payerName && (
                            <div title="Pagador">← {rule.payerName}</div>
                          )}
                          {!rule.receiverName && !rule.payerName && (
                            <span style={{ color: 'var(--faint)' }}>—</span>
                          )}
                        </td>

                        {/* Macro category */}
                        <td className="table-td">
                          <select
                            value={rule.macroCategoryId}
                            onChange={e => { updateRule(rule.id, { macroCategoryId: e.target.value, subCategoryId: undefined }); refresh() }}
                            className="ledger-select"
                            style={{ fontSize: 11, minWidth: 120 }}
                          >
                            {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </td>

                        {/* Sub category */}
                        <td className="table-td">
                          {subOptions.length > 0 ? (
                            <select
                              value={rule.subCategoryId ?? ''}
                              onChange={e => { updateRule(rule.id, { subCategoryId: e.target.value || undefined }); refresh() }}
                              className="ledger-select"
                              style={{ fontSize: 11, minWidth: 110 }}
                            >
                              <option value="">—</option>
                              {subOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--faint)' }}>{macro ? '—' : 'sem macro'}</span>
                          )}
                        </td>

                        {/* Origin */}
                        <td className="table-td">
                          <span style={{ fontSize: 10, fontWeight: 700, color: ORIGIN_COLOR[rule.origin] }}>
                            {ORIGIN_LABEL[rule.origin]}
                          </span>
                        </td>

                        {/* Use count */}
                        <td className="table-td table-th-right" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--ink-2)' }}>
                          {rule.useCount}
                        </td>

                        {/* Confidence */}
                        <td className="table-td">
                          {rule.confidence ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: CONFIDENCE_COLOR[rule.confidence] }}>
                              {rule.confidence === 'high' ? 'alta' : rule.confidence === 'medium' ? 'média' : 'baixa'}
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--faint)' }}>—</span>
                          )}
                        </td>

                        {/* Active toggle */}
                        <td className="table-td">
                          <button
                            onClick={() => { toggleRule(rule.id, !rule.active); refresh() }}
                            aria-label={rule.active ? 'Desativar' : 'Ativar'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: rule.active ? 'var(--pos)' : 'var(--faint)', display: 'flex', padding: 0 }}
                          >
                            {rule.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                          </button>
                        </td>

                        {/* Updated date */}
                        <td className="table-td" style={{ fontSize: 10, color: 'var(--faint)', whiteSpace: 'nowrap' }}>
                          {updatedDate}
                        </td>

                        {/* Actions */}
                        <td className="table-td" style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <button
                              onClick={() => handleTest(rule)}
                              title="Testar esta regra contra lançamentos atuais"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', padding: 4 }}
                              aria-label="Testar regra"
                            >
                              <FlaskConical size={13} />
                            </button>
                            {testCount !== undefined && (
                              <span style={{ fontSize: 10, color: testCount > 0 ? 'var(--pos)' : 'var(--faint)', fontWeight: 700 }}>
                                {testCount}
                              </span>
                            )}
                            <button
                              onClick={() => handleDelete(rule.id)}
                              aria-label="Remover"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crit)', display: 'flex', padding: 4 }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
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
