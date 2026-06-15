import { useState, useMemo } from 'react'
import { useData } from '../context/DataContext'
import { DATA_PROVIDER } from '../config/env'

export function DangerZonePage() {
  const { transactions, budgets, closings } = useData()
  const [confirmClear, setConfirmClear] = useState(false)
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
    const DATA_KEYS = ['finance_transactions', 'finance_budgets', 'finance_closings', 'finance_subcategories']
    DATA_KEYS.forEach(k => localStorage.setItem(k, '[]'))
    localStorage.removeItem('fin_pluggy_connections')
    localStorage.removeItem('finance_migration_banner_dismissed')
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12.5, color: 'var(--crit)', fontWeight: 600 }}>
                  Esta ação remove todos os dados locais permanentemente. Exporte um backup antes?
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={handleClearLocal}
                    style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--crit)', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                  >
                    Confirmar limpeza total
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClear(false)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14, lineHeight: 1.6 }}>
                  Remove todos os lançamentos, orçamentos e fechamentos armazenados localmente. Irreversível.
                </p>
                <button
                  onClick={() => setConfirmClear(true)}
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--crit)', background: 'var(--crit-soft)', border: '1px solid var(--crit)', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                >
                  Limpar todos os dados locais
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </main>
  )
}
