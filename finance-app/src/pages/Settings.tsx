import { useState } from 'react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES, CATEGORIES } from '../config/categories'
import { DATA_PROVIDER } from '../config/env'

export function Settings() {
  const { transactions, budgets, closings } = useData()
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)

  function handleExportBackup() {
    const data = { transactions, budgets, closings, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fin-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleClearLocal() {
    const KEYS = ['finance_transactions', 'finance_budgets', 'finance_closings', 'finance_migration_banner_dismissed']
    KEYS.forEach(k => localStorage.removeItem(k))
    setConfirmClear(false)
    setCleared(true)
  }

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Header ── */}
        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Configurações</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Dados, categorias e preferências do FIN
          </div>
        </div>

        {/* ── Provider info ── */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 12 }}>Armazenamento</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: DATA_PROVIDER === 'supabase' ? 'var(--pos)' : 'var(--warn)', flexShrink: 0 }} />
            <span style={{ color: 'var(--ink-2)' }}>
              Provider: <strong style={{ color: 'var(--ink)' }}>{DATA_PROVIDER === 'supabase' ? 'Supabase (nuvem)' : 'Local (localStorage)'}</strong>
            </span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 20, fontSize: 12, color: 'var(--faint)' }}>
            <span>{transactions.length} lançamentos</span>
            <span>{budgets.length} orçamentos</span>
            <span>{closings.length} fechamentos</span>
          </div>
        </div>

        {/* ── Backup ── */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 6 }}>Backup dos dados</h3>
          <p style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14, lineHeight: 1.6 }}>
            Exporta todos os lançamentos, orçamentos e fechamentos em formato JSON.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={handleExportBackup}>
            Exportar backup JSON
          </button>
        </div>

        {/* ── Categories ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Macro categorias</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
              <thead>
                <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                  <th className="table-th">Nome</th>
                  <th className="table-th">Tipo</th>
                  <th className="table-th" style={{ textAlign: 'right' }}>Subcategorias</th>
                </tr>
              </thead>
              <tbody>
                {MACRO_CATEGORIES.map(m => {
                  const subs = CATEGORIES.filter(c => c.macroCategoryId === m.id)
                  return (
                    <tr key={m.id} className="table-row">
                      <td className="table-td">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{m.name}</span>
                        </div>
                      </td>
                      <td className="table-td">
                        <span style={{ fontSize: 11, color: 'var(--faint)' }}>{m.classificationType}</span>
                      </td>
                      <td className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--faint)' }}>
                        {subs.length}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Clear local data ── */}
        {DATA_PROVIDER !== 'supabase' && (
          <div className="card" style={{ padding: '18px 22px', border: '1px solid var(--crit)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--crit)', marginBottom: 6 }}>Zona de perigo</h3>

            {cleared ? (
              <div style={{ fontSize: 13, color: 'var(--pos)', fontWeight: 600 }}>
                Dados locais removidos. Recarregue a página para reiniciar.
              </div>
            ) : confirmClear ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12.5, color: 'var(--crit)', fontWeight: 600 }}>
                  Esta ação remove todos os dados locais permanentemente. Exportar backup antes?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleClearLocal}
                    style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--crit)', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                  >
                    Confirmar limpeza
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClear(false)}>
                    Cancelar
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleExportBackup}>
                    Exportar primeiro
                  </button>
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
                  Limpar dados locais
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </main>
  )
}
