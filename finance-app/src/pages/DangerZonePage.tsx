import { useState, useMemo } from 'react'
import { useData } from '../context/DataContext'
import { DATA_PROVIDER } from '../config/env'
import { findAllDuplicateGroups, type AllDuplicateGroup } from '../utils/transactionDedupe'
import { MACRO_CATEGORIES } from '../config/categories'
import { formatBRL } from '../utils/currency'
import type { Transaction } from '../types'

const ALL_FIN_KEYS = [
  'finance_transactions',
  'finance_budgets',
  'finance_closings',
  'finance_subcategories',
  'fin_pluggy_connections',
  'fin_category_rules',
  'finance_migration_banner_dismissed',
]

function exportFullBackup(): void {
  const snapshot: Record<string, unknown> = { _exportedAt: new Date().toISOString(), _version: 1 }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    if (k.startsWith('fin_') || k.startsWith('finance_')) {
      try { snapshot[k] = JSON.parse(localStorage.getItem(k) ?? 'null') }
      catch { snapshot[k] = localStorage.getItem(k) }
    }
  }
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fin_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Duplicate cleanup ─────────────────────────────────────────────────────────

type GroupAction = 'keep_a' | 'keep_b' | 'merge' | 'skip' | 'false_positive'

function sourceLabel(tx: Transaction): string {
  if (tx.source === 'real_xlsx' || tx.source === 'real_2026_xlsx' || tx.origin === 'import_xlsx') return 'Excel'
  if (tx.source === 'pluggy' || tx.origin === 'import_api') return 'Pluggy'
  return tx.source ?? tx.origin
}

function macroName(id?: string): string {
  if (!id) return '—'
  return MACRO_CATEGORIES.find(m => m.id === id)?.name ?? id
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Duplicata certa',
  medium: 'Possível duplicata',
  low: 'Duplicata fraca',
}
const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'var(--crit)',
  medium: 'var(--warn)',
  low: 'var(--faint)',
}

function DuplicateCleanupPanel() {
  const { transactions } = useData()
  const [scanned, setScanned] = useState(false)
  const [groups, setGroups] = useState<AllDuplicateGroup[]>([])
  const [actions, setActions] = useState<Record<string, GroupAction>>({})
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState<{ removed: number } | null>(null)

  function scan() {
    setScanned(true)
    setDone(null)
    setGroups(findAllDuplicateGroups(transactions))
    setActions({})
  }

  function setAction(gid: string, a: GroupAction) {
    setActions(prev => ({ ...prev, [gid]: a }))
  }

  async function applyAll() {
    setApplying(true)
    const toRemove = new Set<string>()
    const toEnrich: Array<{ keepId: string; donorId: string }> = []

    for (const g of groups) {
      const defaultAction = g.suggestedKeepId ? 'keep_a' : 'skip'
      const action = actions[g.id] ?? defaultAction
      if (action === 'skip' || action === 'false_positive') continue

      const keepId = action === 'keep_a'
        ? (g.suggestedKeepId ?? g.transactions[0]?.id)
        : action === 'keep_b'
          ? g.transactions[1]?.id ?? g.transactions[0]?.id
          : g.suggestedKeepId ?? g.transactions[0]?.id

      for (const tx of g.transactions) {
        if (tx.id === keepId) continue
        if (action === 'merge') {
          toEnrich.push({ keepId: keepId!, donorId: tx.id })
        }
        toRemove.add(tx.id)
      }
    }

    if (DATA_PROVIDER !== 'supabase') {
      const raw = localStorage.getItem('finance_transactions')
      if (raw) {
        let txns: Transaction[] = JSON.parse(raw)
        const byId = new Map(txns.map(t => [t.id, t]))
        for (const { keepId, donorId } of toEnrich) {
          const keep = byId.get(keepId)
          const donor = byId.get(donorId)
          if (keep && donor && !keep.manualCategoryOverride) {
            byId.set(keepId, {
              ...keep,
              pluggyCategory: donor.pluggyCategory ?? keep.pluggyCategory,
              pluggyCategoryId: donor.pluggyCategoryId ?? keep.pluggyCategoryId,
              pluggyOperationType: donor.pluggyOperationType ?? keep.pluggyOperationType,
              pluggyPaymentMethod: donor.pluggyPaymentMethod ?? keep.pluggyPaymentMethod,
              pluggyReceiverName: donor.pluggyReceiverName ?? keep.pluggyReceiverName,
              pluggyPayerName: donor.pluggyPayerName ?? keep.pluggyPayerName,
              pluggyAccountName: donor.pluggyAccountName ?? keep.pluggyAccountName,
              pluggyInstitutionName: donor.pluggyInstitutionName ?? keep.pluggyInstitutionName,
              pluggyRawDate: donor.pluggyRawDate ?? keep.pluggyRawDate,
              pluggyRawTransactionDate: donor.pluggyRawTransactionDate ?? keep.pluggyRawTransactionDate,
              pluggyRawPaymentDate: donor.pluggyRawPaymentDate ?? keep.pluggyRawPaymentDate,
              pluggyRawCompetenceDate: donor.pluggyRawCompetenceDate ?? keep.pluggyRawCompetenceDate,
              pluggyRawOperationDate: donor.pluggyRawOperationDate ?? keep.pluggyRawOperationDate,
              pluggyRawCreatedAt: donor.pluggyRawCreatedAt ?? keep.pluggyRawCreatedAt,
              pluggyRawUpdatedAt: donor.pluggyRawUpdatedAt ?? keep.pluggyRawUpdatedAt,
              updatedAt: new Date().toISOString(),
            })
          }
        }
        txns = Array.from(byId.values()).filter(t => !toRemove.has(t.id))
        localStorage.setItem('finance_transactions', JSON.stringify(txns))
      }
    }

    setApplying(false)
    setDone({ removed: toRemove.size })
    setGroups([])
    setScanned(false)
    window.location.reload()
  }

  const highCount = groups.filter(g => g.confidence === 'high').length
  const medCount = groups.filter(g => g.confidence === 'medium').length
  const pendingCount = groups.filter(g => !actions[g.id]).length

  return (
    <div className="card" style={{ padding: '18px 22px' }}>
      <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 4 }}>Corrigir duplicidades</h3>
      <p style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 12, lineHeight: 1.6 }}>
        Detecta transações duplicadas de qualquer origem — Excel×Excel, Pluggy×Pluggy, Excel×Pluggy.
        Nunca apaga automaticamente — você revisa cada grupo antes de confirmar.
      </p>

      {done && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--ok-soft)', border: '1px solid var(--ok)', fontSize: 12.5, color: 'var(--ok)', marginBottom: 12 }}>
          Concluído: {done.removed} duplicata(s) removida(s).
        </div>
      )}

      {!scanned ? (
        <button className="btn btn-secondary btn-sm" onClick={scan} disabled={transactions.length === 0}>
          Escanear duplicidades ({transactions.length} lançamentos)
        </button>
      ) : groups.length === 0 ? (
        <div>
          <p style={{ fontSize: 12.5, color: 'var(--ok)', fontWeight: 600, marginBottom: 8 }}>Nenhuma duplicidade detectada.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => setScanned(false)}>Escanear novamente</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--warn)' }}>{groups.length} grupo(s) total</span>
            {highCount > 0 && <span style={{ fontSize: 12, color: 'var(--crit)' }}>{highCount} alta confiança</span>}
            {medCount > 0 && <span style={{ fontSize: 12, color: 'var(--warn)' }}>{medCount} média confiança</span>}
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>{pendingCount} sem decisão</span>
          </div>

          {groups.map(g => {
            const action = actions[g.id]
            const suggestedIdx = g.suggestedKeepId ? g.transactions.findIndex(t => t.id === g.suggestedKeepId) : -1
            return (
              <div key={g.id} style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: 'var(--well)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: CONFIDENCE_COLOR[g.confidence] ?? 'var(--faint)', textTransform: 'uppercase' }}>
                    {CONFIDENCE_LABEL[g.confidence] ?? g.confidence}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{g.reason}</span>
                  {suggestedIdx >= 0 && (
                    <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 'auto' }}>
                      sugestão: manter {String.fromCharCode(65 + suggestedIdx)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(g.transactions.length, 3)}, 1fr)`, gap: 0 }}>
                  {g.transactions.slice(0, 3).map((tx, i) => (
                    <div key={tx.id} style={{ padding: '10px 12px', borderRight: i < Math.min(g.transactions.length, 3) - 1 ? '1px solid var(--line)' : undefined }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 4 }}>
                          {String.fromCharCode(65 + i)} · {sourceLabel(tx)}
                        </div>
                        {tx.id === g.suggestedKeepId && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ok)', background: 'var(--ok-soft)', borderRadius: 4, padding: '1px 5px' }}>manter</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }} title={tx.description}>
                        {tx.description.slice(0, 32)}{tx.description.length > 32 ? '…' : ''}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>{formatBRL(tx.amount)}</div>
                      <div style={{ fontSize: 11, color: 'var(--faint)' }}>{tx.transactionDate}</div>
                      <div style={{ fontSize: 11, color: 'var(--faint)' }}>{macroName(tx.macroCategoryId)}</div>
                      {tx.accountId && <div style={{ fontSize: 10, color: 'var(--faint)' }}>{tx.accountId}</div>}
                      {tx.manualCategoryOverride && (
                        <div style={{ fontSize: 10, color: 'var(--ok)', fontWeight: 700, marginTop: 2 }}>manual</div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ padding: '8px 12px', borderTop: '1px solid var(--line)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['keep_a', 'keep_b', 'merge', 'skip', 'false_positive'] as GroupAction[]).map(opt => {
                    if (opt === 'keep_b' && g.transactions.length < 2) return null
                    return (
                      <button
                        key={opt}
                        onClick={() => setAction(g.id, opt)}
                        style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 6, fontFamily: 'var(--ui)', cursor: 'pointer', fontWeight: action === opt ? 700 : 400,
                          border: `1px solid ${action === opt ? 'var(--accent)' : 'var(--line)'}`,
                          background: action === opt ? 'var(--accent)' : 'transparent',
                          color: action === opt ? '#fff' : 'var(--ink-2)',
                        }}
                      >
                        {opt === 'keep_a' ? 'Manter A' : opt === 'keep_b' ? 'Manter B' : opt === 'merge' ? 'Mesclar' : opt === 'false_positive' ? 'Falso positivo' : 'Ignorar'}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={applyAll}
              disabled={applying || pendingCount > 0}
              title={pendingCount > 0 ? `${pendingCount} grupo(s) sem decisão` : undefined}
            >
              {applying ? 'Aplicando…' : `Aplicar decisões (${groups.filter(g => actions[g.id] && actions[g.id] !== 'skip' && actions[g.id] !== 'false_positive').length} ações)`}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setScanned(false); setGroups([]) }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function DangerZonePage() {
  const { transactions, budgets, closings } = useData()
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearAllPhrase, setClearAllPhrase] = useState('')
  const [clearMonth, setClearMonth] = useState('')
  const [clearMonthConfirm, setClearMonthConfirm] = useState('')

  const PT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  function fmtMonth(ym: string): string {
    const [y, m] = ym.split('-')
    return `${y}-${PT_MONTHS[parseInt(m, 10) - 1] ?? m}`
  }

  const allMonths = useMemo(() => {
    const set = new Set([
      ...transactions.map(t => t.competenceDate.slice(0, 7)),
      ...transactions.map(t => t.transactionDate.slice(0, 7)),
      ...budgets.map(b => b.referenceMonth.slice(0, 7)),
    ])
    return Array.from(set).filter(m => /^\d{4}-\d{2}$/.test(m)).sort().reverse()
  }, [transactions, budgets])

  const txInMonth = (t: { competenceDate: string; transactionDate: string }, month: string) =>
    t.competenceDate.startsWith(month) || t.transactionDate.startsWith(month)

  const monthImpact = useMemo(() => {
    if (!clearMonth) return null
    return {
      transactions: transactions.filter(t => txInMonth(t, clearMonth)).length,
      budgets: budgets.filter(b => b.referenceMonth.startsWith(clearMonth)).length,
      closings: closings.filter(c => c.month === clearMonth).length,
    }
  }, [clearMonth, transactions, budgets, closings])

  function handleClearMonth() {
    if (DATA_PROVIDER === 'supabase') return
    const newTxs = transactions.filter(t => !txInMonth(t, clearMonth))
    const newBudgets = budgets.filter(b => !b.referenceMonth.startsWith(clearMonth))
    const newClosings = closings.filter(c => c.month !== clearMonth)
    localStorage.setItem('finance_transactions', JSON.stringify(newTxs))
    localStorage.setItem('finance_budgets', JSON.stringify(newBudgets))
    localStorage.setItem('finance_closings', JSON.stringify(newClosings))
    window.location.reload()
  }

  function handleClearLocal() {
    if (clearAllPhrase !== 'APAGAR TUDO') return
    ALL_FIN_KEYS.forEach(k => {
      if (k === 'fin_pluggy_connections' || k === 'finance_migration_banner_dismissed' || k === 'fin_category_rules') {
        localStorage.removeItem(k)
      } else {
        localStorage.setItem(k, '[]')
      }
    })
    window.location.reload()
  }

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--crit)' }}>Zona de Perigo</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Ações destrutivas e irreversíveis. Proceed com cuidado.
          </div>
        </div>

        {/* Duplicate cleanup */}
        <DuplicateCleanupPanel />

        {/* Clear specific month */}
        <div className="card" style={{ padding: '18px 22px', border: '1px solid var(--crit)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 4 }}>Limpar mês específico</h3>

          {DATA_PROVIDER === 'supabase' ? (
            <p style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.6 }}>
              Indisponível no modo Supabase. Para remover dados de um mês, execute uma SQL segura diretamente no painel do Supabase com cláusula WHERE.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 12, lineHeight: 1.6 }}>
                Remove todos os lançamentos, orçamentos e fechamentos de um mês específico.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={clearMonth}
                    onChange={e => { setClearMonth(e.target.value); setClearMonthConfirm('') }}
                    className="ledger-select"
                    style={{ fontSize: 12 }}
                  >
                    <option value="">Selecionar mês…</option>
                    {allMonths.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
                  </select>
                  {monthImpact && (
                    <span style={{ fontSize: 11.5, color: 'var(--warn)', fontWeight: 600 }}>
                      {monthImpact.transactions} lançamentos · {monthImpact.budgets} orçamentos · {monthImpact.closings} fechamentos
                    </span>
                  )}
                </div>
                {clearMonth && (
                  <>
                    <div>
                      <p style={{ fontSize: 11.5, color: 'var(--crit)', marginBottom: 5 }}>
                        Digite <strong>LIMPAR MES</strong> para confirmar:
                      </p>
                      <input
                        value={clearMonthConfirm}
                        onChange={e => setClearMonthConfirm(e.target.value)}
                        placeholder="LIMPAR MES"
                        className="login-field"
                        style={{ fontSize: 12, maxWidth: 200 }}
                      />
                    </div>
                    <button
                      onClick={handleClearMonth}
                      disabled={clearMonthConfirm !== 'LIMPAR MES'}
                      style={{
                        fontSize: 12, fontWeight: 700, color: '#fff',
                        background: clearMonthConfirm === 'LIMPAR MES' ? 'var(--crit)' : 'var(--line)',
                        border: 'none', borderRadius: 8, padding: '7px 16px',
                        cursor: clearMonthConfirm === 'LIMPAR MES' ? 'pointer' : 'not-allowed',
                        fontFamily: 'var(--ui)', width: 'fit-content',
                      }}
                    >
                      Limpar {fmtMonth(clearMonth)}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Clear all local */}
        {DATA_PROVIDER !== 'supabase' && (
          <div className="card" style={{ padding: '18px 22px', border: '1px solid var(--crit)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 4 }}>Limpar todos os dados locais</h3>
            {confirmClear ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', border: '1px solid var(--crit)', fontSize: 12.5, color: 'var(--crit)', fontWeight: 600, lineHeight: 1.5 }}>
                  Isso remove conexões Pluggy, contas, lançamentos, regras aprendidas e todas as configurações locais. <strong>Irreversível.</strong>
                </div>
                <button
                  onClick={exportFullBackup}
                  className="btn btn-secondary btn-sm"
                  style={{ alignSelf: 'flex-start' }}
                >
                  Exportar backup antes de apagar
                </button>
                <div>
                  <p style={{ fontSize: 11.5, color: 'var(--crit)', marginBottom: 5 }}>
                    Digite <strong>APAGAR TUDO</strong> para confirmar:
                  </p>
                  <input
                    value={clearAllPhrase}
                    onChange={e => setClearAllPhrase(e.target.value)}
                    placeholder="APAGAR TUDO"
                    className="login-field"
                    style={{ fontSize: 12, maxWidth: 200 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={handleClearLocal}
                    disabled={clearAllPhrase !== 'APAGAR TUDO'}
                    style={{
                      fontSize: 12, fontWeight: 700, color: '#fff',
                      background: clearAllPhrase === 'APAGAR TUDO' ? 'var(--crit)' : 'var(--line)',
                      border: 'none', borderRadius: 8, padding: '7px 16px',
                      cursor: clearAllPhrase === 'APAGAR TUDO' ? 'pointer' : 'not-allowed',
                      fontFamily: 'var(--ui)',
                    }}
                  >
                    Apagar tudo permanentemente
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setConfirmClear(false); setClearAllPhrase('') }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14, lineHeight: 1.6 }}>
                  Remove conexões Pluggy, contas, lançamentos, orçamentos, fechamentos e regras aprendidas armazenados localmente. Irreversível.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setConfirmClear(true)}
                    style={{ fontSize: 12, fontWeight: 700, color: 'var(--crit)', background: 'var(--crit-soft)', border: '1px solid var(--crit)', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                  >
                    Limpar todos os dados locais
                  </button>
                  <button onClick={exportFullBackup} className="btn btn-secondary btn-sm">
                    Exportar backup
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </main>
  )
}
