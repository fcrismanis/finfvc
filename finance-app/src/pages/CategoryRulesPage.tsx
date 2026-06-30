import { useState, useMemo } from 'react'
import { Trash2, Plus, ToggleLeft, ToggleRight, FlaskConical, Play } from 'lucide-react'
import { useData } from '../context/DataContext'
import { CategorySelector } from '../components/CategorySelector'
import { getAllMacroCategories } from '../services/financeParentCategories.service'
import {
  loadRules, deleteRule, toggleRule, updateRule, upsertRule, testRule, suggestFromRules,
  type CategoryRule,
} from '../services/categoryRules.service'

export function CategoryRulesPage() {
  const { subCategories, transactions, updateTransactions } = useData()
  const allMacros = useMemo(() => getAllMacroCategories(), [])

  const [rules, setRules] = useState<CategoryRule[]>(() => loadRules())
  const [newPattern, setNewPattern] = useState('')
  const [newMacro, setNewMacro] = useState<string | undefined>(undefined)
  const [newSub, setNewSub] = useState<string | undefined>(undefined)
  const [testResults, setTestResults] = useState<Record<string, number>>({})
  const [applyStatus, setApplyStatus] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  // Acordeon por categoria — padrão fechado (Set vazio = todos colapsados)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function refresh() { setRules(loadRules()) }

  const sorted = useMemo(
    () => [...rules].sort((a, b) => b.useCount - a.useCount || a.pattern.localeCompare(b.pattern)),
    [rules]
  )

  // Agrupa regras por macro categoria, ordenado por nome ('__none__' = sem categoria, por último)
  const groups = useMemo(() => {
    const byMacro = new Map<string, CategoryRule[]>()
    for (const r of sorted) {
      const key = r.macroCategoryId || '__none__'
      const arr = byMacro.get(key)
      if (arr) arr.push(r); else byMacro.set(key, [r])
    }
    return Array.from(byMacro.entries())
      .map(([macroId, items]) => ({
        macroId,
        macro: allMacros.find(m => m.id === macroId),
        items,
      }))
      .sort((a, b) => {
        if (a.macroId === '__none__') return 1
        if (b.macroId === '__none__') return -1
        return (a.macro?.name ?? a.macroId).localeCompare(b.macro?.name ?? b.macroId, 'pt-BR')
      })
  }, [sorted, allMacros])

  function toggleGroup(macroId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(macroId)) next.delete(macroId); else next.add(macroId)
      return next
    })
  }

  function handleAdd() {
    if (!newPattern.trim() || !newMacro) return
    upsertRule({ pattern: newPattern, macroCategoryId: newMacro, subCategoryId: newSub, origin: 'manual' })
    setNewPattern(''); setNewMacro(undefined); setNewSub(undefined); refresh()
  }

  function handleDelete(id: string) {
    if (!confirm('Remover esta regra aprendida?')) return
    deleteRule(id); refresh()
  }

  function handleTest(rule: CategoryRule) {
    const matched = testRule(rule, transactions)
    setTestResults(prev => ({ ...prev, [rule.id]: matched.length }))
  }

  async function handleApplyAll() {
    const activeRules = sorted.filter(r => r.active)
    const uncategorized = transactions.filter(t =>
      !t.macroCategoryId && !t.manualCategoryOverride && t.status !== 'cancelled'
    )
    const patches = uncategorized.flatMap(tx => {
      const match = suggestFromRules(tx, activeRules)
      if (!match) return []
      const macro = allMacros.find(m => m.id === match.macroCategoryId)
      return [{ id: tx.id, patch: {
        macroCategoryId: match.macroCategoryId,
        subCategoryId: match.subCategoryId,
        classificationType: macro?.classificationType ?? tx.classificationType,
        includeInOperationalResult: macro ? macro.displayInResult : tx.includeInOperationalResult,
        includeInCashflow: macro ? macro.displayInCashflow : tx.includeInCashflow,
        includeInBudget: macro ? macro.displayInBudget : tx.includeInBudget,
        categorySuggestionSource: 'rule' as const,
        categoryConfidence: match.confidence,
        needsReview: false,
      } as Parameters<typeof updateTransactions>[0][0]['patch'] }]
    })
    if (patches.length === 0) { setApplyStatus('Nenhuma transação sem categoria encontrada.'); return }
    if (!confirm(`Aplicar regras a ${patches.length} lançamento(s) sem categoria?`)) return
    setApplying(true)
    setApplyStatus(null)
    try {
      await updateTransactions(patches, { markManual: false })
      setApplyStatus(`✓ ${patches.length} lançamento(s) classificados pelas regras.`)
    } catch (e) {
      setApplyStatus(`Erro: ${(e as Error).message}`)
    } finally {
      setApplying(false)
    }
  }

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Regras de categoria</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
              Quando você corrige uma categoria, o FIN aprende. Próximas importações parecidas já vêm classificadas.
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleApplyAll}
            disabled={applying}
            title="Aplica todas as regras ativas a lançamentos sem categoria"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Play size={14} />
            {applying ? 'Executando…' : 'Executar todas'}
          </button>
        </div>

        {applyStatus && (
          <div style={{ fontSize: 13, fontWeight: 600, color: applyStatus.startsWith('✓') ? 'var(--pos)' : 'var(--crit)', padding: '8px 14px', borderRadius: 8, background: applyStatus.startsWith('✓') ? 'var(--pos-soft)' : 'var(--crit-soft)' }}>
            {applyStatus}
          </div>
        )}

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
          <div style={{ minWidth: 200 }}>
            <CategorySelector
              macroCategoryId={newMacro}
              subCategoryId={newSub}
              allMacros={allMacros}
              subCategories={subCategories}
              placeholder="Categoria…"
              onChange={(macroId, subId) => { setNewMacro(macroId); setNewSub(subId) }}
            />
          </div>
          <button className="btn btn-primary btn-sm" disabled={!newPattern.trim() || !newMacro} onClick={handleAdd}>
            <Plus size={13} /> Adicionar regra
          </button>
        </div>

        {/* Stats */}
        {sorted.length > 0 && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--faint)' }}>
            <span><b style={{ color: 'var(--ink)' }}>{sorted.length}</b> regras</span>
            <span><b style={{ color: 'var(--pos)' }}>{sorted.filter(r => r.active).length}</b> ativas</span>
            <span><b style={{ color: 'var(--ink)' }}>{sorted.reduce((s, r) => s + r.useCount, 0)}</b> aplicações totais</span>
          </div>
        )}

        {/* Rules list — acordeon por categoria (padrão fechado) */}
        {sorted.length === 0 ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Nenhuma regra aprendida ainda</h4>
              <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 320, textAlign: 'center' }}>
                Corrija a categoria de um lançamento ou adicione uma regra manual acima.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups.map(({ macroId, macro, items }) => {
              const isOpen = expanded.has(macroId)
              const activeCount = items.filter(r => r.active).length
              const groupName = macro?.name ?? (macroId === '__none__' ? 'Sem categoria' : macroId)
              const accent = macro?.color ?? 'var(--faint)'
              return (
                <div key={macroId} className="card" style={{ overflow: 'hidden' }}>
                  {/* Group header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(macroId)}
                    aria-expanded={isOpen}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '12px 16px', background: isOpen ? 'var(--well)' : 'transparent',
                      border: 'none', borderBottom: isOpen ? '1px solid var(--line)' : 'none',
                      cursor: 'pointer', fontFamily: 'var(--ui)', textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{groupName}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 600 }}>
                      {items.length} regra{items.length !== 1 ? 's' : ''} · {activeCount} ativa{activeCount !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--faint)' }}>{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                <thead>
                  <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                    <th className="table-th" style={{ minWidth: 140 }}>Padrão</th>
                    <th className="table-th" style={{ minWidth: 120 }}>Receptor/Pagador</th>
                    <th className="table-th" style={{ minWidth: 160 }}>Categoria</th>
                    <th className="table-th" style={{ minWidth: 120 }}>Subcategoria</th>
                    <th className="table-th table-th-right" style={{ width: 56 }}>Usos</th>
                    <th className="table-th" style={{ width: 64 }}>Ativa</th>
                    <th className="table-th" style={{ width: 60 }}>Atualizado</th>
                    <th style={{ width: 72 }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map(rule => {
                    const macro = allMacros.find(m => m.id === rule.macroCategoryId)
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
                            <div style={{ fontSize: 9, color: 'var(--faint)', marginTop: 2 }}>Pluggy: {rule.pluggyCategoryId}</div>
                          )}
                        </td>

                        {/* Receiver / Payer */}
                        <td className="table-td" style={{ fontSize: 10.5, color: 'var(--ink-2)', maxWidth: 140 }}>
                          {rule.receiverName && <div title="Receptor">→ {rule.receiverName}</div>}
                          {rule.payerName && <div title="Pagador">← {rule.payerName}</div>}
                          {!rule.receiverName && !rule.payerName && <span style={{ color: 'var(--faint)' }}>—</span>}
                        </td>

                        {/* Macro category — inline CategorySelector */}
                        <td className="table-td" style={{ minWidth: 160 }}>
                          <CategorySelector
                            macroCategoryId={rule.macroCategoryId}
                            subCategoryId={rule.subCategoryId}
                            allMacros={allMacros}
                            subCategories={subCategories}
                            placeholder="—"
                            onChange={(macroId, subId) => { updateRule(rule.id, { macroCategoryId: macroId ?? rule.macroCategoryId, subCategoryId: subId }); refresh() }}
                          />
                        </td>

                        {/* Sub category */}
                        <td className="table-td" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                          {subOptions.length > 0 ? (
                            <select
                              value={rule.subCategoryId ?? ''}
                              onChange={e => { updateRule(rule.id, { subCategoryId: e.target.value || undefined }); refresh() }}
                              className="ledger-select"
                              style={{ fontSize: 11, minWidth: 100 }}
                            >
                              <option value="">—</option>
                              {subOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          ) : (
                            <span style={{ color: 'var(--faint)' }}>{macro ? '—' : 'sem macro'}</span>
                          )}
                        </td>

                        {/* Use count */}
                        <td className="table-td table-th-right" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--ink-2)' }}>
                          {rule.useCount}
                        </td>

                        {/* Active toggle */}
                        <td className="table-td">
                          <button
                            onClick={() => { toggleRule(rule.id, !rule.active); refresh() }}
                            title={rule.active ? 'Clique para desativar esta regra' : 'Clique para ativar esta regra'}
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
                          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <button
                              onClick={() => handleTest(rule)}
                              title={testCount !== undefined ? `Encontrou ${testCount} lançamento(s) correspondentes` : 'Testar esta regra contra os lançamentos atuais'}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: testCount !== undefined ? (testCount > 0 ? 'var(--pos)' : 'var(--faint)') : 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3, padding: 4 }}
                              aria-label="Testar regra"
                            >
                              <FlaskConical size={13} />
                              {testCount !== undefined && (
                                <span style={{ fontSize: 10, fontWeight: 700 }}>{testCount}</span>
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(rule.id)}
                              title="Remover esta regra permanentemente"
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
              )
            })}
          </div>
        )}

      </div>
    </main>
  )
}
