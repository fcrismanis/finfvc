import { useState } from 'react'
import { MACRO_CATEGORIES } from '../../config/categories'
import type { MapResult } from '../../services/pluggy.service'
import type { Transaction } from '../../types'

export type SyncPhase = 'period_select' | 'fetching' | 'preview' | 'importing' | 'done' | 'error'
export type PeriodPreset = 'last_7d' | 'current_month' | 'last_30d' | 'last_90d' | 'custom'

export interface SyncSession {
  itemId: string
  accountId: string
  accountName: string
  period: PeriodPreset
  customFrom: string
  customTo: string
  phase: SyncPhase
  result?: MapResult
  error?: string
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  last_7d:       'Últimos 7 dias',
  current_month: 'Mês atual',
  last_30d:      'Últimos 30 dias',
  last_90d:      'Últimos 90 dias',
  custom:        'Personalizado',
}

interface SyncModalProps {
  sync: SyncSession
  onFetch: (p: PeriodPreset, from: string, to: string) => void
  onResetPeriod: () => void
  onImport: () => void
  onClose: () => void
}

export function SyncModal({ sync, onFetch, onResetPeriod, onImport, onClose }: SyncModalProps) {
  const { phase, result, error, period, accountName } = sync
  const [localPeriod, setLocalPeriod] = useState<PeriodPreset>(sync.period)
  const [customFrom, setCustomFrom] = useState(sync.customFrom)
  const [customTo, setCustomTo] = useState(sync.customTo)
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const isWorking = phase === 'fetching' || phase === 'importing'

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(16,15,10,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && !isWorking && onClose()}
    >
      <div style={{ background: 'var(--card-bg)', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 520, boxShadow: '0 8px 32px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', gap: 18 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>Sincronizar transações</h2>
            <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{accountName}</p>
          </div>
          {!isWorking && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 20, lineHeight: 1, fontFamily: 'var(--ui)', padding: 4 }}>×</button>
          )}
        </div>

        {phase === 'period_select' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>Selecione o período</p>
              <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 3 }}>
                Para primeira importação, comece com <strong>7 dias</strong> para validar categorias e evitar duplicidade.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['last_7d', 'current_month', 'last_30d', 'last_90d', 'custom'] as PeriodPreset[]).map(p => (
                <button
                  key={p}
                  onClick={() => setLocalPeriod(p)}
                  style={{
                    fontSize: 12, padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                    fontFamily: 'var(--ui)', fontWeight: localPeriod === p ? 700 : 400,
                    background: localPeriod === p ? 'var(--accent-soft)' : 'var(--well)',
                    border: `1px solid ${localPeriod === p ? 'var(--accent)' : 'var(--line)'}`,
                    color: localPeriod === p ? 'var(--accent)' : 'var(--ink-2)',
                  }}
                >
                  {PERIOD_LABELS[p]}
                  {p === 'last_7d' && <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, color: 'var(--pos)', background: 'var(--pos-soft)', border: '1px solid var(--pos)40', borderRadius: 3, padding: '0 4px' }}>REC</span>}
                </button>
              ))}
            </div>
            {localPeriod === 'custom' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="login-field" style={{ fontSize: 12, flex: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>até</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="login-field" style={{ fontSize: 12, flex: 1 }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button
                className="btn btn-primary"
                disabled={localPeriod === 'custom' && (!customFrom || !customTo)}
                onClick={() => onFetch(localPeriod, customFrom, customTo)}
              >
                Buscar transações
              </button>
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            </div>
          </div>
        )}

        {phase === 'fetching' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ fontSize: 13, color: 'var(--faint)' }}>Buscando transações na Pluggy…</p>
          </div>
        )}

        {phase === 'importing' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ fontSize: 13, color: 'var(--faint)' }}>Importando lançamentos…</p>
          </div>
        )}

        {phase === 'error' && error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', border: '1px solid var(--crit)', fontSize: 12.5, color: 'var(--crit)' }}>{error}</div>
        )}

        {phase === 'preview' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {([
                ['Novas', String(result.newTxs.length), 'var(--pos)'],
                ['Duplicadas', String(result.duplicateCount), 'var(--faint)'],
                ['Sem categoria', String(result.uncategorizedCount), result.uncategorizedCount > 0 ? 'var(--warn)' : 'var(--faint)'],
              ] as [string, string, string][]).map(([label, val, color]) => (
                <div key={label} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)', textAlign: 'center' }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{val}</p>
                  <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>{label}</p>
                </div>
              ))}
            </div>

            {result.newTxs.length > 0 && Object.keys(result.bySourceCount).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.entries(result.bySourceCount) as [string, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, count]) => {
                    const labels: Record<string, string> = {
                      rule: 'regra', pluggy_id: 'Pluggy ID', pluggy_name: 'Pluggy nome',
                      text_inference: 'inferência', history: 'histórico', none: 'a classificar',
                    }
                    const isNone = src === 'none'
                    return (
                      <span key={src} style={{
                        fontSize: 10.5, padding: '2px 8px', borderRadius: 4,
                        background: isNone ? 'var(--warn-soft, var(--well))' : 'var(--well)',
                        border: `1px solid ${isNone ? 'var(--warn)' : 'var(--line)'}`,
                        color: isNone ? 'var(--warn)' : 'var(--ink-2)', fontWeight: 600,
                      }}>
                        {count} {labels[src] ?? src}
                      </span>
                    )
                  })}
              </div>
            )}

            {result.rawReturnedCount > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 600 }}>Confiança de data:</span>
                {result.dateConfidenceCounts.high > 0 && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--pos-soft)', border: '1px solid var(--pos)40', color: 'var(--pos)', fontWeight: 600 }}>
                    alta {result.dateConfidenceCounts.high}
                  </span>
                )}
                {result.dateConfidenceCounts.medium > 0 && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--well)', border: '1px solid var(--line)', color: 'var(--ink-2)', fontWeight: 600 }}>
                    média {result.dateConfidenceCounts.medium}
                  </span>
                )}
                {result.dateConfidenceCounts.low > 0 && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--warn-soft, var(--well))', border: '1px solid var(--warn)40', color: 'var(--warn)', fontWeight: 600 }}>
                    baixa {result.dateConfidenceCounts.low}
                  </span>
                )}
                {result.missingFinancialDateCount > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 600 }}>
                    · {result.missingFinancialDateCount} sem data financeira
                  </span>
                )}
              </div>
            )}

            {result.newTxs.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--pos-soft)', border: '1px solid var(--pos)30' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--pos)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Entradas</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--pos)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(result.newTxs.filter((t: Transaction) => t.type === 'income').reduce((s: number, t: Transaction) => s + t.amount, 0))}</p>
                </div>
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--crit-soft)', border: '1px solid var(--crit)30' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--crit)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Saídas</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--crit)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(result.newTxs.filter((t: Transaction) => t.type === 'expense').reduce((s: number, t: Transaction) => s + t.amount, 0))}</p>
                </div>
              </div>
            )}

            {result.newTxs.length === 0 && (
              <p style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center', padding: '8px 0' }}>
                Nenhuma transação nova — todas já importadas ou período sem dados.
              </p>
            )}

            {result.newTxs.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
                {result.newTxs.slice(0, 25).map((tx: Transaction) => {
                  const macro = MACRO_CATEGORIES.find(m => m.id === tx.macroCategoryId)
                  const isNeutral = tx.classificationType === 'neutral'
                  return (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 12px', borderBottom: '1px solid var(--line)', fontSize: 12, gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{tx.transactionDate}</span>
                          {macro && (
                            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, border: `1px solid ${macro.color}50`, color: macro.color, fontWeight: 600, background: `${macro.color}12` }}>
                              {macro.name}
                            </span>
                          )}
                          {isNeutral && (
                            <span style={{ fontSize: 9.5, color: 'var(--faint)', fontWeight: 600 }}>neutro</span>
                          )}
                          {tx.needsReview && !macro && !isNeutral && (
                            <span style={{ fontSize: 9.5, color: 'var(--warn)', fontWeight: 600 }}>revisar</span>
                          )}
                        </div>
                        {(tx.pluggyCategory || tx.pluggyCategoryId) && (
                          <p style={{ fontSize: 9.5, color: 'var(--faint)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                            Pluggy: {[tx.pluggyCategory, tx.pluggyCategoryId].filter(Boolean).join(' / ')}
                          </p>
                        )}
                      </div>
                      <span style={{ fontWeight: 700, color: tx.type === 'income' ? 'var(--pos)' : 'var(--crit)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {tx.type === 'income' ? '+' : '−'}{fmtBRL(tx.amount)}
                      </span>
                    </div>
                  )
                })}
                {result.newTxs.length > 25 && (
                  <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--faint)', padding: '8px 0' }}>+{result.newTxs.length - 25} mais</p>
                )}
              </div>
            )}

            <button
              onClick={onResetPeriod}
              style={{ fontSize: 11, color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--ui)', padding: 0 }}
            >
              ← Mudar período ({PERIOD_LABELS[period]})
            </button>
          </div>
        )}

        {phase === 'done' && result && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: 22, marginBottom: 8 }}>✓</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--pos)' }}>
              {result.newTxs.length} lançamento{result.newTxs.length !== 1 ? 's' : ''} importado{result.newTxs.length !== 1 ? 's' : ''}
            </p>
            <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>
              {result.autoCategorizedCount > 0 && `${result.autoCategorizedCount} categorizados automaticamente · `}
              {result.needsReviewCount > 0 && `${result.needsReviewCount} aguardando revisão · `}
              {result.duplicateCount > 0 && `${result.duplicateCount} duplicados ignorados`}
            </p>
          </div>
        )}

        {phase !== 'period_select' && (
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            {phase === 'done' ? (
              <button className="btn btn-primary" onClick={onClose}>Fechar</button>
            ) : phase === 'preview' && result && result.newTxs.length > 0 ? (
              <>
                <button className="btn btn-primary" onClick={onImport}>
                  Importar {result.newTxs.length} lançamento{result.newTxs.length !== 1 ? 's' : ''}
                </button>
                <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              </>
            ) : phase === 'preview' && result && result.newTxs.length === 0 ? (
              <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
            ) : phase === 'error' ? (
              <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
            ) : null}
          </div>
        )}

      </div>
    </div>
  )
}
