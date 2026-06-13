import { useState, useEffect } from 'react'
import { localAdapter } from '../adapters/local.adapter'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { formatBRL } from '../utils/currency'
import { DATA_PROVIDER } from '../config/env'
import type { Transaction } from '../types'

// Patch transactions missing importHash so upsert dedup works (NULL != NULL in SQL)
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
      <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
        Esta página só está disponível no modo Supabase com login ativo.
      </div>
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
      await appendTransactions(patched)
      setStatus('done')
    } catch (e) {
      setErrMsg((e as Error).message ?? 'Erro desconhecido')
      setStatus('error')
    }
  }

  // Computed after re-render with updated supabaseTxns
  const newCount  = status === 'done' ? Math.max(0, supabaseTxns.length - beforeCount) : 0
  const dupeCount = status === 'done' ? Math.max(0, totalSent - newCount) : 0

  const card: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 12,
    padding: '1.5rem',
    marginBottom: '1rem',
    boxShadow: 'var(--shadow-card)',
  }

  const label: React.CSSProperties = {
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 2,
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: 4 }}>
        Migrar dados locais → Supabase
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Envia as transações do navegador para a nuvem. Seguro re-executar — duplicatas são sempre ignoradas.
      </p>

      {/* Status cards: local vs Supabase */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ ...card, flex: 1, marginBottom: 0 }}>
          <div style={label}>No navegador (local)</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>{localTxns.length}</div>
          {dateFrom && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              {dateFrom} → {dateTo}
            </div>
          )}
        </div>
        <div style={{ ...card, flex: 1, marginBottom: 0 }}>
          <div style={label}>No Supabase (nuvem)</div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{supabaseTxns.length}</div>
        </div>
      </div>

      {localTxns.length === 0 ? (
        <div style={card}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Nenhuma transação local encontrada. Nada a migrar.
          </p>
        </div>
      ) : (
        <div style={card}>
          {/* importHash warning */}
          {noHashCount > 0 && (
            <div style={{
              background: 'var(--bg-page)', border: '1px solid var(--border-card)',
              borderRadius: 8, padding: '0.65rem 0.85rem', marginBottom: '1rem',
              fontSize: '0.8rem', color: 'var(--text-secondary)',
            }}>
              ⚠ {noHashCount} transação(ões) sem importHash — gerado hash <code>local-{'{id}'}</code> para dedup seguro.
            </div>
          )}

          {/* Sample rows */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ ...label, marginBottom: '0.5rem' }}>
              Amostra (primeiras {sample.length} de {localTxns.length})
            </div>
            {sample.map(t => (
              <div key={t.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.4rem 0', borderBottom: '1px solid var(--border-card)',
                fontSize: '0.82rem',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {t.description}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{t.competenceDate}</div>
                </div>
                <div style={{
                  fontWeight: 700, flexShrink: 0, marginLeft: '0.75rem',
                  color: t.type === 'income' ? 'var(--green, #16a34a)' : 'inherit',
                }}>
                  {t.type === 'income' ? '+' : '-'}{formatBRL(Math.abs(t.amount))}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          {status === 'idle' && (
            <button
              onClick={handleMigrate}
              style={{
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 8, padding: '0.75rem 1.5rem',
                fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', width: '100%',
              }}
            >
              Migrar {localTxns.length} transações para Supabase
            </button>
          )}

          {status === 'migrating' && (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Migrando {totalSent} transações… aguarde.
            </div>
          )}

          {status === 'done' && (
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 8, padding: '1rem',
            }}>
              <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.35rem' }}>
                ✓ Migração concluída
              </div>
              <div style={{ fontSize: '0.85rem', color: '#166534' }}>
                Novas: <strong>{newCount}</strong> · Já existiam (dedup): <strong>{dupeCount}</strong>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '0.5rem' }}>
                Reexecutar é seguro — duplicatas serão sempre ignoradas.
              </div>
              {newCount === 0 && dupeCount > 0 && (
                <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '0.25rem', fontStyle: 'italic' }}>
                  Todas as transações já estavam no Supabase.
                </div>
              )}
            </div>
          )}

          {status === 'error' && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, padding: '1rem',
            }}>
              <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '0.25rem' }}>Erro na migração</div>
              <div style={{ fontSize: '0.85rem', color: '#991b1b' }}>{errMsg}</div>
              <button
                onClick={() => setStatus('idle')}
                style={{
                  marginTop: '0.75rem', background: 'transparent',
                  border: '1px solid #fca5a5', borderRadius: 6,
                  padding: '0.35rem 0.75rem', fontSize: '0.8rem',
                  color: '#991b1b', cursor: 'pointer',
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
