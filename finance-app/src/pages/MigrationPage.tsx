import { useState, useEffect } from 'react'
import { localAdapter } from '../adapters/local.adapter'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { formatBRL } from '../utils/currency'
import { DATA_PROVIDER } from '../config/env'
import { supabase } from '../lib/supabase'
import type { Transaction, SubCategory } from '../types'

function patchImportHash(txns: Transaction[]): Transaction[] {
  return txns.map(t => ({ ...t, importHash: t.importHash ?? `local-${t.id}` }))
}

export function MigrationPage() {
  const { transactions: supabaseTxns, appendTransactions } = useData()
  const { familyId } = useAuth()
  const [localTxns, setLocalTxns] = useState<Transaction[]>([])
  const [status, setStatus] = useState<'idle' | 'migrating' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [beforeCount, setBeforeCount] = useState(0)
  const [totalSent, setTotalSent] = useState(0)

  useEffect(() => {
    setLocalTxns(localAdapter.getTransactions())
  }, [])

  if (DATA_PROVIDER !== 'supabase' || !familyId) {
    return (
      <main className="page-shell">
        <div style={{ margin: '0 auto', maxWidth: 640 }}>
          <div className="card">
            <div className="empty-state">
              <div className="empty-glyph" />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Indisponível</h4>
              <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 260 }}>
                Esta página só está disponível no modo Supabase com login ativo.
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const patched = patchImportHash(localTxns)
  const noHashCount = localTxns.filter(t => !t.importHash).length

  const sorted = [...localTxns].sort((a, b) => a.competenceDate.localeCompare(b.competenceDate))
  const dateFrom = sorted[0]?.competenceDate ?? null
  const dateTo   = sorted[sorted.length - 1]?.competenceDate ?? null
  const sample   = sorted.slice(0, 5)

  async function handleMigrate() {
    if (patched.length === 0) return
    setBeforeCount(supabaseTxns.length)
    setTotalSent(patched.length)
    setStatus('migrating')
    setErrMsg(null)
    try {
      // 1. Seed subcategories before transactions (avoids FK constraint violation)
      const rawSubs = localStorage.getItem('finance_subcategories')
      if (rawSubs && familyId) {
        const localSubs: SubCategory[] = JSON.parse(rawSubs)
        if (localSubs.length > 0) {
          const rows = localSubs.map(s => ({
            id: s.id,
            family_id: familyId,
            macro_category_id: s.macroCategoryId,
            name: s.name,
            essentiality: (s as { essentiality?: string }).essentiality ?? 'inherit',
            active: true,
          }))
          await supabase.from('sub_categories').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
        }
      }
      // 2. Migrate transactions
      await appendTransactions(patched)
      setStatus('done')
    } catch (e) {
      setErrMsg((e as Error).message ?? 'Erro desconhecido')
      setStatus('error')
    }
  }

  const newCount  = status === 'done' ? Math.max(0, supabaseTxns.length - beforeCount) : 0
  const dupeCount = status === 'done' ? Math.max(0, totalSent - newCount) : 0

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ── Page header ── */}
        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>
            Migração local → Supabase
          </h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Envia transações do navegador para a nuvem. Seguro re-executar — duplicatas são ignoradas.
          </div>
        </div>

        {/* ── Status cards: local vs nuvem ── */}
        <div className="stats-grid-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card" style={{ padding: '16px 20px' }}>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>No navegador (local)</span>
            <p className="num" style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)' }}>{localTxns.length}</p>
            {dateFrom && (
              <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 5, fontFamily: 'var(--mono)' }}>
                {dateFrom} → {dateTo}
              </p>
            )}
          </div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>No Supabase (nuvem)</span>
            <p className="num" style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)' }}>{supabaseTxns.length}</p>
          </div>
        </div>

        {localTxns.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-glyph" />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Nada a migrar</h4>
              <p style={{ fontSize: 12.5, color: 'var(--faint)' }}>Nenhuma transação local encontrada.</p>
            </div>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* importHash warning */}
            {noHashCount > 0 && (
              <div style={{ padding: '10px 16px', background: 'var(--warn-soft)', borderBottom: '1px solid var(--line)', fontSize: 12, color: 'var(--warn)' }}>
                {noHashCount} transação(ões) sem importHash — hash <code>local-id</code> gerado para dedup seguro.
              </div>
            )}

            {/* Sample rows */}
            <div style={{ padding: '14px 18px' }}>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 10 }}>
                Amostra ({sample.length} de {localTxns.length})
              </span>
              {sample.map(t => (
                <div key={t.id} className="villain-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>
                      {t.description}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--mono)', marginTop: 2 }}>{t.competenceDate}</div>
                  </div>
                  <span className="num" style={{ fontWeight: 700, flexShrink: 0, marginLeft: 12, fontSize: 12.5, color: t.type === 'income' ? 'var(--pos)' : 'var(--ink-2)' }}>
                    {t.type === 'income' ? '+' : '−'}{formatBRL(Math.abs(t.amount))}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--line)' }}>
              {status === 'idle' && (
                <button
                  className="btn btn-primary"
                  onClick={handleMigrate}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Migrar {localTxns.length} transações para Supabase
                </button>
              )}

              {status === 'migrating' && (
                <div style={{ textAlign: 'center', padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <div className="spinner spinner-sm" />
                  <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Migrando {totalSent} transações…</span>
                </div>
              )}

              {status === 'done' && (
                <div style={{ background: 'var(--pos-soft)', border: '1px solid var(--pos)', borderRadius: 9, padding: '14px 16px' }}>
                  <p style={{ fontWeight: 700, color: 'var(--pos)', fontSize: 13, marginBottom: 6 }}>
                    Migração concluída
                  </p>
                  <p style={{ fontSize: 12.5, color: 'var(--pos)' }}>
                    Novas: <strong>{newCount}</strong> · Já existiam (dedup): <strong>{dupeCount}</strong>
                  </p>
                  <p style={{ fontSize: 11.5, color: 'var(--pos)', marginTop: 4, opacity: 0.8 }}>
                    Reexecutar é seguro — duplicatas serão sempre ignoradas.
                  </p>
                  {newCount === 0 && dupeCount > 0 && (
                    <p style={{ fontSize: 11.5, color: 'var(--pos)', marginTop: 4, fontStyle: 'italic', opacity: 0.8 }}>
                      Todas as transações já estavam no Supabase.
                    </p>
                  )}
                </div>
              )}

              {status === 'error' && (
                <div style={{ background: 'var(--crit-soft)', border: '1px solid var(--crit)', borderRadius: 9, padding: '14px 16px' }}>
                  <p style={{ fontWeight: 700, color: 'var(--crit)', fontSize: 13, marginBottom: 4 }}>Erro na migração</p>
                  <p style={{ fontSize: 12.5, color: 'var(--crit)' }}>{errMsg}</p>
                  <button
                    onClick={() => setStatus('idle')}
                    className="btn btn-danger btn-sm"
                    style={{ marginTop: 10 }}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
